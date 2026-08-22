import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type VehicleDocument = HydratedDocument<Vehicle>

export const VEHICLE_TYPES = ['seater_4', 'seater_7', 'seater_16', 'seater_29', 'seater_45'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

export const VEHICLE_STATUSES = ['available', 'in_trip', 'maintenance', 'repairing', 'damaged', 'out_of_service'] as const
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

export const VEHICLE_CLASSES = ['seat', 'sleeper', 'limousine', 'cabin'] as const
export type VehicleClass = (typeof VEHICLE_CLASSES)[number]

export const VEHICLE_CLASS_LABELS: Record<VehicleClass, string> = {
  seat: 'Ghế ngồi',
  sleeper: 'Giường nằm',
  limousine: 'Limousine',
  cabin: 'Giường riêng (Cabin)',
}

export const VEHICLE_CLASS_TONES: Record<VehicleClass, string> = {
  seat: 'bg-sky-100 text-sky-800 ring-sky-200',
  sleeper: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  limousine: 'bg-amber-100 text-amber-800 ring-amber-200',
  cabin: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
}

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  seater_4: 'Xe 4 chỗ',
  seater_7: 'Xe 7 chỗ',
  seater_16: 'Xe 16 chỗ',
  seater_29: 'Xe 29 chỗ',
  seater_45: 'Xe 45 chỗ',
}

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: 'Sẵn sàng',
  in_trip: 'Đang phục vụ tour',
  maintenance: 'Bảo dưỡng',
  repairing: 'Sửa chữa',
  damaged: 'Hỏng - chờ thay thế',
  out_of_service: 'Ngừng hoạt động',
}

export const VEHICLE_TYPE_SEATS: Record<VehicleType, number> = {
  seater_4: 4,
  seater_7: 7,
  seater_16: 16,
  seater_29: 29,
  seater_45: 45,
}

export const VEHICLE_TYPE_SUITABILITY: Record<VehicleType, string> = {
  seater_4: 'Gia đình nhỏ, thuê cưới, đi thăm, nội thành',
  seater_7: 'Gia đình 4-6 người, nhóm bạn, đi chơi trong ngày',
  seater_16: 'Công ty, đoàn 10-14 người, team building, văn phòng',
  seater_29: 'Đoàn 20-25 khách, chuyến du lịch liên tỉnh 2-3 ngày',
  seater_45: 'Đoàn lớn 35-40 khách, tour đa tỉnh, đoàn thi đấu, trường học',
}

export const VEHICLE_CLASS_DESCRIPTIONS: Record<VehicleClass, string> = {
  seat: 'Xe ghế ngồi tiêu chuẩn, phù hợp ngắn ngày.',
  sleeper: 'Xe giường nằm, phù hợp hành trình đêm dài > 6h.',
  limousine: 'Limousine 9 chỗ, ghế massage, phòng riêng cho gia đình cao cấp.',
  cabin: 'Cabin giường riêng 2 người, có phòng tắm, tour cao cấp nhiều ngày.',
}

@Schema({ timestamps: true })
export class Vehicle {
  @Prop({ type: String, required: true, enum: VEHICLE_TYPES, index: true })
  vehicleType!: VehicleType

  @Prop({ type: String, required: true, enum: VEHICLE_CLASSES, default: 'seat', index: true })
  vehicleClass!: VehicleClass

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  licensePlate!: string

  @Prop({ type: String, default: null, trim: true })
  brand!: string | null

  @Prop({ type: String, default: null, trim: true })
  color!: string | null

  @Prop({ type: Number, default: null, min: 1980, max: 2100 })
  manufactureYear!: number | null

  @Prop({ type: Number, default: 0, min: 0 })
  mileageKm!: number

  @Prop({ type: Date, default: null })
  nextMaintenanceDate!: Date | null

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  rentalPricePerDayVnd!: number

  @Prop({ type: Number, default: 0, min: 0 })
  rentalSelfDrivePricePerDayVnd!: number

  @Prop({ type: Number, default: null, min: 1, max: 80 })
  seatCount!: number | null

  @Prop({ type: String, default: null, trim: true, maxlength: 160 })
  publicDisplayName!: string | null

  @Prop({ type: String, default: null, trim: true, maxlength: 400 })
  publicSuitability!: string | null

  @Prop({ type: Boolean, default: true, index: true })
  showInPublicOptions!: boolean

  @Prop({ type: String, required: true, enum: VEHICLE_STATUSES, default: 'available', index: true })
  status!: VehicleStatus

  @Prop({ type: String, default: null, trim: true })
  statusReason!: string | null

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Booking', index: true }],
    default: [],
  })
  bookingHistoryIds!: Types.ObjectId[]

  @Prop({ type: String, default: null, trim: true })
  notes!: string | null

  createdAt!: Date
  updatedAt!: Date
}

export const VehicleSchema = SchemaFactory.createForClass(Vehicle)
