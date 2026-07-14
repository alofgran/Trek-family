import { db } from '../db/database';
import { AssignmentRow, Tag, Participant } from '../types';

interface TagRow extends Tag {
  place_id: number;
}

interface ParticipantRow {
  assignment_id: number;
  user_id: number | null;
  traveler_id: number | null;
  username: string | null;
  avatar: string | null;
  traveler_name: string | null;
  traveler_avatar: string | null;
}

/** Batch-load tags for multiple places in a single query, indexed by place ID. */
function loadTagsByPlaceIds(placeIds: number[], { compact }: { compact?: boolean } = {}): Record<number, Partial<Tag>[]> {
  const tagsByPlaceId: Record<number, Partial<Tag>[]> = {};
  if (placeIds.length > 0) {
    const placeholders = placeIds.map(() => '?').join(',');
    const allTags = db.prepare(`
      SELECT t.*, pt.place_id FROM tags t
      JOIN place_tags pt ON t.id = pt.tag_id
      WHERE pt.place_id IN (${placeholders})
    `).all(...placeIds) as TagRow[];

    for (const tag of allTags) {
      const pid = tag.place_id;
      if (!tagsByPlaceId[pid]) tagsByPlaceId[pid] = [];
      if (compact) {
        tagsByPlaceId[pid].push({ id: tag.id, name: tag.name, color: tag.color, created_at: tag.created_at });
      } else {
        const { place_id, ...rest } = tag;
        tagsByPlaceId[pid].push(rest);
      }
    }
  }
  return tagsByPlaceId;
}

/** Batch-load participants for multiple day-assignments in a single query, indexed by assignment ID. */
function loadParticipantsByAssignmentIds(assignmentIds: number[]): Record<number, Participant[]> {
  const participantsByAssignment: Record<number, Participant[]> = {};
  if (assignmentIds.length > 0) {
    const placeholders = assignmentIds.map(() => '?').join(',');
    const allParticipants = db.prepare(`
      SELECT ap.assignment_id, ap.user_id, ap.traveler_id, u.username, u.avatar,
             t.name as traveler_name, t.avatar as traveler_avatar
      FROM assignment_participants ap
      LEFT JOIN users u ON ap.user_id = u.id
      LEFT JOIN travelers t ON ap.traveler_id = t.id
      WHERE ap.assignment_id IN (${placeholders})
    `).all(...assignmentIds) as ParticipantRow[];
    for (const p of allParticipants) {
      if (!participantsByAssignment[p.assignment_id]) participantsByAssignment[p.assignment_id] = [];
      participantsByAssignment[p.assignment_id].push({
        user_id: p.user_id,
        traveler_id: p.traveler_id,
        username: p.username,
        avatar: p.avatar,
        traveler_name: p.traveler_name,
        traveler_avatar: p.traveler_avatar,
      });
    }
  }
  return participantsByAssignment;
}

/** Reshape a flat assignment+place DB row into the nested API response shape with embedded place, tags, and participants. */
function formatAssignmentWithPlace(a: AssignmentRow, tags: Partial<Tag>[], participants: Participant[]) {
  return {
    id: a.id,
    day_id: a.day_id,
    place_id: a.place_id,
    order_index: a.order_index,
    notes: a.notes,
    assignment_time: a.assignment_time ?? null,
    assignment_end_time: a.assignment_end_time ?? null,
    participants: participants || [],
    created_at: a.created_at,
    place: {
      id: a.place_id,
      name: a.place_name,
      description: a.place_description,
      lat: a.lat,
      lng: a.lng,
      address: a.address,
      category_id: a.category_id,
      price: a.price,
      currency: a.place_currency,
      place_time: a.place_time,
      end_time: a.end_time,
      duration_minutes: a.duration_minutes,
      notes: a.place_notes,
      image_url: a.image_url,
      transport_mode: a.transport_mode,
      google_place_id: a.google_place_id,
      google_ftid: a.google_ftid,
      website: a.website,
      phone: a.phone,
      category: a.category_id ? {
        id: a.category_id,
        name: a.category_name,
        color: a.category_color,
        icon: a.category_icon,
      } : null,
      tags: tags || [],
    }
  };
}

export { loadTagsByPlaceIds, loadParticipantsByAssignmentIds, formatAssignmentWithPlace };
