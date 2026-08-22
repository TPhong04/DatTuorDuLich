import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'

import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

import { listVehiclesQueryDto, createVehicleDto, updateVehicleDto } from './dto'
import { VehiclesService } from './vehicles.service'
import { VehicleClass, VehicleType, VehicleStatus, VEHICLE_CLASS_LABELS, VEHICLE_TYPE_LABELS } from './vehicle.schema'

@ApiTags('Admin Vehicles')
@ApiBearerAuth('bearerJwt')
@Controller('admin/vehicles')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminVehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  vehicleItem(v: any, includeBookingHistory: boolean = false) {
    const rawClass: unknown = v.vehicleClass
    const safeClass: VehicleClass =
      rawClass && typeof rawClass === 'string' &&
      ['seat', 'sleeper', 'limousine', 'cabin'].includes(rawClass as VehicleClass)
        ? (rawClass as VehicleClass)
        : 'seat'
    const base = {
      id: String(v._id ?? v.id),
      licensePlate: v.licensePlate,
      vehicleType: v.vehicleType as VehicleType,
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
      status: v.status as VehicleStatus,
      statusReason: v.statusReason ?? null,
      notes: v.notes ?? null,
      bookingHistoryIds: Array.isArray(v.bookingHistoryIds)
        ? v.bookingHistoryIds.map((x: any) => String(typeof x === 'object' && x ? x._id ?? x.id ?? x : x))
        : [],
      createdAt: v.createdAt ? new Date(v.createdAt).toISOString() : null,
      updatedAt: v.updatedAt ? new Date(v.updatedAt).toISOString() : null,
    }
    if (includeBookingHistory && Array.isArray((v as any).bookingHistoryIds)) {
      ;(base as any).bookingHistory = (v as any).bookingHistoryIds
        .filter((x: any) => x && typeof x === 'object')
        .map((b: any) => ({
          id: String(b._id ?? b.id),
          code: b.code ?? null,
          departureDate: b.departureDate ? new Date(b.departureDate).toISOString() : null,
          status: String(b.status ?? 'pending'),
        }))
    }
    return base
  }

  @Get()
  async list(@Query() query: unknown) {
    const parsed = listVehiclesQueryDto.safeParse(query)
    if (!parsed.success) {
      return { page: 1, limit: 50, total: 0, items: [] }
    }
    const res = await this.vehicles.listAdmin(parsed.data)
    return {
      page: res.page,
      limit: res.limit,
      total: res.total,
      items: res.items.map((v: any) => this.vehicleItem(v, true)),
    }
  }

  @Get('/simple')
  async listSimple(@Query('status') status?: string, @Query('vehicleType') vehicleType?: string, @Query('vehicleClass') vehicleClass?: string) {
    const statusVal = status && ['available', 'in_trip', 'maintenance', 'repairing', 'damaged', 'out_of_service'].includes(status as VehicleStatus) ? (status as VehicleStatus) : null
    const typeVal = vehicleType && ['seater_4', 'seater_7', 'seater_16', 'seater_29', 'seater_45'].includes(vehicleType as VehicleType) ? (vehicleType as VehicleType) : null
    const classVal = vehicleClass && ['seat', 'sleeper', 'limousine', 'cabin'].includes(vehicleClass as VehicleClass) ? (vehicleClass as VehicleClass) : null
    const items = await this.vehicles.listSimple(statusVal, typeVal, classVal)
    return {
      items: items.map((v: any) => {
        const cls: VehicleClass = v.vehicleClass && ['seat', 'sleeper', 'limousine', 'cabin'].includes(v.vehicleClass as VehicleClass) ? (v.vehicleClass as VehicleClass) : 'seat'
        return {
          id: String(v._id ?? v.id),
          licensePlate: v.licensePlate,
          vehicleType: v.vehicleType as VehicleType,
          vehicleClass: cls,
          vehicleClassLabel: VEHICLE_CLASS_LABELS[cls],
          brand: v.brand ?? null,
          color: v.color ?? null,
          status: v.status as VehicleStatus,
          rentalPricePerDayVnd: Number(v.rentalPricePerDayVnd) || 0,
        }
      }),
    }
  }

  @Get('/dashboard-stats')
  async dashboardStats() {
    const res = await this.vehicles.aggregateDashboardStats()
    return {
      total: res.total,
      byType: res.byType.map((r) => ({ ...r, label: (VEHICLE_TYPE_LABELS as any)[r.type] ?? r.label })),
      byClass: res.byClass.map((r) => ({ ...r, label: (VEHICLE_CLASS_LABELS as any)[r.class] ?? r.label })),
      byStatus: res.byStatus,
    }
  }

  @Get('/:id')
  async getById(@Param('id') id: string) {
    const doc = await this.vehicles.findById(id)
    if (!doc) throw new NotFoundException('Xe không tồn tại')
    return this.vehicleItem(doc, true)
  }

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createVehicleDto.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues?.[0]
      throw new Error(
        'Dữ liệu không hợp lệ: ' + (first ? `${first.path.join('.')}: ${first.message}` : 'invalid payload'),
      )
    }
    const doc = await this.vehicles.create(parsed.data)
    return this.vehicleItem(doc)
  }

  @Patch('/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateVehicleDto.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues?.[0]
      throw new Error(
        'Dữ liệu không hợp lệ: ' + (first ? `${first.path.join('.')}: ${first.message}` : 'invalid payload'),
      )
    }
    const doc = await this.vehicles.update(id, parsed.data)
    return this.vehicleItem(doc)
  }

  @Delete('/:id')
  async remove(@Param('id') id: string) {
    await this.vehicles.remove(id)
    return { ok: true as const }
  }
}
