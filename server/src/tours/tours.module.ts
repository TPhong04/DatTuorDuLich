import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { User, UserSchema } from '../users/user.schema'
import { AdminToursController } from './admin-tours.controller'
import { Tour, TourSchema } from './tour.schema'
import { ToursController } from './tours.controller'
import { ToursService } from './tours.service'
import { TourDepartureNotifierService } from './tour-departure-notifier.service'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tour.name, schema: TourSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuditLogsModule,
  ],
  controllers: [ToursController, AdminToursController],
  providers: [ToursService, TourDepartureNotifierService],
  exports: [ToursService, MongooseModule, TourDepartureNotifierService],
})
export class ToursModule {}

