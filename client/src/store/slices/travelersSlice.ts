import { travelersApi } from '../../api/client'
import type { StoreApi } from 'zustand'
import type { TripStoreState } from '../tripStore'
import type { TripTraveler } from '../../types'

type SetState = StoreApi<TripStoreState>['setState']
type GetState = StoreApi<TripStoreState>['getState']

export interface TravelersSlice {
  tripTravelers: TripTraveler[]
  loadTripTravelers: (tripId: number | string) => Promise<void>
  addTripTravelerLocal: (traveler: TripTraveler) => void
  removeTripTravelerLocal: (travelerId: number) => void
}

export const createTravelersSlice = (set: SetState, _get: GetState): TravelersSlice => ({
  tripTravelers: [],

  loadTripTravelers: async (tripId) => {
    try {
      const data = await travelersApi.listForTrip(tripId)
      set({ tripTravelers: data.travelers })
    } catch (err: unknown) {
      console.error('Failed to load trip travelers:', err)
    }
  },

  addTripTravelerLocal: (traveler) => {
    set(state => ({
      tripTravelers: [...state.tripTravelers, traveler],
    }))
  },

  removeTripTravelerLocal: (travelerId) => {
    set(state => ({
      tripTravelers: state.tripTravelers.filter(t => t.id !== travelerId),
    }))
  },
})
