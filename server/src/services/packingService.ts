import { db } from '../db/database';
import { avatarUrl } from './authService';

const BAG_COLORS = ['#6366f1', '#ec4899', '#f97316', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444', '#f59e0b', '#3b82f6', '#84cc16', '#d946ef', '#14b8a6', '#f43f5e', '#a855f7', '#eab308', '#64748b'];

export { verifyTripAccess } from './tripAccess';

// ── Items ──────────────────────────────────────────────────────────────────

export function listItems(tripId: string | number) {
  return db.prepare(
    'SELECT * FROM packing_items WHERE trip_id = ? ORDER BY sort_order ASC, created_at ASC'
  ).all(tripId);
}

export function createItem(tripId: string | number, data: { name: string; category?: string; checked?: boolean; quantity?: number }) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM packing_items WHERE trip_id = ?').get(tripId) as { max: number | null };
  const sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;
  const qty = Math.max(1, Math.min(999, Number(data.quantity) || 1));

  const result = db.prepare(
    'INSERT INTO packing_items (trip_id, name, checked, category, sort_order, quantity) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(tripId, data.name, data.checked ? 1 : 0, data.category || 'Allgemein', sortOrder, qty);

  return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid);
}

export function updateItem(
  tripId: string | number,
  id: string | number,
  data: { name?: string; checked?: number; category?: string; weight_grams?: number | null; bag_id?: number | null; quantity?: number; traveler_id?: number | null },
  bodyKeys: string[]
) {
  const item = db.prepare('SELECT * FROM packing_items WHERE id = ? AND trip_id = ?').get(id, tripId);
  if (!item) return null;

  db.prepare(`
    UPDATE packing_items SET
      name = COALESCE(?, name),
      checked = CASE WHEN ? IS NOT NULL THEN ? ELSE checked END,
      category = COALESCE(?, category),
      weight_grams = CASE WHEN ? THEN ? ELSE weight_grams END,
      bag_id = CASE WHEN ? THEN ? ELSE bag_id END,
      quantity = CASE WHEN ? THEN ? ELSE quantity END,
      traveler_id = CASE WHEN ? THEN ? ELSE traveler_id END
    WHERE id = ?
  `).run(
    data.name || null,
    data.checked !== undefined ? 1 : null,
    data.checked ? 1 : 0,
    data.category || null,
    bodyKeys.includes('weight_grams') ? 1 : 0,
    data.weight_grams ?? null,
    bodyKeys.includes('bag_id') ? 1 : 0,
    data.bag_id ?? null,
    bodyKeys.includes('quantity') ? 1 : 0,
    data.quantity ? Math.max(1, Math.min(999, Number(data.quantity))) : 1,
    bodyKeys.includes('traveler_id') ? 1 : 0,
    data.traveler_id ?? null,
    id
  );

  return db.prepare('SELECT * FROM packing_items WHERE id = ?').get(id);
}

export function deleteItem(tripId: string | number, id: string | number) {
  const item = db.prepare('SELECT id FROM packing_items WHERE id = ? AND trip_id = ?').get(id, tripId);
  if (!item) return false;

  db.prepare('DELETE FROM packing_items WHERE id = ?').run(id);
  return true;
}

// ── Bulk Import ────────────────────────────────────────────────────────────

interface ImportItem {
  name?: string;
  checked?: boolean;
  category?: string;
  weight_grams?: string | number;
  bag?: string;
  quantity?: number;
}

export function bulkImport(tripId: string | number, items: ImportItem[]) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM packing_items WHERE trip_id = ?').get(tripId) as { max: number | null };
  let sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

  const stmt = db.prepare('INSERT INTO packing_items (trip_id, name, checked, category, weight_grams, bag_id, sort_order, quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const created: any[] = [];

  const insertAll = db.transaction(() => {
    for (const item of items) {
      if (!item.name?.trim()) continue;
      const checked = item.checked ? 1 : 0;
      const weight = item.weight_grams ? parseInt(String(item.weight_grams)) || null : null;

      // Resolve bag by name if provided
      let bagId = null;
      if (item.bag?.trim()) {
        const bagName = item.bag.trim();
        const existing = db.prepare('SELECT id FROM packing_bags WHERE trip_id = ? AND name = ?').get(tripId, bagName) as { id: number } | undefined;
        if (existing) {
          bagId = existing.id;
        } else {
          const bagCount = (db.prepare('SELECT COUNT(*) as c FROM packing_bags WHERE trip_id = ?').get(tripId) as { c: number }).c;
          const newBag = db.prepare('INSERT INTO packing_bags (trip_id, name, color) VALUES (?, ?, ?)').run(tripId, bagName, BAG_COLORS[bagCount % BAG_COLORS.length]);
          bagId = newBag.lastInsertRowid;
        }
      }

      const qty = Math.max(1, Math.min(999, Number(item.quantity) || 1));
      const result = stmt.run(tripId, item.name.trim(), checked, item.category?.trim() || 'Other', weight, bagId, sortOrder++, qty);
      created.push(db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid));
    }
  });

  insertAll();
  return created;
}

// ── Bags ───────────────────────────────────────────────────────────────────

export function listBags(tripId: string | number) {
  const bags = db.prepare('SELECT * FROM packing_bags WHERE trip_id = ? ORDER BY sort_order, id').all(tripId) as any[];
  const members = db.prepare(`
    SELECT bm.bag_id, bm.user_id, u.username, u.avatar
    FROM packing_bag_members bm
    JOIN users u ON bm.user_id = u.id
    JOIN packing_bags b ON bm.bag_id = b.id
    WHERE b.trip_id = ?
  `).all(tripId) as { bag_id: number; user_id: number; username: string; avatar: string | null }[];
  const membersByBag = new Map<number, typeof members>();
  for (const m of members) {
    if (!membersByBag.has(m.bag_id)) membersByBag.set(m.bag_id, []);
    membersByBag.get(m.bag_id)!.push(m);
  }
  return bags.map(b => ({
    ...b,
    members: (membersByBag.get(b.id) || []).map(m => ({ ...m, avatar: avatarUrl(m) })),
  }));
}

export function setBagMembers(tripId: string | number, bagId: string | number, userIds: number[]) {
  const bag = db.prepare('SELECT * FROM packing_bags WHERE id = ? AND trip_id = ?').get(bagId, tripId);
  if (!bag) return null;
  db.prepare('DELETE FROM packing_bag_members WHERE bag_id = ?').run(bagId);
  const ins = db.prepare('INSERT OR IGNORE INTO packing_bag_members (bag_id, user_id) VALUES (?, ?)');
  for (const uid of userIds) ins.run(bagId, uid);
  const rows = db.prepare(`
    SELECT bm.user_id, u.username, u.avatar
    FROM packing_bag_members bm JOIN users u ON bm.user_id = u.id
    WHERE bm.bag_id = ?
  `).all(bagId) as { user_id: number; username: string; avatar: string | null }[];
  return rows.map(m => ({ ...m, avatar: avatarUrl(m) }));
}

export function createBag(tripId: string | number, data: { name: string; color?: string }) {
  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM packing_bags WHERE trip_id = ?').get(tripId) as { max: number | null };
  const result = db.prepare('INSERT INTO packing_bags (trip_id, name, color, sort_order) VALUES (?, ?, ?, ?)').run(
    tripId, data.name.trim(), data.color || '#6366f1', (maxOrder.max ?? -1) + 1
  );
  return db.prepare('SELECT * FROM packing_bags WHERE id = ?').get(result.lastInsertRowid);
}

export function updateBag(
  tripId: string | number,
  bagId: string | number,
  data: { name?: string; color?: string; weight_limit_grams?: number | null; user_id?: number | null },
  bodyKeys?: string[]
) {
  const bag = db.prepare('SELECT * FROM packing_bags WHERE id = ? AND trip_id = ?').get(bagId, tripId);
  if (!bag) return null;

  db.prepare(`UPDATE packing_bags SET
    name = COALESCE(?, name),
    color = COALESCE(?, color),
    weight_limit_grams = ?,
    user_id = CASE WHEN ? THEN ? ELSE user_id END
    WHERE id = ?`).run(
    data.name?.trim() || null,
    data.color || null,
    data.weight_limit_grams ?? (bag as any).weight_limit_grams ?? null,
    bodyKeys?.includes('user_id') ? 1 : 0,
    data.user_id ?? null,
    bagId
  );
  return db.prepare('SELECT b.*, u.username as assigned_username FROM packing_bags b LEFT JOIN users u ON b.user_id = u.id WHERE b.id = ?').get(bagId);
}

export function deleteBag(tripId: string | number, bagId: string | number) {
  const bag = db.prepare('SELECT * FROM packing_bags WHERE id = ? AND trip_id = ?').get(bagId, tripId);
  if (!bag) return false;

  db.prepare('DELETE FROM packing_bags WHERE id = ?').run(bagId);
  return true;
}

// ── List Templates ─────────────────────────────────────────────────────────

/**
 * Read-only template list for trip members (name + item count). Returns
 * admin-managed global templates plus the requesting user's personal ones.
 * Management of admin templates stays under /api/admin/packing-templates.
 */
export function listTemplates(userId?: number) {
  const whereClause = userId !== undefined
    ? 'WHERE pt.is_personal = 0 OR (pt.is_personal = 1 AND pt.created_by = ?)'
    : 'WHERE pt.is_personal = 0 OR pt.is_personal IS NULL';
  const params = userId !== undefined ? [userId] : [];
  return db.prepare(`
    SELECT pt.id, pt.name, COALESCE(pt.is_personal, 0) as is_personal, pt.traveler_type,
      (SELECT COUNT(*) FROM packing_template_items ti JOIN packing_template_categories tc ON ti.category_id = tc.id WHERE tc.template_id = pt.id) as item_count
    FROM packing_templates pt
    ${whereClause}
    ORDER BY COALESCE(pt.is_personal, 0) ASC, pt.created_at DESC
  `).all(...params) as { id: number; name: string; is_personal: number; traveler_type: string | null; item_count: number }[];
}

// ── Apply Template ─────────────────────────────────────────────────────────

export function applyTemplate(tripId: string | number, templateId: string | number, travelerIds?: number[]) {
  const templateExists = db.prepare('SELECT 1 FROM packing_templates WHERE id = ?').get(templateId);
  if (!templateExists) return null;

  const templateItems = db.prepare(`
    SELECT ti.name, tc.name as category, ti.traveler_type
    FROM packing_template_items ti
    JOIN packing_template_categories tc ON ti.category_id = tc.id
    WHERE tc.template_id = ?
    ORDER BY tc.sort_order, ti.sort_order
  `).all(templateId) as { name: string; category: string; traveler_type: string | null }[];

  // undefined = "this template has no items configured" (a real config problem).
  // Distinct from an empty array below, which means the apply succeeded but
  // added nothing new because every (traveler, item) pair already existed —
  // re-applying an already-applied template is a valid no-op, not an error.
  if (templateItems.length === 0) return undefined;

  const maxOrder = db.prepare('SELECT MAX(sort_order) as max FROM packing_items WHERE trip_id = ?').get(tripId) as { max: number | null };
  let sortOrder = (maxOrder.max !== null ? maxOrder.max : -1) + 1;

  const added: any[] = [];

  if (travelerIds && travelerIds.length > 0) {
    // Insert once per traveler, tagging each item with that traveler. An item
    // pinned to a traveler_type (e.g. "diapers" → infant) is skipped for
    // travelers of a different age band, so one shared family template can
    // cover a mixed-age trip without dumping every item on everyone.
    //
    // Dedup by (traveler, item name): applying the same template twice, or two
    // different templates that both tag e.g. "sunscreen" to the same traveler,
    // must not produce two rows for that traveler on the merged item — that
    // showed up as the same person's chip appearing twice on one row.
    const existing = db.prepare(
      'SELECT LOWER(name) as name, traveler_id FROM packing_items WHERE trip_id = ? AND traveler_id IS NOT NULL'
    ).all(tripId) as { name: string; traveler_id: number }[];
    const existingPairs = new Set(existing.map(e => `${e.traveler_id}:${e.name}`));

    const insert = db.prepare('INSERT INTO packing_items (trip_id, name, checked, category, sort_order, traveler_id) VALUES (?, ?, 0, ?, ?, ?)');
    for (const travelerId of travelerIds) {
      const traveler = db.prepare('SELECT type FROM travelers WHERE id = ?').get(travelerId) as { type: string } | undefined;
      for (const ti of templateItems) {
        if (ti.traveler_type && ti.traveler_type !== traveler?.type) continue;
        const pairKey = `${travelerId}:${ti.name.toLowerCase()}`;
        if (existingPairs.has(pairKey)) continue;
        existingPairs.add(pairKey);
        const result = insert.run(tripId, ti.name, ti.category, sortOrder++, travelerId);
        added.push(db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid));
      }
    }
  } else {
    // Existing behavior: insert without traveler tag
    const insert = db.prepare('INSERT INTO packing_items (trip_id, name, checked, category, sort_order) VALUES (?, ?, 0, ?, ?)');
    for (const ti of templateItems) {
      const result = insert.run(tripId, ti.name, ti.category, sortOrder++);
      added.push(db.prepare('SELECT * FROM packing_items WHERE id = ?').get(result.lastInsertRowid));
    }
  }

  return added;
}

// ── Save as Template ──────────────────────────────────────────────────────

export function saveAsTemplate(tripId: string | number, userId: number, templateName: string) {
  const items = db.prepare(
    'SELECT name, category FROM packing_items WHERE trip_id = ? ORDER BY sort_order ASC'
  ).all(tripId) as { name: string; category: string }[];

  if (items.length === 0) return null;

  const result = db.prepare('INSERT INTO packing_templates (name, created_by) VALUES (?, ?)').run(templateName, userId);
  const templateId = result.lastInsertRowid;

  const categories = [...new Set(items.map(i => i.category || 'Other'))];
  const catIdMap = new Map<string, number | bigint>();

  for (let i = 0; i < categories.length; i++) {
    const catResult = db.prepare('INSERT INTO packing_template_categories (template_id, name, sort_order) VALUES (?, ?, ?)').run(templateId, categories[i], i);
    catIdMap.set(categories[i], catResult.lastInsertRowid);
  }

  const itemsByCategory = new Map<string, number>();
  for (const item of items) {
    const catId = catIdMap.get(item.category || 'Other')!;
    const order = itemsByCategory.get(item.category || 'Other') || 0;
    db.prepare('INSERT INTO packing_template_items (category_id, name, sort_order) VALUES (?, ?, ?)').run(catId, item.name, order);
    itemsByCategory.set(item.category || 'Other', order + 1);
  }

  return { id: Number(templateId), name: templateName, categoryCount: categories.length, itemCount: items.length };
}

// ── Category Assignees ─────────────────────────────────────────────────────

export function getCategoryAssignees(tripId: string | number) {
  const rows = db.prepare(`
    SELECT pca.category_name, pca.user_id, u.username, u.avatar
    FROM packing_category_assignees pca
    JOIN users u ON pca.user_id = u.id
    WHERE pca.trip_id = ?
  `).all(tripId);

  // Group by category
  const assignees: Record<string, { user_id: number; username: string; avatar: string | null }[]> = {};
  for (const row of rows as any[]) {
    if (!assignees[row.category_name]) assignees[row.category_name] = [];
    assignees[row.category_name].push({ user_id: row.user_id, username: row.username, avatar: avatarUrl(row) });
  }

  return assignees;
}

export function updateCategoryAssignees(tripId: string | number, categoryName: string, userIds: number[] | undefined) {
  db.prepare('DELETE FROM packing_category_assignees WHERE trip_id = ? AND category_name = ?').run(tripId, categoryName);

  if (Array.isArray(userIds) && userIds.length > 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO packing_category_assignees (trip_id, category_name, user_id) VALUES (?, ?, ?)');
    for (const uid of userIds) insert.run(tripId, categoryName, uid);
  }

  const updated = db.prepare(`
    SELECT pca.user_id, u.username, u.avatar
    FROM packing_category_assignees pca
    JOIN users u ON pca.user_id = u.id
    WHERE pca.trip_id = ? AND pca.category_name = ?
  `).all(tripId, categoryName) as { user_id: number; username: string; avatar: string | null }[];
  return updated.map(m => ({ ...m, avatar: avatarUrl(m) }));
}

// ── Reorder ────────────────────────────────────────────────────────────────

export function reorderItems(tripId: string | number, orderedIds: number[]) {
  const update = db.prepare('UPDATE packing_items SET sort_order = ? WHERE id = ? AND trip_id = ?');
  const updateMany = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => {
      update.run(index, id, tripId);
    });
  });
  updateMany(orderedIds);
}
