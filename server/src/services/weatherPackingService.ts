import { db } from '../db/database';
import { getWeather } from './weatherService';

const COLD_THRESHOLD_C = 10;
const HOT_THRESHOLD_C = 28;
const RAIN_PROBABILITY_THRESHOLD = 50;
const CONDITION_TRIGGER_FRACTION = 0.3; // ~30% of trip days matching a condition before suggesting for it

const RAIN_CONDITIONS = new Set(['Rain', 'Drizzle', 'Thunderstorm']);

interface WeatherSuggestionCondition {
  key: 'rain' | 'cold' | 'hot';
  items: string[];
}

const CONDITIONS: WeatherSuggestionCondition[] = [
  { key: 'rain', items: ['Rain jacket', 'Umbrella'] },
  { key: 'cold', items: ['Warm jacket', 'Gloves'] },
  { key: 'hot', items: ['Sunscreen', 'Sunglasses', 'Hat'] },
];

export interface WeatherSuggestion {
  reason: 'rain' | 'cold' | 'hot';
  name: string;
}

/**
 * Suggests packing items based on the trip's actual forecast (or historical
 * climate average beyond the 16-day forecast window — see weatherService),
 * checked against a representative trip location (the first place with
 * coordinates — most trips are single-destination; this is a heads-up, not
 * a precise per-day breakdown). Excludes items already present on the trip's
 * packing list (case-insensitive name match).
 */
export async function getWeatherPackingSuggestions(tripId: string | number, lang = 'en'): Promise<WeatherSuggestion[]> {
  const days = db.prepare('SELECT date FROM days WHERE trip_id = ? AND date IS NOT NULL ORDER BY day_number ASC').all(tripId) as { date: string }[];
  if (days.length === 0) return [];

  const place = db.prepare('SELECT lat, lng FROM places WHERE trip_id = ? AND lat IS NOT NULL AND lng IS NOT NULL LIMIT 1').get(tripId) as { lat: number; lng: number } | undefined;
  if (!place) return [];

  const results = await Promise.all(
    days.map(d => getWeather(String(place.lat), String(place.lng), d.date, lang).catch(() => null))
  );

  let rainCount = 0, coldCount = 0, hotCount = 0;
  let counted = 0;
  for (const w of results) {
    if (!w || w.error) continue;
    counted++;
    if ((w.main && RAIN_CONDITIONS.has(w.main)) || (w.precipitation_probability_max ?? 0) > RAIN_PROBABILITY_THRESHOLD) rainCount++;
    if (typeof w.temp_min === 'number' && w.temp_min < COLD_THRESHOLD_C) coldCount++;
    if (typeof w.temp_max === 'number' && w.temp_max > HOT_THRESHOLD_C) hotCount++;
  }
  if (counted === 0) return [];

  const existingNames = new Set(
    (db.prepare('SELECT LOWER(name) as name FROM packing_items WHERE trip_id = ?').all(tripId) as { name: string }[])
      .map(r => r.name)
  );

  const counts: Record<WeatherSuggestionCondition['key'], number> = { rain: rainCount, cold: coldCount, hot: hotCount };
  const suggestions: WeatherSuggestion[] = [];
  for (const cond of CONDITIONS) {
    if (counts[cond.key] / counted < CONDITION_TRIGGER_FRACTION) continue;
    for (const name of cond.items) {
      if (existingNames.has(name.toLowerCase())) continue;
      suggestions.push({ reason: cond.key, name });
    }
  }
  return suggestions;
}
