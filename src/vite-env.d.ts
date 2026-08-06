/// <reference types="vite/client" />

import type { BookingPassenger } from '@/features/bookings/bookings'

type BookingStep2Contact = {
  name: string
  phone: string
  email: string
  address: string
}

type BookingStep2State = {
  contact: BookingStep2Contact
  notes: string
  passengers: BookingPassenger[]
}

declare global {
  interface Window {
    __booking_step2?: BookingStep2State
    __booking_step2_final?: BookingStep2State
  }
}

export {}
