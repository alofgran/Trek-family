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
// No places on these test trips, so country resolution always returns [] —
// isPassportInsufficientForTrip then falls back to the 180-day default rule.

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser, createTrip, createReservation, createPackingItem } from '../../helpers/factories';
import { getTripReadiness } from '../../../src/services/tripReadinessService';

const DAY = 24 * 60 * 60 * 1000;
function daysFromNow(n: number): string {
  return new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
}

function addTraveler(name: string, managedByUserId: number): number {
  const result = testDb.prepare(
    'INSERT INTO travelers (managed_by_user_id, name, type) VALUES (?, ?, ?)'
  ).run(managedByUserId, name, 'adult');
  return result.lastInsertRowid as number;
}

function addTripFile(tripId: number, opts: { document_type: string; expiry_date: string; traveler_id?: number | null }): void {
  testDb.prepare(
    'INSERT INTO trip_files (trip_id, filename, original_name, document_type, expiry_date, traveler_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(tripId, 'passport.jpg', 'passport.jpg', opts.document_type, opts.expiry_date, opts.traveler_id ?? null);
}

beforeEach(() => {
  createTables(testDb);
  runMigrations(testDb);
  resetTestDb(testDb);
});

describe('getTripReadiness', () => {
  it('returns no issues for a trip with nothing to flag', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: daysFromNow(30), end_date: daysFromNow(37) });
    expect(getTripReadiness(trip.id)).toEqual({ issues: [] });
  });

  it('flags a passport that will not clear the default 6-month rule for the trip', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: daysFromNow(100), end_date: daysFromNow(107) });
    const lucy = addTraveler('Lucy', user.id);
    // Expires 150 days out — clears "not expiring soon" easily but fails the
    // 180-day default rule against a trip ending 107 days out.
    addTripFile(trip.id, { document_type: 'passport', expiry_date: daysFromNow(150), traveler_id: lucy });

    const { issues } = getTripReadiness(trip.id);
    expect(issues).toEqual([{ key: 'passport', count: 1, detail: ['Lucy'] }]);
  });

  it('does not flag a passport with ample validity', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: daysFromNow(30), end_date: daysFromNow(37) });
    const lucy = addTraveler('Lucy', user.id);
    addTripFile(trip.id, { document_type: 'passport', expiry_date: daysFromNow(365 * 2), traveler_id: lucy });

    expect(getTripReadiness(trip.id).issues).toEqual([]);
  });

  it('flags a trip traveler with no transport booked once transport planning has started', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: daysFromNow(30), end_date: daysFromNow(37) });
    const kacie = addTraveler('Kacie', user.id);
    const timmy = addTraveler('Timmy', user.id);
    testDb.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (?, ?)').run(trip.id, kacie);
    testDb.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (?, ?)').run(trip.id, timmy);
    const flight = createReservation(testDb, trip.id, { type: 'flight' });
    testDb.prepare('INSERT INTO reservation_travelers (reservation_id, traveler_id) VALUES (?, ?)').run(flight.id, kacie);

    const { issues } = getTripReadiness(trip.id);
    expect(issues).toEqual([{ key: 'missing_transport', count: 1, detail: ['Timmy'] }]);
  });

  it('flags unfinished packing only when the trip starts within the next 7 days', () => {
    const { user } = createUser(testDb);
    const soonTrip = createTrip(testDb, user.id, { start_date: daysFromNow(3), end_date: daysFromNow(10) });
    createPackingItem(testDb, soonTrip.id, { name: 'Sunscreen', checked: 0 });
    createPackingItem(testDb, soonTrip.id, { name: 'Passport copy', checked: 1 });

    const farTrip = createTrip(testDb, user.id, { start_date: daysFromNow(60), end_date: daysFromNow(67) });
    createPackingItem(testDb, farTrip.id, { name: 'Sunscreen', checked: 0 });

    expect(getTripReadiness(soonTrip.id).issues).toEqual([{ key: 'packing', count: 1, detail: ['1/2 packed'] }]);
    expect(getTripReadiness(farTrip.id).issues).toEqual([]);
  });

  it('does not flag packing once everything is checked, even close to departure', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { start_date: daysFromNow(2), end_date: daysFromNow(9) });
    createPackingItem(testDb, trip.id, { name: 'Sunscreen', checked: 1 });

    expect(getTripReadiness(trip.id).issues).toEqual([]);
  });
});
