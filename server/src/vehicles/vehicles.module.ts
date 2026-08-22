import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AdminVehiclesController } from './admin-vehicles.controller'
import { StaffVehiclesController } from './staff-vehicles.controller'
import { Vehicle, VehicleSchema } from './vehicle.schema'
import { VehiclesService } from './vehicles.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Vehicle.name, schema: VehicleSchema }]), AuditLogsModule],
  controllers: [AdminVehiclesController, StaffVehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService, MongooseModule],
})
export class VehiclesModule {}
