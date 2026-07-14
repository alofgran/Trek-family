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

import { createTables } from '../../../src/db/schema';
import { runMigrations } from '../../../src/db/migrations';
import { resetTestDb } from '../../helpers/test-db';
import { createUser, createTrip, createReservation } from '../../helpers/factories';
import { getTravelersMissingTransport } from '../../../src/services/travelerService';

function addTraveler(name: string, managedByUserId: number): number {
  const result = testDb.prepare(
    'INSERT INTO travelers (managed_by_user_id, name, type) VALUES (?, ?, ?)'
  ).run(managedByUserId, name, 'adult');
  return result.lastInsertRowid as number;
}

function addTripTraveler(tripId: number, travelerId: number): void {
  testDb.prepare('INSERT INTO trip_travelers (trip_id, traveler_id) VALUES (?, ?)').run(tripId, travelerId);
}

function linkReservationTraveler(reservationId: number, travelerId: number): void {
  testDb.prepare('INSERT INTO reservation_travelers (reservation_id, traveler_id) VALUES (?, ?)').run(reservationId, travelerId);
}

beforeEach(() => {
  createTables(testDb);
  runMigrations(testDb);
  resetTestDb(testDb);
});

describe('getTravelersMissingTransport', () => {
  it('returns [] when no transport reservations exist yet (transport planning has not started)', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const lucy = addTraveler('Lucy', user.id);
    addTripTraveler(trip.id, lucy);

    expect(getTravelersMissingTransport(trip.id)).toEqual([]);
  });

  it('flags a trip traveler with zero transport reservations once at least one exists for someone else', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const kacie = addTraveler('Kacie', user.id);
    const timmy = addTraveler('Timmy', user.id);
    addTripTraveler(trip.id, kacie);
    addTripTraveler(trip.id, timmy);

    const flight = createReservation(testDb, trip.id, { type: 'flight' });
    linkReservationTraveler(flight.id, kacie);

    const missing = getTravelersMissingTransport(trip.id);
    expect(missing.map((t: { name: string }) => t.name)).toEqual(['Timmy']);
  });

  it('does not flag anyone once every trip traveler has at least one transport reservation', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const kacie = addTraveler('Kacie', user.id);
    const timmy = addTraveler('Timmy', user.id);
    addTripTraveler(trip.id, kacie);
    addTripTraveler(trip.id, timmy);

    const flight = createReservation(testDb, trip.id, { type: 'flight' });
    linkReservationTraveler(flight.id, kacie);
    linkReservationTraveler(flight.id, timmy);

    expect(getTravelersMissingTransport(trip.id)).toEqual([]);
  });

  it('ignores non-transport reservations (e.g. accommodation) when deciding whether transport planning has started', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const kacie = addTraveler('Kacie', user.id);
    addTripTraveler(trip.id, kacie);

    const hotel = createReservation(testDb, trip.id, { type: 'accommodation' });
    linkReservationTraveler(hotel.id, kacie);

    expect(getTravelersMissingTransport(trip.id)).toEqual([]);
  });
});
