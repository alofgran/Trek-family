import { z } from 'zod';
import { bookingImportPreviewItemSchema } from '../reservation/reservation.schema';

/**
 * Document parsing API contract — POST /api/trips/:tripId/files/:id/parse and
 * its two confirm endpoints (parse/confirm-itinerary, parse/confirm-document).
 *
 * Itinerary parsing reuses the KItinerary-based booking-import pipeline (local
 * binary, no external calls). PII document parsing (passport/id_card/visa/
 * vaccination) calls an admin-configured third-party AI provider — insurance
 * and other document types are excluded here since their formats vary too
 * widely to extract reliably.
 */

export const PARSEABLE_DOCUMENT_TYPES = ['itinerary', 'passport', 'id_card', 'visa', 'vaccination'] as const;
export type ParseableDocumentType = (typeof PARSEABLE_DOCUMENT_TYPES)[number];

export const PII_DOCUMENT_TYPES = ['passport', 'id_card', 'visa', 'vaccination'] as const;
export type PiiDocumentType = (typeof PII_DOCUMENT_TYPES)[number];

/** Structured fields extracted per PII document type (order = display order). */
export const PII_DOCUMENT_FIELDS: Record<PiiDocumentType, string[]> = {
  passport: ['full_name', 'passport_number', 'nationality', 'date_of_birth', 'issue_date', 'expiry_date', 'issuing_country'],
  id_card: ['full_name', 'id_number', 'date_of_birth', 'expiry_date', 'issuing_country'],
  visa: ['full_name', 'visa_type', 'visa_number', 'valid_from', 'valid_until', 'issuing_country', 'number_of_entries'],
  vaccination: ['full_name', 'vaccine_name', 'date_administered', 'dose_number', 'provider', 'batch_number'],
};

export const documentParseItineraryResultSchema = z.object({
  kind: z.literal('itinerary'),
  items: z.array(bookingImportPreviewItemSchema),
  warnings: z.array(z.string()),
});
export type DocumentParseItineraryResult = z.infer<typeof documentParseItineraryResultSchema>;

export const documentParsePiiResultSchema = z.object({
  kind: z.literal('pii'),
  document_type: z.enum(PII_DOCUMENT_TYPES),
  fields: z.record(z.string(), z.string()),
  warnings: z.array(z.string()),
});
export type DocumentParsePiiResult = z.infer<typeof documentParsePiiResultSchema>;

export const documentParseResultSchema = z.discriminatedUnion('kind', [
  documentParseItineraryResultSchema,
  documentParsePiiResultSchema,
]);
export type DocumentParseResult = z.infer<typeof documentParseResultSchema>;

export const confirmDocumentParseRequestSchema = z.object({
  fields: z.record(z.string(), z.string()),
  expiry_date: z.string().max(10).nullable().optional(),
  traveler_id: z.union([z.string(), z.number()]).nullable().optional(),
});
export type ConfirmDocumentParseRequest = z.infer<typeof confirmDocumentParseRequestSchema>;
