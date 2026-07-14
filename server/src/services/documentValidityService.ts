/**
 * Whether a passport's expiry_date is insufficient for a trip, given its
 * destination countries. Many countries require validity well beyond the
 * trip itself (e.g. 6 months past return) — the strictest requirement among
 * all resolved destination countries wins. Falls back to the flat lead-time
 * window when the trip has no end_date to measure a country rule against.
 */
export function isPassportInsufficientForTrip(
  expiryDate: string,
  tripEndDate: string | null,
  countries: string[],
  requiredValidityDaysFor: (countryCode: string | null) => number,
  leadDays: number,
  now: number = Date.now(),
): boolean {
  if (!tripEndDate) {
    return new Date(expiryDate).getTime() <= now + leadDays * 86400000;
  }
  const requiredDays = countries.length > 0
    ? Math.max(...countries.map(c => requiredValidityDaysFor(c)))
    : requiredValidityDaysFor(null);
  const cutoff = new Date(tripEndDate).getTime() + requiredDays * 86400000;
  return new Date(expiryDate).getTime() < cutoff;
}
