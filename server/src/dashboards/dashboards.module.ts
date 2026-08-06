import { Module } from '@nestjs/common'

import { BookingsModule } from '../bookings/bookings.module'
import { ToursModule } from '../tours/tours.module'
import { AdminDashboardController } from './admin-dashboard.controller'
import { DashboardsService } from './dashboards.service'
import { StaffDashboardController } from './staff-dashboard.controller'

@Module({
  imports: [BookingsModule, ToursModule],
  controllers: [AdminDashboardController, StaffDashboardController],
  providers: [DashboardsService],
  exports: [DashboardsService],
})
export class DashboardsModule {}
