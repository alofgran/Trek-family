import { db } from '../db/database';
import { decrypt_api_key } from './apiKeyCrypto';
import { PII_DOCUMENT_FIELDS, type PiiDocumentType } from '@trek-family/shared';

// ---------------------------------------------------------------------------
// Settings — instance-wide, admin-configured (see authService ADMIN_SETTINGS_KEYS)
// ---------------------------------------------------------------------------

function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export interface AiSettings {
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  model: string | null;
}

export function getAiSettings(): AiSettings {
  const rawKey = getSetting('ai_api_key');
  return {
    provider: getSetting('ai_provider') || '',
    apiKey: rawKey ? decrypt_api_key(rawKey) : null,
    baseUrl: getSetting('ai_base_url'),
    model: getSetting('ai_model'),
  };
}

export function isAiConfigured(): boolean {
  const { provider, apiKey } = getAiSettings();
  return !!provider && provider !== 'none' && !!apiKey;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

export interface ExtractionResult {
  fields: Record<string, string>;
  warnings: string[];
}

/**
 * Sends a document (image or PDF, base64-encoded) to the admin-configured AI
 * provider and asks it to return the fields for the given document type as
 * JSON. The result is a *suggestion* — callers must let the user review/edit
 * before persisting, since OCR/vision extraction of PII is never guaranteed
 * accurate.
 */
export async function extractDocumentFields(
  documentType: PiiDocumentType,
  base64Data: string,
  mimeType: string
): Promise<ExtractionResult> {
  const { provider, apiKey, baseUrl, model } = getAiSettings();
  if (!provider || provider === 'none' || !apiKey) {
    throw new Error('AI provider is not configured. Set it up under Admin Settings first.');
  }

  const fieldNames = PII_DOCUMENT_FIELDS[documentType];
  const prompt = [
    `You are extracting structured data from a travel document (type: ${documentType}).`,
    `Return ONLY a raw JSON object (no markdown fences, no commentary) with exactly these keys: ${fieldNames.join(', ')}.`,
    'Use an empty string "" for any field you cannot read with confidence. Dates must be in YYYY-MM-DD format when determinable.',
  ].join('\n');

  let raw: string;
  if (provider === 'anthropic') {
    raw = await callAnthropic(apiKey, model || 'claude-sonnet-4-5', prompt, base64Data, mimeType);
  } else {
    raw = await callOpenAiCompatible(apiKey, baseUrl || 'https://api.openai.com/v1', model || 'gpt-4o', prompt, base64Data, mimeType);
  }

  const warnings: string[] = [];
  let parsed: Record<string, unknown> = {};
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    warnings.push('The AI response was not valid JSON — fields below may be incomplete.');
  }

  const fields: Record<string, string> = {};
  for (const name of fieldNames) {
    const value = parsed[name];
    fields[name] = value == null ? '' : String(value);
  }
  return { fields, warnings };
}

async function callAnthropic(apiKey: string, model: string, prompt: string, base64Data: string, mimeType: string): Promise<string> {
  const isPdf = mimeType === 'application/pdf';
  const content = [
    isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Data } },
    { type: 'text', text: prompt },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json() as { content?: { type: string; text?: string }[] };
  return data.content?.find(c => c.type === 'text')?.text || '';
}

async function callOpenAiCompatible(apiKey: string, baseUrl: string, model: string, prompt: string, base64Data: string, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    throw new Error('The configured AI provider does not support PDF documents — upload an image (JPG/PNG) instead, or switch to Anthropic in Admin Settings.');
  }
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } },
        ],
      }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI provider error (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || '';
}
