import { Module } from '@nestjs/common'

import { BookingsModule } from '../bookings/bookings.module'
import { ToursModule } from '../tours/tours.module'
import { UsersModule } from '../users/users.module'
import { AdminReportsController } from './admin-reports.controller'
import { ReportsService } from './reports.service'

@Module({
  imports: [BookingsModule, ToursModule, UsersModule],
  controllers: [AdminReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
