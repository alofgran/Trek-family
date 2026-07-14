import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { z } from 'zod';
import { canAccessTrip } from '../../db/database';
import { isDemoUser } from '../../services/authService';
import {
  listTravelers, getTraveler, createTraveler, updateTraveler, deleteTraveler,
  getTripTravelers, addTravelerToTrip, removeTravelerFromTrip,
  getReservationTravelers, setReservationTravelers,
} from '../../services/travelerService';
import { db } from '../../db/database';
import {
  safeBroadcast, TOOL_ANNOTATIONS_READONLY, TOOL_ANNOTATIONS_WRITE,
  TOOL_ANNOTATIONS_DELETE, TOOL_ANNOTATIONS_NON_IDEMPOTENT,
  demoDenied, noAccess, ok, permissionDenied,
} from './_shared';
import { canRead, canWrite } from '../scopes';
import { updateItem as updateTodoItem } from '../../services/todoService';
import { updateItem as updatePackingItem } from '../../services/packingService';

export function registerTravelerTools(server: McpServer, userId: number, scopes: string[] | null): void {
  const R = canRead(scopes, 'travelers');
  const W = canWrite(scopes, 'travelers');

  if (R) server.registerTool(
    'list_travelers',
    {
      description: "List the current user's global traveler roster (linked self + any non-linked companions they manage).",
      inputSchema: {},
      annotations: TOOL_ANNOTATIONS_READONLY,
    },
    async () => {
      const travelers = listTravelers(userId);
      return ok({ travelers });
    }
  );

  if (R) server.registerTool(
    'list_trip_travelers',
    {
      description: 'List all travelers assigned to a specific trip.',
      inputSchema: {
        tripId: z.number().int().positive(),
      },
      annotations: TOOL_ANNOTATIONS_READONLY,
    },
    async ({ tripId }) => {
      if (!canAccessTrip(tripId, userId)) return noAccess();
      const travelers = getTripTravelers(tripId);
      return ok({ travelers });
    }
  );

  if (W) server.registerTool(
    'add_traveler',
    {
      description: "Create a non-linked traveler (child, companion) in the user's roster. Does NOT add them to a trip — use add_traveler_to_trip for that.",
      inputSchema: {
        name: z.string().min(1).max(100).describe('Display name'),
        type: z.enum(['adult', 'teen', 'child', 'infant']).optional().describe('Traveler type (default: adult)'),
        avatar: z.string().max(10).optional().describe('Emoji or short avatar string'),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe('Hex color for avatar background'),
        date_of_birth: z.string().max(10).optional().describe('ISO date (YYYY-MM-DD), used for age-based packing suggestions'),
        notes: z.string().max(2000).optional().describe('Allergy/medical notes (e.g. "peanut allergy")'),
      },
      annotations: TOOL_ANNOTATIONS_NON_IDEMPOTENT,
    },
    async ({ name, type, avatar, color, date_of_birth, notes }) => {
      if (isDemoUser(userId)) return demoDenied();
      const traveler = createTraveler(userId, { name, type, avatar, color, date_of_birth, notes });
      return ok({ traveler });
    }
  );

  if (W) server.registerTool(
    'update_traveler',
    {
      description: "Update a traveler's profile. Linked travelers (linked_user_id is set) may have name/avatar/color/type updated but linked_user_id is immutable. Returns 404 if not owned.",
      inputSchema: {
        travelerId: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        type: z.enum(['adult', 'teen', 'child', 'infant']).optional(),
        avatar: z.string().max(10).nullable().optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
        date_of_birth: z.string().max(10).nullable().optional().describe('ISO date (YYYY-MM-DD)'),
        notes: z.string().max(2000).nullable().optional().describe('Allergy/medical notes'),
      },
      annotations: TOOL_ANNOTATIONS_WRITE,
    },
    async ({ travelerId, name, type, avatar, color, date_of_birth, notes }) => {
      if (isDemoUser(userId)) return demoDenied();
      const result = updateTraveler(travelerId, userId, { name, type, avatar, color, date_of_birth, notes });
      if (result.error) return { content: [{ type: 'text' as const, text: result.error }], isError: true };
      return ok({ traveler: result.traveler });
    }
  );

  if (W) server.registerTool(
    'delete_traveler',
    {
      description: 'Delete a non-linked traveler from the roster. Returns an error if the traveler is linked (must be removed via account deletion) or is currently on a trip (must be removed from all trips first).',
      inputSchema: {
        travelerId: z.number().int().positive(),
      },
      annotations: TOOL_ANNOTATIONS_DELETE,
    },
    async ({ travelerId }) => {
      if (isDemoUser(userId)) return demoDenied();
      const result = deleteTraveler(travelerId, userId);
      if (result.error) return { content: [{ type: 'text' as const, text: result.error }], isError: true };
      return ok({ success: true });
    }
  );

  if (W) server.registerTool(
    'add_traveler_to_trip',
    {
      description: "Add a traveler from the user's roster to a trip. The traveler's managing user must be a trip member.",
      inputSchema: {
        tripId: z.number().int().positive(),
        travelerId: z.number().int().positive(),
      },
      annotations: TOOL_ANNOTATIONS_NON_IDEMPOTENT,
    },
    async ({ tripId, travelerId }) => {
      if (isDemoUser(userId)) return demoDenied();
      if (!canAccessTrip(tripId, userId)) return noAccess();
      const result = addTravelerToTrip(tripId, travelerId, userId);
      if (result.error) return { content: [{ type: 'text' as const, text: result.error }], isError: true };
      safeBroadcast(tripId, 'trip:travelers:updated', { action: 'added', travelerId });
      return ok({ success: true });
    }
  );

  if (W) server.registerTool(
    'remove_traveler_from_trip',
    {
      description: 'Remove a traveler from a trip. All trip-scoped references (packing, todos, assignments, budget, reservations) are cleared in a single transaction. Does NOT delete the traveler from the global roster.',
      inputSchema: {
        tripId: z.number().int().positive(),
        travelerId: z.number().int().positive(),
      },
      annotations: TOOL_ANNOTATIONS_DELETE,
    },
    async ({ tripId, travelerId }) => {
      if (isDemoUser(userId)) return demoDenied();
      if (!canAccessTrip(tripId, userId)) return noAccess();
      removeTravelerFromTrip(tripId, travelerId);
      safeBroadcast(tripId, 'trip:travelers:updated', { action: 'removed', travelerId });
      return ok({ success: true });
    }
  );

  if (W) server.registerTool(
    'set_reservation_travelers',
    {
      description: 'Replace the traveler list on a reservation/transport. Pass an empty array to clear all.',
      inputSchema: {
        reservationId: z.number().int().positive(),
        travelerIds: z.array(z.number().int().positive()).describe('Traveler IDs to assign to this reservation'),
      },
      annotations: TOOL_ANNOTATIONS_WRITE,
    },
    async ({ reservationId, travelerIds }) => {
      if (isDemoUser(userId)) return demoDenied();
      const res = db.prepare('SELECT trip_id FROM reservations WHERE id = ?').get(reservationId) as { trip_id: number } | undefined;
      if (!res || !canAccessTrip(res.trip_id, userId)) return noAccess();
      setReservationTravelers(reservationId, travelerIds);
      safeBroadcast(res.trip_id, 'reservation:travelers:updated', { reservationId, travelerIds });
      return ok({ success: true });
    }
  );

  if (W) server.registerTool(
    'assign_todo_traveler',
    {
      description: 'Assign (or clear) a traveler on a to-do item.',
      inputSchema: {
        tripId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        travelerId: z.number().int().positive().nullable().describe('Traveler ID to assign, or null to clear'),
      },
      annotations: TOOL_ANNOTATIONS_WRITE,
    },
    async ({ tripId, itemId, travelerId }) => {
      if (isDemoUser(userId)) return demoDenied();
      if (!canAccessTrip(tripId, userId)) return noAccess();
      const item = updateTodoItem(tripId, itemId, { assigned_traveler_id: travelerId ?? null }, ['assigned_traveler_id']);
      if (!item) return { content: [{ type: 'text' as const, text: 'Todo item not found.' }], isError: true };
      safeBroadcast(tripId, 'todo:updated', { item });
      return ok({ item });
    }
  );

  if (W) server.registerTool(
    'set_packing_item_traveler',
    {
      description: 'Tag or untag a packing item with a traveler.',
      inputSchema: {
        tripId: z.number().int().positive(),
        itemId: z.number().int().positive(),
        travelerId: z.number().int().positive().nullable().describe('Traveler ID to tag, or null to untag'),
      },
      annotations: TOOL_ANNOTATIONS_WRITE,
    },
    async ({ tripId, itemId, travelerId }) => {
      if (isDemoUser(userId)) return demoDenied();
      if (!canAccessTrip(tripId, userId)) return noAccess();
      const item = updatePackingItem(tripId, itemId, { traveler_id: travelerId ?? null } as any, ['traveler_id']);
      if (!item) return { content: [{ type: 'text' as const, text: 'Packing item not found.' }], isError: true };
      safeBroadcast(tripId, 'packing:updated', { item });
      return ok({ item });
    }
  );
}
