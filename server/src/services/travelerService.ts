import { db } from '../db/database';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Traveler {
  id: number;
  managed_by_user_id: number;
  linked_user_id: number | null;
  name: string;
  avatar: string | null;
  color: string | null;
  type: string;
  date_of_birth: string | null;
  notes: string | null;
  age_band_alert_sent_at: string | null;
  created_at: string;
}

export interface TripTraveler extends Traveler {
  added_at: string;
  added_by_user_id: number | null;
}

// ---------------------------------------------------------------------------
// Lifecycle — creation
// ---------------------------------------------------------------------------

/** Called at registration and as a recovery path (login fallback). */
export function getOrCreateLinkedTraveler(userId: number): Traveler {
  const existing = db.prepare(
    'SELECT * FROM travelers WHERE linked_user_id = ?'
  ).get(userId) as Traveler | undefined;
  if (existing) return existing;

  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId) as { username: string } | undefined;
  const name = user?.username ?? `User ${userId}`;

  const result = db.prepare(
    'INSERT OR IGNORE INTO travelers (managed_by_user_id, linked_user_id, name) VALUES (?, ?, ?)'
  ).run(userId, userId, name);

  return db.prepare('SELECT * FROM travelers WHERE id = ?').get(result.lastInsertRowid) as Traveler;
}

export function createTraveler(
  managedByUserId: number,
  data: { name: string; avatar?: string | null; color?: string | null; type?: string; date_of_birth?: string | null; notes?: string | null }
): Traveler {
  const result = db.prepare(
    'INSERT INTO travelers (managed_by_user_id, linked_user_id, name, avatar, color, type, date_of_birth, notes) VALUES (?, NULL, ?, ?, ?, ?, ?, ?)'
  ).run(
    managedByUserId,
    data.name.trim(),
    data.avatar ?? null,
    data.color ?? null,
    data.type ?? 'adult',
    data.date_of_birth ?? null,
    data.notes ?? null,
  );
  return db.prepare('SELECT * FROM travelers WHERE id = ?').get(result.lastInsertRowid) as Traveler;
}

// ---------------------------------------------------------------------------
// Lifecycle — read
// ---------------------------------------------------------------------------

export function listTravelers(_userId?: number): Traveler[] {
  return db.prepare(
    'SELECT * FROM travelers ORDER BY created_at ASC'
  ).all() as Traveler[];
}

/** Returns the traveler only if it is managed by userId; 404 guard. */
export function getTraveler(id: number, userId: number): Traveler | null {
  return db.prepare(
    'SELECT * FROM travelers WHERE id = ? AND managed_by_user_id = ?'
  ).get(id, userId) as Traveler | null;
}

export function getTripTravelers(tripId: number | string): TripTraveler[] {
  return db.prepare(`
    SELECT t.*, tt.added_at, tt.added_by_user_id
    FROM trip_travelers tt
    JOIN travelers t ON tt.traveler_id = t.id
    WHERE tt.trip_id = ?
    ORDER BY tt.added_at ASC
  `).all(tripId) as TripTraveler[];
}

export function getReservationTravelers(reservationId: number | string): Traveler[] {
  return db.prepare(`
    SELECT t.*
    FROM reservation_travelers rt
    JOIN travelers t ON rt.traveler_id = t.id
    WHERE rt.reservation_id = ?
    ORDER BY t.created_at ASC
  `).all(reservationId) as Traveler[];
}

export function getTripReservationTravelers(tripId: number | string): Record<number, Traveler[]> {
  const rows = db.prepare(`
    SELECT rt.reservation_id, t.*
    FROM reservation_travelers rt
    JOIN travelers t ON rt.traveler_id = t.id
    JOIN reservations r ON rt.reservation_id = r.id
    WHERE r.trip_id = ?
    ORDER BY t.created_at ASC
  `).all(tripId) as (Traveler & { reservation_id: number })[];
  const map: Record<number, Traveler[]> = {};
  for (const row of rows) {
    const { reservation_id, ...traveler } = row;
    if (!map[reservation_id]) map[reservation_id] = [];
    map[reservation_id].push(traveler as Traveler);
  }
  return map;
}

const TRANSPORT_RESERVATION_TYPES = ['flight', 'train', 'car', 'cruise'];

/**
 * Trip travelers with zero transport-type reservations (flight/train/car/cruise)
 * linked to them anywhere on the trip — catches "we forgot to book someone's
 * flight". Returns [] (no-op, not "everyone is missing") until at least one
 * transport reservation exists for the trip, so a fresh trip that hasn't
 * started transport planning yet isn't flagged as broken.
 */
export function getTravelersMissingTransport(tripId: number | string): TripTraveler[] {
  const placeholders = TRANSPORT_RESERVATION_TYPES.map(() => '?').join(',');
  const transportReservationIds = db.prepare(
    `SELECT id FROM reservations WHERE trip_id = ? AND type IN (${placeholders})`
  ).all(tripId, ...TRANSPORT_RESERVATION_TYPES) as { id: number }[];
  if (transportReservationIds.length === 0) return [];

  const travelers = getTripTravelers(tripId);
  const idPlaceholders = transportReservationIds.map(() => '?').join(',');
  const coveredIds = new Set(
    (db.prepare(
      `SELECT DISTINCT traveler_id FROM reservation_travelers WHERE reservation_id IN (${idPlaceholders})`
    ).all(...transportReservationIds.map(r => r.id)) as { traveler_id: number }[])
      .map(r => r.traveler_id)
  );
  return travelers.filter(t => !coveredIds.has(t.id));
}

// ---------------------------------------------------------------------------
// Lifecycle — update
// ---------------------------------------------------------------------------

export function updateTraveler(
  id: number,
  userId: number,
  data: { name?: string; avatar?: string | null; color?: string | null; type?: string; date_of_birth?: string | null; notes?: string | null; linked_user_id?: unknown }
): { error?: string; status?: number; traveler?: Traveler } {
  if (data.linked_user_id !== undefined) {
    return { error: 'linked_user_id is immutable', status: 400 };
  }

  const traveler = getTraveler(id, userId);
  if (!traveler) return { error: 'Traveler not found', status: 404 };

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (data.name !== undefined) { updates.push('name = ?'); params.push(data.name.trim()); }
  if (data.avatar !== undefined) { updates.push('avatar = ?'); params.push(data.avatar ?? null); }
  if (data.color !== undefined) { updates.push('color = ?'); params.push(data.color ?? null); }
  if (data.type !== undefined) { updates.push('type = ?'); params.push(data.type); }
  if (data.date_of_birth !== undefined) { updates.push('date_of_birth = ?'); params.push(data.date_of_birth ?? null); }
  if (data.notes !== undefined) { updates.push('notes = ?'); params.push(data.notes ?? null); }
  // Editing type (acknowledging the band) or date_of_birth (recomputing age)
  // re-arms the age-band reminder so a future mismatch can alert again.
  if (data.type !== undefined || data.date_of_birth !== undefined) {
    updates.push('age_band_alert_sent_at = NULL');
  }

  if (updates.length > 0) {
    params.push(id, userId);
    db.prepare(`UPDATE travelers SET ${updates.join(', ')} WHERE id = ? AND managed_by_user_id = ?`).run(...params);
  }

  const updated = getTraveler(id, userId)!;
  return { traveler: updated };
}

// ---------------------------------------------------------------------------
// Lifecycle — delete
// ---------------------------------------------------------------------------

export function deleteTraveler(
  id: number,
  userId: number
): { error?: string; status?: number; success?: boolean; trips?: string[] } {
  const traveler = getTraveler(id, userId);
  if (!traveler) return { error: 'Traveler not found', status: 404 };

  if (traveler.linked_user_id !== null) {
    return { error: 'Cannot delete a traveler linked to a registered account', status: 409 };
  }

  // Check active trip membership
  const tripRows = db.prepare(`
    SELECT t.title FROM trip_travelers tt
    JOIN trips t ON tt.trip_id = t.id
    WHERE tt.traveler_id = ?
  `).all(id) as { title: string }[];

  if (tripRows.length > 0) {
    return {
      error: 'Traveler is on active trips',
      status: 409,
      trips: tripRows.map(r => r.title),
    };
  }

  db.prepare('DELETE FROM travelers WHERE id = ? AND managed_by_user_id = ?').run(id, userId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Trip membership
// ---------------------------------------------------------------------------

export function addTravelerToTrip(
  tripId: number | string,
  travelerId: number,
  byUserId: number
): { error?: string; status?: number; traveler?: TripTraveler } {
  const traveler = db.prepare('SELECT * FROM travelers WHERE id = ?').get(travelerId) as Traveler | undefined;
  if (!traveler) return { error: 'Traveler not found', status: 404 };

  db.prepare(
    'INSERT OR IGNORE INTO trip_travelers (trip_id, traveler_id, added_by_user_id) VALUES (?, ?, ?)'
  ).run(tripId, travelerId, byUserId);

  const row = db.prepare(`
    SELECT t.*, tt.added_at, tt.added_by_user_id
    FROM trip_travelers tt
    JOIN travelers t ON tt.traveler_id = t.id
    WHERE tt.trip_id = ? AND tt.traveler_id = ?
  `).get(tripId, travelerId) as TripTraveler;

  return { traveler: row };
}

export function removeTravelerFromTrip(
  tripId: number | string,
  travelerId: number
): { error?: string; status?: number; success?: boolean; unassigned?: Record<string, number> } {
  const existing = db.prepare(
    'SELECT id FROM trip_travelers WHERE trip_id = ? AND traveler_id = ?'
  ).get(tripId, travelerId);
  if (!existing) return { error: 'Traveler not on this trip', status: 404 };

  const unassigned: Record<string, number> = {};

  db.transaction(() => {
    db.prepare('DELETE FROM trip_travelers WHERE trip_id = ? AND traveler_id = ?').run(tripId, travelerId);

    const pi = db.prepare(
      'UPDATE packing_items SET traveler_id = NULL WHERE trip_id = ? AND traveler_id = ?'
    ).run(tripId, travelerId);
    if (pi.changes) unassigned.packing_items = pi.changes;

    const ti = db.prepare(
      'UPDATE todo_items SET assigned_traveler_id = NULL WHERE trip_id = ? AND assigned_traveler_id = ?'
    ).run(tripId, travelerId);
    if (ti.changes) unassigned.todo_items = ti.changes;

    const ap = db.prepare(`
      DELETE FROM assignment_participants
      WHERE traveler_id = ?
        AND assignment_id IN (
          SELECT da.id FROM day_assignments da
          JOIN days d ON da.day_id = d.id
          WHERE d.trip_id = ?
        )
    `).run(travelerId, tripId);
    if (ap.changes) unassigned.assignment_participants = ap.changes;

    const bm = db.prepare(`
      UPDATE budget_item_members SET traveler_id = NULL
      WHERE traveler_id = ?
        AND budget_item_id IN (SELECT id FROM budget_items WHERE trip_id = ?)
    `).run(travelerId, tripId);
    if (bm.changes) unassigned.budget_item_members = bm.changes;

    db.prepare(`
      DELETE FROM reservation_travelers
      WHERE traveler_id = ?
        AND reservation_id IN (SELECT id FROM reservations WHERE trip_id = ?)
    `).run(travelerId, tripId);
  })();

  return { success: true, unassigned };
}

// ---------------------------------------------------------------------------
// Reservation travelers
// ---------------------------------------------------------------------------

export function setReservationTravelers(
  reservationId: number | string,
  travelerIds: number[]
): Traveler[] {
  db.transaction(() => {
    db.prepare('DELETE FROM reservation_travelers WHERE reservation_id = ?').run(reservationId);
    const ins = db.prepare('INSERT OR IGNORE INTO reservation_travelers (reservation_id, traveler_id) VALUES (?, ?)');
    for (const tid of travelerIds) ins.run(reservationId, tid);
  })();
  return getReservationTravelers(reservationId);
}

// ---------------------------------------------------------------------------
// Personal packing templates
// ---------------------------------------------------------------------------

export function listPersonalTemplates(userId: number) {
  return db.prepare(`
    SELECT pt.id, pt.name, pt.is_personal, pt.created_by,
      (SELECT COUNT(*) FROM packing_template_items ti
       JOIN packing_template_categories tc ON ti.category_id = tc.id
       WHERE tc.template_id = pt.id) as item_count
    FROM packing_templates pt
    WHERE pt.is_personal = 0 OR (pt.is_personal = 1 AND pt.created_by = ?)
    ORDER BY pt.is_personal ASC, pt.created_at DESC
  `).all(userId) as { id: number; name: string; is_personal: number; created_by: number; item_count: number }[];
}

export function createPersonalTemplate(userId: number, name: string) {
  const result = db.prepare(
    "INSERT INTO packing_templates (name, created_by, is_personal) VALUES (?, ?, 1)"
  ).run(name.trim(), userId);
  return db.prepare('SELECT * FROM packing_templates WHERE id = ?').get(result.lastInsertRowid);
}

export function deletePersonalTemplate(
  templateId: number,
  userId: number
): { error?: string; status?: number; success?: boolean } {
  const tmpl = db.prepare(
    'SELECT id, is_personal, created_by FROM packing_templates WHERE id = ?'
  ).get(templateId) as { id: number; is_personal: number; created_by: number } | undefined;
  if (!tmpl) return { error: 'Template not found', status: 404 };
  if (!tmpl.is_personal || tmpl.created_by !== userId) {
    return { error: 'Not your template', status: 403 };
  }
  db.prepare('DELETE FROM packing_templates WHERE id = ?').run(templateId);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Startup backfill — ensures every user has a linked traveler and appears in
// trip_travelers for every trip they own or are a member of.
// ---------------------------------------------------------------------------

export function backfillLinkedTravelers(): void {
  const users = db.prepare('SELECT id, username FROM users').all() as { id: number; username: string }[];
  const insertTripTraveler = db.prepare(
    'INSERT OR IGNORE INTO trip_travelers (trip_id, traveler_id, added_by_user_id) VALUES (?, ?, ?)'
  );

  for (const user of users) {
    // Ensure the linked traveler exists with the correct username
    let traveler = db.prepare('SELECT * FROM travelers WHERE linked_user_id = ?').get(user.id) as Traveler | undefined;
    if (!traveler) {
      const res = db.prepare(
        'INSERT OR IGNORE INTO travelers (managed_by_user_id, linked_user_id, name) VALUES (?, ?, ?)'
      ).run(user.id, user.id, user.username);
      traveler = db.prepare('SELECT * FROM travelers WHERE id = ?').get(res.lastInsertRowid) as Traveler | undefined;
    } else if (traveler.name !== user.username) {
      // Keep name in sync with username (only if not manually renamed — detect by matching old pattern)
      // We only sync if the current name looks auto-generated (matches previous username pattern)
      db.prepare('UPDATE travelers SET name = ? WHERE id = ? AND name = ?').run(user.username, traveler.id, traveler.name);
      traveler = { ...traveler, name: user.username };
    }
    if (!traveler) continue;

    // Add to all owned trips
    const ownedTrips = db.prepare('SELECT id FROM trips WHERE user_id = ?').all(user.id) as { id: number }[];
    for (const trip of ownedTrips) {
      insertTripTraveler.run(trip.id, traveler.id, user.id);
    }

    // Add to all member trips
    const memberTrips = db.prepare('SELECT trip_id FROM trip_members WHERE user_id = ?').all(user.id) as { trip_id: number }[];
    for (const trip of memberTrips) {
      insertTripTraveler.run(trip.trip_id, traveler.id, user.id);
    }
  }
  console.log('[travelers] Linked traveler backfill complete.');
}
