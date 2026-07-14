import { z } from 'zod';

/**
 * File + photo API contract.
 *
 * Files live under /api/trips/:tripId/files (upload, metadata, star, trash,
 * reservation links, authenticated download). Photos live under /api/photos
 * (thumbnail/original streaming + info) and are global, not trip-scoped.
 *
 * Uploads are multipart/form-data so the file itself isn't modelled here; these
 * schemas pin the JSON-ish metadata fields that ride along or come as request
 * bodies. The bespoke 400/403/404 controller messages pin the rest.
 */

const nullableIdField = z.union([z.string(), z.number()]).nullable().optional();

/** Document categories used for expiry tracking (passport/ID-style docs; others never expire). */
export const DOCUMENT_TYPES = ['passport', 'id_card', 'visa', 'insurance', 'vaccination', 'itinerary', 'other'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Minimum passport validity (in days beyond a trip's last day) required by a
 * destination country — the common "6-month rule" and its exceptions. Only
 * countries that DIFFER from the default are listed; everything else falls
 * through to PASSPORT_VALIDITY_DEFAULT_DAYS.
 *
 * Best-effort guidance compiled from public aggregators (not authoritative —
 * requirements vary by traveler nationality and change over time; always
 * verify with the destination's official entry requirements before travel).
 */
export const PASSPORT_VALIDITY_DEFAULT_DAYS = 180; // ~6 months — the majority rule across Asia, Africa, the Middle East, Latin America and the Pacific

export const PASSPORT_VALIDITY_EXCEPTIONS_DAYS: Record<string, number> = {
  // Duration-of-stay only — no extra buffer required beyond the trip itself
  US: 0, GB: 0, CA: 0, AU: 0, MX: 0, JP: 0, CL: 0, IE: 0, UA: 0, NE: 0, BF: 0, BJ: 0,
  LY: 0, PY: 0, LR: 0, GE: 0, UY: 0, AM: 0, GM: 0, JM: 0, MU: 0, BB: 0, SC: 0, BM: 0,
  CO: 0, WS: 0,
  // ~1 month
  ZA: 30, MV: 30, HK: 30, MO: 30,
  // ~4 months
  FM: 120,
  // Schengen area — 3 months beyond planned departure from the zone
  AT: 90, BE: 90, CZ: 90, HR: 90, DK: 90, EE: 90, FI: 90, FR: 90, DE: 90, GR: 90,
  HU: 90, IS: 90, IT: 90, LV: 90, LI: 90, LT: 90, LU: 90, MT: 90, NL: 90, NO: 90,
  PL: 90, PT: 90, SK: 90, SI: 90, ES: 90, SE: 90, CH: 90,
};

/** Required passport validity (in days beyond the trip's last day) for a destination country. */
export function requiredPassportValidityDays(countryCode: string | null | undefined): number {
  if (!countryCode) return PASSPORT_VALIDITY_DEFAULT_DAYS;
  return PASSPORT_VALIDITY_EXCEPTIONS_DAYS[countryCode.toUpperCase()] ?? PASSPORT_VALIDITY_DEFAULT_DAYS;
}

export const fileUpdateRequestSchema = z.object({
  description: z.string().optional(),
  place_id: nullableIdField,
  reservation_id: nullableIdField,
  traveler_id: nullableIdField,
  expiry_date: z.string().max(10).nullable().optional(),
  document_type: z.string().max(30).nullable().optional(),
  extracted_data: z.string().nullable().optional(),
});
export type FileUpdateRequest = z.infer<typeof fileUpdateRequestSchema>;

export const fileLinkRequestSchema = z.object({
  reservation_id: nullableIdField,
  assignment_id: nullableIdField,
  place_id: nullableIdField,
});
export type FileLinkRequest = z.infer<typeof fileLinkRequestSchema>;

/** Variants the photo streaming endpoints accept. */
export const photoVariantSchema = z.enum(['thumbnail', 'original']);
export type PhotoVariant = z.infer<typeof photoVariantSchema>;
