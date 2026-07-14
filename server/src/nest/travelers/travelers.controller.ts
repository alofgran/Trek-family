import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpException,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { User } from '../../types';
import { TravelersService } from './travelers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { canAccessTrip, db } from '../../db/database';

/**
 * Travelers domain — global roster + trip/reservation sub-resources.
 *
 * Auth pattern:
 *  - Global routes (/api/travelers): JwtAuthGuard only; ownership enforced in service.
 *  - Trip-scoped (/api/trips/:id/travelers): trip access verified here.
 *  - Reservation-scoped: reservation's trip_id used for access check.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class TravelersController {
  constructor(private readonly travelers: TravelersService) {}

  // ── helpers ──────────────────────────────────────────────────────────────

  private requireTrip(tripId: string, userId: number) {
    const trip = canAccessTrip(tripId, userId);
    if (!trip) throw new HttpException({ error: 'Trip not found' }, 404);
    return trip;
  }

  // ── Global roster ─────────────────────────────────────────────────────────

  @Get('api/travelers')
  listTravelers(@CurrentUser() user: User) {
    return { travelers: this.travelers.listTravelers(user.id) };
  }

  @Post('api/travelers')
  @HttpCode(201)
  createTraveler(
    @CurrentUser() user: User,
    @Body() body: { name?: string; avatar?: string | null; color?: string | null; type?: string; date_of_birth?: string | null; notes?: string | null },
  ) {
    if (!body.name?.trim()) throw new HttpException({ error: 'Name is required' }, 400);
    const traveler = this.travelers.createTraveler(user.id, {
      name: body.name,
      avatar: body.avatar,
      color: body.color,
      type: body.type,
      date_of_birth: body.date_of_birth,
      notes: body.notes,
    });
    return { traveler };
  }

  @Put('api/travelers/:id')
  updateTraveler(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const result = this.travelers.updateTraveler(Number(id), user.id, body);
    if (result.error) throw new HttpException({ error: result.error }, result.status ?? 400);
    return { traveler: result.traveler };
  }

  @Delete('api/travelers/:id')
  deleteTraveler(@CurrentUser() user: User, @Param('id') id: string) {
    const result = this.travelers.deleteTraveler(Number(id), user.id);
    if (result.error) throw new HttpException({ error: result.error, trips: result.trips }, result.status ?? 400);
    return { success: true };
  }

  // ── Trip-scoped travelers ─────────────────────────────────────────────────

  @Get('api/trips/:tripId/travelers')
  getTripTravelers(@CurrentUser() user: User, @Param('tripId') tripId: string) {
    this.requireTrip(tripId, user.id);
    return { travelers: this.travelers.getTripTravelers(Number(tripId)) };
  }

  @Post('api/trips/:tripId/travelers')
  @HttpCode(201)
  addTravelerToTrip(
    @CurrentUser() user: User,
    @Param('tripId') tripId: string,
    @Body('traveler_id') travelerId: unknown,
    @Headers('x-socket-id') socketId?: string,
  ) {
    this.requireTrip(tripId, user.id);
    if (!travelerId || typeof travelerId !== 'number') {
      throw new HttpException({ error: 'traveler_id is required' }, 400);
    }
    const result = this.travelers.addTravelerToTrip(Number(tripId), travelerId, user.id);
    if (result.error) throw new HttpException({ error: result.error }, result.status ?? 400);
    this.travelers.broadcast(tripId, 'trip:travelers:updated', {}, socketId);
    return { traveler: result.traveler };
  }

  @Delete('api/trips/:tripId/travelers/:travelerId')
  removeTravelerFromTrip(
    @CurrentUser() user: User,
    @Param('tripId') tripId: string,
    @Param('travelerId') travelerId: string,
    @Headers('x-socket-id') socketId?: string,
  ) {
    this.requireTrip(tripId, user.id);
    const result = this.travelers.removeTravelerFromTrip(Number(tripId), Number(travelerId));
    if (result.error) throw new HttpException({ error: result.error }, result.status ?? 400);
    this.travelers.broadcast(tripId, 'trip:travelers:updated', {}, socketId);
    return { success: true, unassigned: result.unassigned };
  }

  // ── Trip-scoped reservation travelers (batch) ─────────────────────────────

  @Get('api/trips/:tripId/reservation-travelers')
  getTripReservationTravelers(@CurrentUser() user: User, @Param('tripId') tripId: string) {
    this.requireTrip(tripId, user.id);
    return { travelers: this.travelers.getTripReservationTravelers(Number(tripId)) };
  }

  // ── Reservation travelers ─────────────────────────────────────────────────

  @Get('api/reservations/:resId/travelers')
  getReservationTravelers(
    @CurrentUser() user: User,
    @Param('resId') resId: string,
  ) {
    const res = db.prepare('SELECT trip_id FROM reservations WHERE id = ?').get(resId) as { trip_id: number } | undefined;
    if (!res) throw new HttpException({ error: 'Reservation not found' }, 404);
    this.requireTrip(String(res.trip_id), user.id);
    return { travelers: this.travelers.getReservationTravelers(resId) };
  }

  @Put('api/reservations/:resId/travelers')
  setReservationTravelers(
    @CurrentUser() user: User,
    @Param('resId') resId: string,
    @Body('traveler_ids') travelerIds: unknown,
    @Headers('x-socket-id') socketId?: string,
  ) {
    const res = db.prepare('SELECT trip_id FROM reservations WHERE id = ?').get(resId) as { trip_id: number } | undefined;
    if (!res) throw new HttpException({ error: 'Reservation not found' }, 404);
    this.requireTrip(String(res.trip_id), user.id);
    const ids = Array.isArray(travelerIds) ? travelerIds.filter(x => typeof x === 'number') : [];
    const travelers = this.travelers.setReservationTravelers(resId, ids);
    this.travelers.broadcast(String(res.trip_id), 'reservation:travelers:updated', { reservationId: Number(resId) }, socketId);
    return { travelers };
  }
}
