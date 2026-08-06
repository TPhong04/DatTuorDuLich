import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AdminToursController } from './admin-tours.controller'
import { Tour, TourSchema } from './tour.schema'
import { ToursController } from './tours.controller'
import { ToursService } from './tours.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Tour.name, schema: TourSchema }]), AuditLogsModule],
  controllers: [ToursController, AdminToursController],
  providers: [ToursService],
  exports: [ToursService, MongooseModule],
})
export class ToursModule {}

