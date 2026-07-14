import { describe, it, expect, vi, beforeEach } from 'vitest';

const { testDb, dbMock } = vi.hoisted(() => {
  const Database = require('better-sqlite3');
  const db = new Database(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  const mock = {
    db,
    closeDb: () => {},
    reinitialize: () => {},
    getPlaceWithTags: () => null,
    canAccessTrip: () => null,
    isOwner: () => false,
  };
  return { testDb: db, dbMock: mock };
});

vi.mock('../../../src/db/database', () => dbMock);
vi.mock('../../../src/config', () => ({
  JWT_SECRET: 'test-secret',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2',
  updateJwtSecret: () => {},
}));

// Deterministic per-date fake forecast, keyed off the date string so each test
// can control which days look rainy/cold/hot without a real Open-Meteo call.
const fakeWeatherByDate = vi.hoisted(() => new Map<string, { main?: string; temp_max?: number; temp_min?: number; precipitation_probability_max?: number }>());
vi.mock('../../../src/services/weatherService', () => ({
  getWeather: vi.fn(async (_lat: string, _lng: string, date: string) => fakeWeatherByDate.get(date) ?? { main: 'Clear', temp_max: 20, temp_min: 12 }),
}));

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser, createTrip, createPlace, createPackingItem } from '../../helpers/factories';
import { getWeatherPackingSuggestions } from '../../../src/services/weatherPackingService';

beforeEach(() => {
  createTables(testDb);
  runMigrations(testDb);
  resetTestDb(testDb);
  fakeWeatherByDate.clear();
});

describe('getWeatherPackingSuggestions', () => {
  it('returns [] when the trip has no days', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    expect(await getWeatherPackingSuggestions(trip.id)).toEqual([]);
  });

  it('returns [] when no place on the trip has coordinates', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2026-08-01', end_date: '2026-08-03' });
    expect(await getWeatherPackingSuggestions(trip.id)).toEqual([]);
  });

  it('suggests rain gear when most days forecast rain', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2026-08-01', end_date: '2026-08-03' });
    createPlace(testDb, trip.id, { lat: 48.8566, lng: 2.3522 });
    fakeWeatherByDate.set('2026-08-01', { main: 'Rain', temp_max: 18, temp_min: 12 });
    fakeWeatherByDate.set('2026-08-02', { main: 'Rain', temp_max: 18, temp_min: 12 });
    fakeWeatherByDate.set('2026-08-03', { main: 'Clear', temp_max: 20, temp_min: 12 });

    const suggestions = await getWeatherPackingSuggestions(trip.id);
    expect(suggestions.map(s => s.name)).toEqual(expect.arrayContaining(['Rain jacket', 'Umbrella']));
    expect(suggestions.every(s => s.reason === 'rain')).toBe(true);
  });

  it('suggests cold-weather items when most days are cold', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2026-01-01', end_date: '2026-01-03' });
    createPlace(testDb, trip.id, { lat: 59.3293, lng: 18.0686 });
    fakeWeatherByDate.set('2026-01-01', { main: 'Clear', temp_max: 5, temp_min: 2 });
    fakeWeatherByDate.set('2026-01-02', { main: 'Clear', temp_max: 4, temp_min: 1 });
    fakeWeatherByDate.set('2026-01-03', { main: 'Clear', temp_max: 20, temp_min: 15 });

    const suggestions = await getWeatherPackingSuggestions(trip.id);
    expect(suggestions.map(s => s.name)).toEqual(expect.arrayContaining(['Warm jacket', 'Gloves']));
  });

  it('does not suggest anything when weather is mild throughout', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2026-05-01', end_date: '2026-05-03' });
    createPlace(testDb, trip.id, { lat: 41.9028, lng: 12.4964 });
    fakeWeatherByDate.set('2026-05-01', { main: 'Clear', temp_max: 22, temp_min: 14 });
    fakeWeatherByDate.set('2026-05-02', { main: 'Clouds', temp_max: 21, temp_min: 13 });
    fakeWeatherByDate.set('2026-05-03', { main: 'Clear', temp_max: 23, temp_min: 15 });

    expect(await getWeatherPackingSuggestions(trip.id)).toEqual([]);
  });

  it('excludes items already present on the trip packing list (case-insensitive)', async () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: '2026-08-01', end_date: '2026-08-02' });
    createPlace(testDb, trip.id, { lat: 48.8566, lng: 2.3522 });
    createPackingItem(testDb, trip.id, { name: 'rain jacket' });
    fakeWeatherByDate.set('2026-08-01', { main: 'Rain', temp_max: 18, temp_min: 12 });
    fakeWeatherByDate.set('2026-08-02', { main: 'Rain', temp_max: 18, temp_min: 12 });

    const suggestions = await getWeatherPackingSuggestions(trip.id);
    expect(suggestions.map(s => s.name)).not.toContain('Rain jacket');
    expect(suggestions.map(s => s.name)).toContain('Umbrella');
  });
});
