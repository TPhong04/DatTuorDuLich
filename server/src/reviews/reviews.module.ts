import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ScheduleModule } from '@nestjs/schedule'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { Booking, BookingSchema } from '../bookings/booking.schema'
import { Tour, TourSchema } from '../tours/tour.schema'
import { User, UserSchema } from '../users/user.schema'
import { Review, ReviewSchema } from './review.schema'
import { ReviewsService } from './reviews.service'
import { PublicReviewsController } from './public-reviews.controller'
import { AdminReviewsController } from './admin-reviews.controller'
import { StaffReviewsController } from './staff-reviews.controller'

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Tour.name, schema: TourSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [PublicReviewsController, AdminReviewsController, StaffReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
