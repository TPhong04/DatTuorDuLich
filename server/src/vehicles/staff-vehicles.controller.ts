import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

import { listVehiclesQueryDto } from './dto'
import { VehiclesService } from './vehicles.service'
import {
  VehicleClass,
  VEHICLE_CLASSES,
  VEHICLE_CLASS_LABELS,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
} from './vehicle.schema'

@ApiTags('Staff Vehicles')
@ApiBearerAuth('bearerJwt')
@Controller('staff/vehicles')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff', 'admin')
export class StaffVehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  vehicleItem(v: any) {
    const rawClass: unknown = v.vehicleClass
    const safeClass: VehicleClass =
      rawClass && typeof rawClass === 'string' &&
      ['seat', 'sleeper', 'limousine', 'cabin'].includes(rawClass as VehicleClass)
        ? (rawClass as VehicleClass)
        : 'seat'
    return {
      id: String(v._id ?? v.id),
      licensePlate: v.licensePlate,
      vehicleType: v.vehicleType,
      vehicleClass: safeClass,
      vehicleClassLabel: VEHICLE_CLASS_LABELS[safeClass],
      brand: v.brand ?? null,
      color: v.color ?? null,
      manufactureYear: typeof v.manufactureYear === 'number' ? v.manufactureYear : (v.manufactureYear ?? null),
      mileageKm: Number(v.mileageKm) || 0,
      nextMaintenanceDate: v.nextMaintenanceDate ? new Date(v.nextMaintenanceDate).toISOString() : null,
      rentalPricePerDayVnd: Number(v.rentalPricePerDayVnd) || 0,
      rentalSelfDrivePricePerDayVnd: Number(v.rentalSelfDrivePricePerDayVnd) || 0,
      seatCount: (typeof v.seatCount === 'number' && v.seatCount > 0) ? v.seatCount : null,
      publicDisplayName: v.publicDisplayName ?? null,
      publicSuitability: v.publicSuitability ?? null,
      showInPublicOptions: typeof v.showInPublicOptions === 'boolean' ? v.showInPublicOptions : true,
      status: v.status,
      statusReason: v.statusReason ?? null,
      notes: v.notes ?? null,
      createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : null,
      updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : null,
    }
  }

  @Get()
  async list(@Query() query: unknown) {
    const parsed = listVehiclesQueryDto.safeParse(query)
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '))
    }
    const res = await this.vehicles.listAdmin(parsed.data)
    return {
      page: res.page,
      limit: res.limit,
      total: res.total,
      items: res.items.map((v: any) => this.vehicleItem(v)),
    }
  }

  @Get('/meta')
  async meta() {
    return {
      types: VEHICLE_TYPES.map((t) => ({
        value: t,
        label: (VEHICLE_TYPE_LABELS as any)[t] ?? t,
      })),
      classes: VEHICLE_CLASSES.map((c) => ({
        value: c,
        label: (VEHICLE_CLASS_LABELS as any)[c] ?? c,
      })),
      statuses: VEHICLE_STATUSES,
    }
  }

  @Get('/simple')
  async listSimple(
    @Query('status') status?: string,
    @Query('vehicleType') vehicleType?: string,
    @Query('vehicleClass') vehicleClass?: string,
  ) {
    const statusVal = status && VEHICLE_STATUSES.includes(status as any) ? (status as any) : null
    const typeVal = vehicleType && VEHICLE_TYPES.includes(vehicleType as any) ? (vehicleType as any) : null
    const classVal = vehicleClass && VEHICLE_CLASSES.includes(vehicleClass as any) ? (vehicleClass as any) : null
    const items = await this.vehicles.listSimple(statusVal, typeVal, classVal)
    return {
      items: items.map((v: any) => this.vehicleItem(v)),
    }
  }

  @Get('/:id')
  async getById(@Param('id') id: string) {
    const doc = await this.vehicles.findById(id)
    return this.vehicleItem(doc)
  }
}
