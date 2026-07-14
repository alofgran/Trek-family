/**
 * Unit tests for packingService.ts — uncovered functions.
 * Covers PACK-SVC-001 to PACK-SVC-012.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

// ── DB mock setup (vi.hoisted so it is available before vi.mock calls) ────────

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
import {
  saveAsTemplate,
  applyTemplate,
  listTemplates,
  setBagMembers,
  createBag,
  deleteBag,
  bulkImport,
} from '../../../src/services/packingService';

// ── Lifecycle ─────────────────────────────────────────────────────────────────

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

// ── saveAsTemplate ────────────────────────────────────────────────────────────

describe('saveAsTemplate', () => {
  it('PACK-SVC-001: saves packing items as a template with correct categories and item count', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    testDb.prepare('INSERT INTO packing_items (trip_id, name, category, checked, sort_order) VALUES (?, ?, ?, 0, ?)').run(trip.id, 'Shirt', 'Clothes', 0);
    testDb.prepare('INSERT INTO packing_items (trip_id, name, category, checked, sort_order) VALUES (?, ?, ?, 0, ?)').run(trip.id, 'Shorts', 'Clothes', 1);
    testDb.prepare('INSERT INTO packing_items (trip_id, name, category, checked, sort_order) VALUES (?, ?, ?, 0, ?)').run(trip.id, 'Toothbrush', 'Toiletries', 2);

    const result = saveAsTemplate(trip.id, user.id, 'My Template');

    expect(result).not.toBeNull();
    expect(result!.name).toBe('My Template');
    expect(result!.categoryCount).toBe(2);
    expect(result!.itemCount).toBe(3);

    const template = testDb.prepare('SELECT * FROM packing_templates WHERE id = ?').get(result!.id) as any;
    expect(template).toBeDefined();
    expect(template.name).toBe('My Template');
    expect(template.created_by).toBe(user.id);
  });

  it('PACK-SVC-002: returns null when trip has no packing items', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const result = saveAsTemplate(trip.id, user.id, 'Empty');

    expect(result).toBeNull();
  });
});

// ── listTemplates ───────────────────────────────────────────────────────────────

describe('listTemplates', () => {
  it('PACK-SVC-LIST-001: returns templates with id, name and item_count', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    testDb.prepare('INSERT INTO packing_items (trip_id, name, category, checked, sort_order) VALUES (?, ?, ?, 0, ?)').run(trip.id, 'Shirt', 'Clothes', 0);
    testDb.prepare('INSERT INTO packing_items (trip_id, name, category, checked, sort_order) VALUES (?, ?, ?, 0, ?)').run(trip.id, 'Toothbrush', 'Toiletries', 1);
    const saved = saveAsTemplate(trip.id, user.id, 'Weekend');

    const templates = listTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ id: saved!.id, name: 'Weekend', item_count: 2 });
  });

  it('PACK-SVC-LIST-002: returns an empty array when no templates exist', () => {
    expect(listTemplates()).toEqual([]);
  });
});

// ── applyTemplate ─────────────────────────────────────────────────────────────

describe('applyTemplate', () => {
  it('PACK-SVC-003: adds template items to a trip packing list', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    // Insert a template with one category and two items directly
    const templateResult = testDb.prepare('INSERT INTO packing_templates (name, created_by) VALUES (?, ?)').run('Camping', user.id);
    const templateId = templateResult.lastInsertRowid as number;

    const catResult = testDb.prepare('INSERT INTO packing_template_categories (template_id, name, sort_order) VALUES (?, ?, ?)').run(templateId, 'Gear', 0);
    const catId = catResult.lastInsertRowid as number;

    testDb.prepare('INSERT INTO packing_template_items (category_id, name, sort_order) VALUES (?, ?, ?)').run(catId, 'Tent', 0);
    testDb.prepare('INSERT INTO packing_template_items (category_id, name, sort_order) VALUES (?, ?, ?)').run(catId, 'Sleeping Bag', 1);

    const result = applyTemplate(trip.id, templateId);

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    expect((result as any[]).length).toBe(2);

    const items = testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ?').all(trip.id) as any[];
    expect(items.length).toBe(2);
    expect(items.map((i: any) => i.name)).toContain('Tent');
    expect(items.map((i: any) => i.name)).toContain('Sleeping Bag');
  });

  it('PACK-SVC-004: returns undefined when template has no items configured (distinct from null for a missing template, and from [] for a successful no-op apply)', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const templateResult = testDb.prepare('INSERT INTO packing_templates (name, created_by) VALUES (?, ?)').run('Empty Template', user.id);
    const templateId = templateResult.lastInsertRowid as number;

    const result = applyTemplate(trip.id, templateId);

    expect(result).toBeUndefined();
  });

  it('PACK-SVC-004b: returns null when the template does not exist at all', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const result = applyTemplate(trip.id, 999999);

    expect(result).toBeNull();
  });

  it('PACK-SVC-004c: applying the same template twice does not duplicate items already tagged to a traveler', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const traveler = testDb.prepare(
      'INSERT INTO travelers (managed_by_user_id, name, type) VALUES (?, ?, ?)'
    ).run(user.id, 'Lucy', 'child');

    const tpl = testDb.prepare('INSERT INTO packing_templates (name, created_by) VALUES (?, ?)').run('Beach', user.id);
    const templateId = tpl.lastInsertRowid as number;
    const cat = testDb.prepare('INSERT INTO packing_template_categories (template_id, name, sort_order) VALUES (?, ?, 0)').run(templateId, 'Clothes');
    testDb.prepare('INSERT INTO packing_template_items (category_id, name, sort_order) VALUES (?, ?, 0)').run(cat.lastInsertRowid, 'Sunscreen');

    const first = applyTemplate(trip.id, templateId, [traveler.lastInsertRowid as number]);
    expect(first.length).toBe(1);

    const second = applyTemplate(trip.id, templateId, [traveler.lastInsertRowid as number]);
    expect(second.length).toBe(0);

    const rows = testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ? AND traveler_id = ?').all(trip.id, traveler.lastInsertRowid);
    expect(rows.length).toBe(1);
  });

  it('PACK-SVC-004d: re-applying with an additional traveler adds only the new traveler, skipping the one already tagged', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const lucy = testDb.prepare('INSERT INTO travelers (managed_by_user_id, name, type) VALUES (?, ?, ?)').run(user.id, 'Lucy', 'child');
    const alex = testDb.prepare('INSERT INTO travelers (managed_by_user_id, name, type) VALUES (?, ?, ?)').run(user.id, 'Alex', 'adult');

    const tpl = testDb.prepare('INSERT INTO packing_templates (name, created_by) VALUES (?, ?)').run('Beach', user.id);
    const templateId = tpl.lastInsertRowid as number;
    const cat = testDb.prepare('INSERT INTO packing_template_categories (template_id, name, sort_order) VALUES (?, ?, 0)').run(templateId, 'Clothes');
    testDb.prepare('INSERT INTO packing_template_items (category_id, name, sort_order) VALUES (?, ?, 0)').run(cat.lastInsertRowid, 'Sunscreen');

    const first = applyTemplate(trip.id, templateId, [lucy.lastInsertRowid as number]);
    expect(first.length).toBe(1);

    // Re-apply with both travelers: Lucy already has it (skip), Alex is new (add).
    const second = applyTemplate(trip.id, templateId, [lucy.lastInsertRowid as number, alex.lastInsertRowid as number]);
    expect(second.length).toBe(1);
    expect((second[0] as { traveler_id: number }).traveler_id).toBe(alex.lastInsertRowid);

    const lucyRows = testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ? AND traveler_id = ?').all(trip.id, lucy.lastInsertRowid);
    const alexRows = testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ? AND traveler_id = ?').all(trip.id, alex.lastInsertRowid);
    expect(lucyRows.length).toBe(1);
    expect(alexRows.length).toBe(1);
  });
});

// ── createBag / deleteBag ─────────────────────────────────────────────────────

describe('createBag / deleteBag', () => {
  it('PACK-SVC-005: createBag inserts a bag and returns it', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const result = createBag(trip.id, { name: 'Carry-On', color: '#ff0000' }) as any;

    expect(result).not.toBeNull();
    expect(result.name).toBe('Carry-On');
    expect(result.color).toBe('#ff0000');
    expect(result.trip_id).toBe(trip.id);

    const bag = testDb.prepare('SELECT * FROM packing_bags WHERE id = ?').get(result.id) as any;
    expect(bag).toBeDefined();
    expect(bag.name).toBe('Carry-On');
  });

  it('PACK-SVC-006: deleteBag removes the bag and returns true', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const bag = createBag(trip.id, { name: 'Checked Bag' }) as any;
    expect(bag).not.toBeNull();

    const deleted = deleteBag(trip.id, bag.id);

    expect(deleted).toBe(true);

    const row = testDb.prepare('SELECT * FROM packing_bags WHERE id = ?').get(bag.id);
    expect(row).toBeUndefined();
  });

  it('PACK-SVC-007: deleteBag returns false for non-existent bag', () => {
    const result = deleteBag(1, 99999);

    expect(result).toBe(false);
  });
});

// ── setBagMembers ─────────────────────────────────────────────────────────────

describe('setBagMembers', () => {
  it('PACK-SVC-008: sets bag members (replaces existing)', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const bag = createBag(trip.id, { name: 'Main Bag' }) as any;

    const result = setBagMembers(trip.id, bag.id, [user.id]) as any[];

    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].user_id).toBe(user.id);
  });

  it('PACK-SVC-009: setBagMembers with empty array clears all members', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);
    const bag = createBag(trip.id, { name: 'Main Bag' }) as any;

    // First add a member
    setBagMembers(trip.id, bag.id, [user.id]);

    // Then clear
    const result = setBagMembers(trip.id, bag.id, []) as any[];

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('PACK-SVC-010: setBagMembers returns null for non-existent bag', () => {
    const result = setBagMembers(1, 99999, []);

    expect(result).toBeNull();
  });
});

// ── bulkImport with bag field ─────────────────────────────────────────────────

describe('bulkImport with bag field', () => {
  it('PACK-SVC-011: bulk import with bag field creates the bag if it does not exist', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const result = bulkImport(trip.id, [{ name: 'Shirt', bag: 'Carry-On' }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeDefined();

    const bags = testDb.prepare('SELECT * FROM packing_bags WHERE trip_id = ? AND name = ?').all(trip.id, 'Carry-On') as any[];
    expect(bags).toHaveLength(1);

    const items = testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ?').all(trip.id) as any[];
    expect(items).toHaveLength(1);
    expect(items[0].bag_id).toBe(bags[0].id);
  });

  it('PACK-SVC-012: bulk import with same bag name reuses existing bag', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    const result = bulkImport(trip.id, [
      { name: 'Shirt', bag: 'Carry-On' },
      { name: 'Pants', bag: 'Carry-On' },
    ]);

    expect(result).toHaveLength(2);

    const bags = testDb.prepare('SELECT * FROM packing_bags WHERE trip_id = ? AND name = ?').all(trip.id, 'Carry-On') as any[];
    expect(bags).toHaveLength(1);

    const items = testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ?').all(trip.id) as any[];
    expect(items).toHaveLength(2);
    expect(items[0].bag_id).toBe(bags[0].id);
    expect(items[1].bag_id).toBe(bags[0].id);
  });
});

// ── bulkImport with quantity field ────────────────────────────────────────────

describe('bulkImport with quantity field', () => {
  it('PACK-SVC-013: bulk import respects per-item quantity, defaults to 1, and clamps out-of-range', () => {
    const { user } = createUser(testDb);
    const trip = createTrip(testDb, user.id);

    bulkImport(trip.id, [
      { name: 'Socks', quantity: 5 },
      { name: 'Toothbrush' },
      { name: 'Batteries', quantity: 9999 },
      { name: 'Charger', quantity: 0 },
    ]);

    const byName = (n: string) =>
      testDb.prepare('SELECT * FROM packing_items WHERE trip_id = ? AND name = ?').get(trip.id, n) as any;

    expect(byName('Socks').quantity).toBe(5);
    expect(byName('Toothbrush').quantity).toBe(1);
    expect(byName('Batteries').quantity).toBe(999);
    expect(byName('Charger').quantity).toBe(1);
  });
});
