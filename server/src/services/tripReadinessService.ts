import { db } from '../db/database';
import { requiredPassportValidityDays } from '@trek-family/shared';
import { isPassportInsufficientForTrip } from './documentValidityService';
import { getTravelersMissingTransport } from './travelerService';
import { getTripCountries } from './atlasService';

export interface ReadinessIssue {
  key: 'passport' | 'missing_transport' | 'packing';
  count: number;
  detail: string[];
}

// Matches the generic document-expiry lead time (scheduler.ts) — only used
// here as the no-trip-end-date fallback inside isPassportInsufficientForTrip.
const FALLBACK_LEAD_DAYS = 90;
// Packing completion is only "not ready yet" noise-worthy once departure is close.
const PACKING_CHECK_WINDOW_DAYS = 7;

/**
 * Rolls up the handful of "is this trip actually ready?" checks that matter
 * before departure: passport validity for this specific destination, trip
 * travelers with no transport booked anywhere, and (once departure is close)
 * unfinished packing. Returns only the issues that need attention — an empty
 * list means nothing to surface.
 */
export function getTripReadiness(tripId: string | number): { issues: ReadinessIssue[] } {
  const trip = db.prepare('SELECT start_date, end_date FROM trips WHERE id = ?').get(tripId) as
    { start_date: string | null; end_date: string | null } | undefined;
  const issues: ReadinessIssue[] = [];

  const passports = db.prepare(`
    SELECT f.expiry_date, tr.name AS traveler_name
    FROM trip_files f
    LEFT JOIN travelers tr ON tr.id = f.traveler_id
    WHERE f.trip_id = ? AND f.document_type = 'passport' AND f.expiry_date IS NOT NULL AND f.expiry_date <> ''
  `).all(tripId) as { expiry_date: string; traveler_name: string | null }[];
  if (passports.length > 0) {
    const countries = getTripCountries(tripId);
    const insufficientNames: string[] = [];
    for (const doc of passports) {
      if (isPassportInsufficientForTrip(doc.expiry_date, trip?.end_date ?? null, countries, requiredPassportValidityDays, FALLBACK_LEAD_DAYS)) {
        insufficientNames.push(doc.traveler_name || 'Unnamed traveler');
      }
    }
    if (insufficientNames.length > 0) {
      issues.push({ key: 'passport', count: insufficientNames.length, detail: insufficientNames });
    }
  }

  const missing = getTravelersMissingTransport(tripId) as { name: string }[];
  if (missing.length > 0) {
    issues.push({ key: 'missing_transport', count: missing.length, detail: missing.map(t => t.name) });
  }

  if (trip?.start_date) {
    const daysUntil = Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / 86400000);
    if (daysUntil >= 0 && daysUntil <= PACKING_CHECK_WINDOW_DAYS) {
      const packing = db.prepare(
        'SELECT COUNT(*) as total, SUM(checked) as checked FROM packing_items WHERE trip_id = ?'
      ).get(tripId) as { total: number; checked: number | null };
      const checked = packing.checked ?? 0;
      if (packing.total > 0 && checked < packing.total) {
        issues.push({ key: 'packing', count: packing.total - checked, detail: [`${checked}/${packing.total} packed`] });
      }
    }
  }

  return { issues };
}
