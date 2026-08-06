import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { Booking, BookingSchema } from './booking.schema'
import { BookingsService } from './bookings.service'
import { TourBookingsController } from './tour-bookings.controller'
import { MeBookingsController } from './me-bookings.controller'
import { AdminBookingsController } from './admin-bookings.controller'
import { ToursModule } from '../tours/tours.module'

@Module({
  imports: [MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]), ToursModule],
  controllers: [TourBookingsController, MeBookingsController, AdminBookingsController],
  providers: [BookingsService],
  exports: [BookingsService, MongooseModule],
})
export class BookingsModule {}
