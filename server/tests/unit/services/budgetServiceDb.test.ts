/**
 * DB-backed unit tests for budgetService trip-scoping (BUDGET-SVC-DB-001+).
 * Uses a real in-memory SQLite DB so the SQL WHERE clauses are exercised.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

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
import { createUser, createTrip } from '../../helpers/factories';
import { createBudgetItem, updateMembers, toggleMemberPaid, setItemPayers, getBudgetItem } from '../../../src/services/budgetService';

beforeAll(() => {
  createTables(testDb);
  runMigrations(testDb);
});

beforeEach(() => {
  resetTestDb(testDb);
});

afterAll(() => {
  testDb.close();
});

function paidFlag(itemId: number, memberId: number): number | undefined {
  const row = testDb
    .prepare('SELECT paid FROM budget_item_members WHERE budget_item_id = ? AND user_id = ?')
    .get(itemId, memberId) as { paid: number } | undefined;
  return row?.paid;
}

describe('toggleMemberPaid trip-scoping', () => {
  it('BUDGET-SVC-DB-001: toggles paid for an item that belongs to the given trip', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id, { title: 'Trip A' });
    const item = createBudgetItem(trip.id, { name: 'Hotel', total_price: 100 });
    updateMembers(item.id, trip.id, [user.id]);

    const member = toggleMemberPaid(item.id, trip.id, user.id, true);

    expect(member).not.toBeNull();
    expect(paidFlag(item.id, user.id)).toBe(1);
  });

  it('BUDGET-SVC-DB-002: refuses to toggle an item from a different trip (cross-trip IDOR)', () => {
    const { user } = createUser(testDb);
    const tripA = createTrip(testDb, user.id, { title: 'Trip A' });
    const tripB = createTrip(testDb, user.id, { title: 'Trip B' });
    const itemB = createBudgetItem(tripB.id, { name: 'Foreign expense', total_price: 50 });
    updateMembers(itemB.id, tripB.id, [user.id]);

    // Caller passes a trip they can access (A) but the item lives in trip B.
    const member = toggleMemberPaid(itemB.id, tripA.id, user.id, true);

    expect(member).toBeNull();
    expect(paidFlag(itemB.id, user.id)).toBe(0); // unchanged
  });
});

function createUnlinkedTraveler(managerId: number, name: string): number {
  const result = testDb
    .prepare('INSERT INTO travelers (managed_by_user_id, linked_user_id, name) VALUES (?, NULL, ?)')
    .run(managerId, name);
  return result.lastInsertRowid as number;
}

describe('payers carry traveler_id (#reported: "who paid" showed "You" for every child)', () => {
  it('BUDGET-SVC-DB-003: two unlinked travelers sharing one manager account resolve to distinct payer rows', () => {
    const { user: parent } = createUser(testDb);
    const trip = createTrip(testDb, parent.id, { title: 'Family trip' });
    const kid1 = createUnlinkedTraveler(parent.id, 'Kid One');
    const kid2 = createUnlinkedTraveler(parent.id, 'Kid Two');
    const item = createBudgetItem(trip.id, {
      name: 'Snacks', total_price: 20,
      payers: [
        { user_id: parent.id, traveler_id: kid1, amount: 12 },
        { user_id: parent.id, traveler_id: kid2, amount: 8 },
      ],
    });

    const fetched = getBudgetItem(item.id, trip.id);

    expect(fetched?.payers).toHaveLength(2);
    const byTraveler = Object.fromEntries((fetched?.payers || []).map(p => [p.traveler_id, p]));
    expect(byTraveler[kid1].amount).toBe(12);
    expect(byTraveler[kid1].traveler_name).toBe('Kid One');
    expect(byTraveler[kid2].amount).toBe(8);
    expect(byTraveler[kid2].traveler_name).toBe('Kid Two');
    // Both still settle under the same account for balance math.
    expect(byTraveler[kid1].user_id).toBe(parent.id);
    expect(byTraveler[kid2].user_id).toBe(parent.id);
  });

  it('BUDGET-SVC-DB-004: setItemPayers replaces payer rows and preserves traveler_id', () => {
    const { user: parent } = createUser(testDb);
    const trip = createTrip(testDb, parent.id, { title: 'Family trip' });
    const kid = createUnlinkedTraveler(parent.id, 'Kid');
    const item = createBudgetItem(trip.id, { name: 'Tickets', total_price: 30 });

    setItemPayers(item.id, trip.id, [{ user_id: parent.id, traveler_id: kid, amount: 30 }]);

    const fetched = getBudgetItem(item.id, trip.id);
    expect(fetched?.payers).toHaveLength(1);
    expect(fetched?.payers?.[0].traveler_id).toBe(kid);
    expect(fetched?.payers?.[0].traveler_name).toBe('Kid');
  });
});
