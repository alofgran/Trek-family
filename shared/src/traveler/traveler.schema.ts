import { z } from 'zod';

/** Age bands used for packing template affinity and family-profile display. */
export const TRAVELER_TYPES = ['adult', 'teen', 'child', 'infant'] as const;
export type TravelerType = (typeof TRAVELER_TYPES)[number];

export const travelerSchema = z.object({
  id: z.number(),
  managed_by_user_id: z.number(),
  linked_user_id: z.number().nullable(),
  name: z.string(),
  avatar: z.string().nullable(),
  color: z.string().nullable(),
  type: z.enum(TRAVELER_TYPES),
  date_of_birth: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string(),
});
export type Traveler = z.infer<typeof travelerSchema>;

export const tripTravelerSchema = travelerSchema.extend({
  added_at: z.string(),
  added_by_user_id: z.number().nullable(),
});
export type TripTraveler = z.infer<typeof tripTravelerSchema>;

export const createTravelerSchema = z.object({
  name: z.string().min(1).max(100),
  avatar: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  type: z.enum(TRAVELER_TYPES).optional(),
  date_of_birth: z.string().max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type CreateTravelerRequest = z.infer<typeof createTravelerSchema>;

export const updateTravelerSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  type: z.enum(TRAVELER_TYPES).optional(),
  date_of_birth: z.string().max(10).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateTravelerRequest = z.infer<typeof updateTravelerSchema>;

/**
 * Age in whole years as of `referenceDate` (defaults to today). Used to
 * suggest/display an age category (e.g. flag a `type: 'child'` traveler who
 * has aged into `teen`) — the stored `type` is never auto-changed, since
 * families often want to pick the category deliberately (e.g. packing needs).
 */
export function ageFromDob(dob: string | null | undefined, referenceDate: string | Date = new Date()): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const ref = typeof referenceDate === 'string' ? new Date(referenceDate) : referenceDate;
  let age = ref.getFullYear() - birth.getFullYear();
  const monthDiff = ref.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

/** Suggests a traveler_type band from age in years — a suggestion only, never auto-applied. */
export function suggestTravelerType(ageYears: number | null): TravelerType | null {
  if (ageYears === null) return null;
  if (ageYears < 2) return 'infant';
  if (ageYears < 13) return 'child';
  if (ageYears < 18) return 'teen';
  return 'adult';
}
