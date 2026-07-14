import { Injectable } from '@nestjs/common';
import { broadcast } from '../../websocket';
import * as svc from '../../services/travelerService';

/** Thin Nest wrapper around travelerService. Ownership checks live in the service. */
@Injectable()
export class TravelersService {
  getOrCreateLinkedTraveler(userId: number) {
    return svc.getOrCreateLinkedTraveler(userId);
  }
  createTraveler(userId: number, data: Parameters<typeof svc.createTraveler>[1]) {
    return svc.createTraveler(userId, data);
  }
  listTravelers(userId: number) {
    return svc.listTravelers(userId);
  }
  getTraveler(id: number, userId: number) {
    return svc.getTraveler(id, userId);
  }
  updateTraveler(id: number, userId: number, data: Parameters<typeof svc.updateTraveler>[2]) {
    return svc.updateTraveler(id, userId, data);
  }
  deleteTraveler(id: number, userId: number) {
    return svc.deleteTraveler(id, userId);
  }
  getTripTravelers(tripId: number | string) {
    return svc.getTripTravelers(tripId);
  }
  addTravelerToTrip(tripId: number | string, travelerId: number, byUserId: number) {
    return svc.addTravelerToTrip(tripId, travelerId, byUserId);
  }
  removeTravelerFromTrip(tripId: number | string, travelerId: number) {
    return svc.removeTravelerFromTrip(tripId, travelerId);
  }
  getReservationTravelers(reservationId: number | string) {
    return svc.getReservationTravelers(reservationId);
  }
  setReservationTravelers(reservationId: number | string, travelerIds: number[]) {
    return svc.setReservationTravelers(reservationId, travelerIds);
  }
  getTripReservationTravelers(tripId: number | string) {
    return svc.getTripReservationTravelers(tripId);
  }
  listPersonalTemplates(userId: number) {
    return svc.listPersonalTemplates(userId);
  }
  createPersonalTemplate(userId: number, name: string) {
    return svc.createPersonalTemplate(userId, name);
  }
  deletePersonalTemplate(templateId: number, userId: number) {
    return svc.deletePersonalTemplate(templateId, userId);
  }
  broadcast(tripId: number | string, event: string, payload: Record<string, unknown>, socketId: string | undefined) {
    broadcast(String(tripId), event, payload, socketId);
  }
}
