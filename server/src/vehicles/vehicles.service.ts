import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { CreateVehicleDto, ListVehiclesQueryDto, UpdateVehicleDto } from './dto'
import {
  Vehicle,
  VehicleDocument,
  VehicleStatus,
  VehicleType,
  VehicleClass,
  VEHICLE_TYPE_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_CLASS_LABELS,
} from './vehicle.schema'

function norm<T extends string | null | undefined>(v: T): T | null {
  if (typeof v === 'string') {
    const s = v.trim()
    return (s ? s : null) as any
  }
  return v ?? null
}

@Injectable()
export class VehiclesService {
  constructor(@InjectModel(Vehicle.name) private readonly vehicles: Model<VehicleDocument>) {}

  async listAdmin(query: ListVehiclesQueryDto) {
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.max(1, Number(query.limit) || 50)
    const skip = (page - 1) * limit
    const filter: Record<string, unknown> = {}
    if (query.vehicleType) filter.vehicleType = query.vehicleType
    if (query.vehicleClass) filter.vehicleClass = query.vehicleClass
    if (query.status) filter.status = query.status
    if (query.q) {
      const like = { $regex: String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [
        { licensePlate: like },
        { brand: like },
        { color: like },
        { notes: like },
      ]
    }
    const [total, items] = await Promise.all([
      this.vehicles.countDocuments(filter).exec(),
      this.vehicles
        .find(filter)
        .sort({ status: 1, vehicleClass: 1, vehicleType: 1, licensePlate: 1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'bookingHistoryIds', select: 'code departureDate createdAt status', options: { limit: 10 } })
        .exec(),
    ])
    return { page, limit, total, items }
  }

  async listSimple(
    filterByStatus?: VehicleStatus | null,
    filterByType?: VehicleType | null,
    filterByClass?: VehicleClass | null,
  ) {
    const f: Record<string, unknown> = {}
    if (filterByStatus) f.status = filterByStatus
    if (filterByType) f.vehicleType = filterByType
    if (filterByClass) f.vehicleClass = filterByClass
    return this.vehicles.find(f).sort({ vehicleClass: 1, vehicleType: 1, licensePlate: 1 }).select({ licensePlate: 1, vehicleType: 1, vehicleClass: 1, brand: 1, color: 1, status: 1, rentalPricePerDayVnd: 1 }).lean().exec()
  }

  async findById(id: string | Types.ObjectId) {
    const oid = typeof id === 'string' ? new Types.ObjectId(id) : id
    const doc = await this.vehicles.findById(oid).populate({ path: 'bookingHistoryIds', select: 'code departureDate createdAt status', options: { limit: 30 } }).exec()
    if (!doc) throw new NotFoundException('Xe không tồn tại')
    return doc
  }

  async create(input: CreateVehicleDto) {
    const licensePlate = norm(input.licensePlate)
    if (!licensePlate) throw new BadRequestException('Thiếu biển số xe')
    const existing = await this.vehicles.findOne({ licensePlate }).exec()
    if (existing) throw new BadRequestException('Biển số xe này đã tồn tại trong hệ thống')
    const doc = await this.vehicles.create({
      vehicleType: input.vehicleType,
      vehicleClass: input.vehicleClass ?? 'seat',
      licensePlate,
      brand: norm(input.brand),
      color: norm(input.color),
      manufactureYear: typeof input.manufactureYear === 'number' ? input.manufactureYear : (input.manufactureYear ?? null),
      mileageKm: Number(input.mileageKm) || 0,
      nextMaintenanceDate: input.nextMaintenanceDate ?? null,
      rentalPricePerDayVnd: Number(input.rentalPricePerDayVnd) || 0,
      rentalSelfDrivePricePerDayVnd: Number(input.rentalSelfDrivePricePerDayVnd) || 0,
      seatCount: (typeof input.seatCount === 'number' && input.seatCount > 0) ? input.seatCount : null,
      publicDisplayName: norm(input.publicDisplayName),
      publicSuitability: norm(input.publicSuitability),
      showInPublicOptions: input.showInPublicOptions ?? true,
      status: input.status ?? 'available',
      statusReason: norm(input.statusReason),
      notes: norm(input.notes),
      bookingHistoryIds: [],
    })
    return doc
  }

  async update(id: string | Types.ObjectId, patch: UpdateVehicleDto) {
    const oid = typeof id === 'string' ? new Types.ObjectId(id) : id
    const doc = await this.vehicles.findById(oid).exec()
    if (!doc) throw new NotFoundException('Xe không tồn tại')
    if (patch.licensePlate !== undefined) {
      const lp = norm(patch.licensePlate)
      if (!lp) throw new BadRequestException('Biển số không được để trống')
      if (lp !== doc.licensePlate) {
        const dup = await this.vehicles.findOne({ licensePlate: lp, _id: { $ne: oid } }).exec()
        if (dup) throw new BadRequestException('Biển số xe này đã tồn tại')
        doc.licensePlate = lp
      }
    }
    if (patch.vehicleType !== undefined) doc.vehicleType = patch.vehicleType as Vehicle['vehicleType']
    if (patch.vehicleClass !== undefined) doc.vehicleClass = patch.vehicleClass as Vehicle['vehicleClass']
    if (patch.brand !== undefined) doc.brand = norm(patch.brand)
    if (patch.color !== undefined) doc.color = norm(patch.color)
    if (patch.manufactureYear !== undefined) doc.manufactureYear = typeof patch.manufactureYear === 'number' ? patch.manufactureYear : (patch.manufactureYear ?? null)
    if (patch.mileageKm !== undefined) doc.mileageKm = Number(patch.mileageKm) || 0
    if (patch.nextMaintenanceDate !== undefined) doc.nextMaintenanceDate = patch.nextMaintenanceDate ?? null
    if (patch.rentalPricePerDayVnd !== undefined) doc.rentalPricePerDayVnd = Number(patch.rentalPricePerDayVnd) || 0
    if (patch.rentalSelfDrivePricePerDayVnd !== undefined) doc.rentalSelfDrivePricePerDayVnd = Number(patch.rentalSelfDrivePricePerDayVnd) || 0
    if (patch.seatCount !== undefined) doc.seatCount = (typeof patch.seatCount === 'number' && patch.seatCount > 0) ? patch.seatCount : null
    if (patch.publicDisplayName !== undefined) doc.publicDisplayName = norm(patch.publicDisplayName)
    if (patch.publicSuitability !== undefined) doc.publicSuitability = norm(patch.publicSuitability)
    if (patch.showInPublicOptions !== undefined) doc.showInPublicOptions = !!patch.showInPublicOptions
    if (patch.status !== undefined) doc.status = patch.status as Vehicle['status']
    if (patch.statusReason !== undefined) doc.statusReason = norm(patch.statusReason)
    if (patch.notes !== undefined) doc.notes = norm(patch.notes)
    await doc.save()
    return doc
  }

  async remove(id: string | Types.ObjectId) {
    const oid = typeof id === 'string' ? new Types.ObjectId(id) : id
    const doc = await this.vehicles.findById(oid).exec()
    if (!doc) throw new NotFoundException('Xe không tồn tại')
    if (doc.bookingHistoryIds && doc.bookingHistoryIds.length > 0) {
      throw new BadRequestException('Xe này đã từng phục vụ đơn đặt (có lịch sử), không thể xoá. Thay vào đó hãy đổi trạng thái thành "Ngừng hoạt động".')
    }
    await this.vehicles.deleteOne({ _id: oid }).exec()
    return doc
  }

  async pushBookingHistoryMany(vehicleIdsRaw: Array<string | Types.ObjectId>, bookingId: string | Types.ObjectId) {
    if (!vehicleIdsRaw || vehicleIdsRaw.length === 0) return
    const oids = vehicleIdsRaw.map((v) => (typeof v === 'string' ? new Types.ObjectId(v) : v))
    const bookingOid = typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId
    await this.vehicles.updateMany(
      { _id: { $in: oids } },
      { $addToSet: { bookingHistoryIds: bookingOid } },
    ).exec()
  }

  async aggregateDashboardStats() {
    const byType = await this.vehicles.aggregate<{ _id: VehicleType; count: number }>([
      { $group: { _id: '$vehicleType', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    const byClass = await this.vehicles.aggregate<{ _id: VehicleClass; count: number }>([
      { $group: { _id: '$vehicleClass', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    const byStatus = await this.vehicles.aggregate<{ _id: VehicleStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])
    const total = byType.reduce((s, r) => s + r.count, 0)
    return {
      total,
      byType: byType.map((r) => ({ type: r._id as VehicleType, label: VEHICLE_TYPE_LABELS[r._id as VehicleType] ?? r._id, count: r.count })),
      byClass: byClass.map((r) => ({ class: r._id as VehicleClass, label: VEHICLE_CLASS_LABELS[r._id as VehicleClass] ?? r._id, count: r.count })),
      byStatus: byStatus.map((r) => ({ status: r._id as VehicleStatus, label: VEHICLE_STATUS_LABELS[r._id as VehicleStatus] ?? r._id, count: r.count })),
    }
  }
}
