import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import {
  VehicleHandover,
  VehicleHandoverSchema,
  VehicleInquiry,
  VehicleInquirySchema,
  VehicleQuotation,
  VehicleQuotationSchema,
  VehicleRentalContract,
  VehicleRentalContractSchema,
  VehicleSettlement,
  VehicleSettlementSchema,
} from './rentals.schema'
import { Vehicle, VehicleSchema } from '../vehicles/vehicle.schema'
import { NotificationsModule } from '../notifications/notifications.module'
import { RentalsService } from './rentals.service'
import { PublicRentalsController } from './public-rentals.controller'
import { AdminRentalsController } from './admin-rentals.controller'
import { StaffRentalsController } from './staff-rentals.controller'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VehicleInquiry.name, schema: VehicleInquirySchema },
      { name: VehicleQuotation.name, schema: VehicleQuotationSchema },
      { name: VehicleRentalContract.name, schema: VehicleRentalContractSchema },
      { name: VehicleHandover.name, schema: VehicleHandoverSchema },
      { name: VehicleSettlement.name, schema: VehicleSettlementSchema },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [AdminRentalsController, StaffRentalsController, PublicRentalsController],
  providers: [RentalsService],
  exports: [RentalsService, MongooseModule],
})
export class RentalsModule {}
