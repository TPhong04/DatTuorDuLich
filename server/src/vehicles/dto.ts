import { z } from 'zod'
import { VEHICLE_CLASSES, VEHICLE_STATUSES, VEHICLE_TYPES } from './vehicle.schema'

const dateDto = z
  .union([z.string().trim(), z.null(), z.date()])
  .transform((v) => {
    if (v === null || v === undefined) return null
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
    const s = String(v).trim()
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  })
  .refine((v) => v === null || v instanceof Date)

const vehicleTypeDto = z.enum([...VEHICLE_TYPES] as [string, ...string[]])
const vehicleStatusDto = z.enum([...VEHICLE_STATUSES] as [string, ...string[]])
const vehicleClassDto = z.enum([...VEHICLE_CLASSES] as [string, ...string[]])

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

export const listVehiclesQueryDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  vehicleType: z.preprocess(emptyToNull, vehicleTypeDto.nullable().optional()),
  vehicleClass: z.preprocess(emptyToNull, vehicleClassDto.nullable().optional()),
  status: z.preprocess(emptyToNull, vehicleStatusDto.nullable().optional()),
  q: z.preprocess(emptyToNull, z.string().trim().min(1).max(100).nullable().optional()),
})
export type ListVehiclesQueryDto = z.infer<typeof listVehiclesQueryDto>

export const createVehicleDto = z.object({
  vehicleType: vehicleTypeDto,
  vehicleClass: vehicleClassDto.default('seat'),
  licensePlate: z.string().trim().min(3).max(20),
  brand: z.preprocess(emptyToNull, z.string().trim().min(1).max(120).nullable().optional()),
  color: z.preprocess(emptyToNull, z.string().trim().min(1).max(60).nullable().optional()),
  manufactureYear: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(1980).max(2100).nullable().optional(),
  ),
  mileageKm: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(10_000_000).nullable().optional(),
  ).default(0),
  nextMaintenanceDate: dateDto.nullable().optional(),
  rentalPricePerDayVnd: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional(),
  ).default(0),
  rentalSelfDrivePricePerDayVnd: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional(),
  ).default(0),
  seatCount: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(1).max(80).nullable().optional(),
  ),
  publicDisplayName: z.preprocess(emptyToNull, z.string().trim().min(1).max(160).nullable().optional()),
  publicSuitability: z.preprocess(emptyToNull, z.string().trim().min(1).max(400).nullable().optional()),
  showInPublicOptions: z.boolean().optional().default(true),
  status: vehicleStatusDto.optional(),
  statusReason: z.preprocess(emptyToNull, z.string().trim().min(1).max(500).nullable().optional()),
  notes: z.preprocess(emptyToNull, z.string().trim().min(1).max(2000).nullable().optional()),
})
export type CreateVehicleDto = z.infer<typeof createVehicleDto>

export const updateVehicleDto = createVehicleDto.partial().superRefine((data, ctx) => {
  if (data.licensePlate !== undefined && !data.licensePlate.trim()) {
    ctx.addIssue({ code: 'custom', message: 'Biển số xe không được để trống', path: ['licensePlate'] })
  }
})
export type UpdateVehicleDto = z.infer<typeof updateVehicleDto>

export const assignVehiclesToBookingDto = z.object({
  vehicleIds: z.array(z.string().trim().min(1)).max(20),
})
export type AssignVehiclesToBookingDto = z.infer<typeof assignVehiclesToBookingDto>
