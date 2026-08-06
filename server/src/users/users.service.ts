import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { User, UserAddress, UserDocument, UserEmergencyContact } from './user.schema'
import { UserRole } from './user-role'

type AdminUserUpdate = {
  role?: UserRole
  isActive?: boolean
}

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec()
  }

  findById(id: string) {
    return this.userModel.findById(id).exec()
  }

  createUser(input: {
    name: string
    email: string
    passwordHash: string
    role?: UserRole
    phone?: string | null
    gender?: 'male' | 'female' | 'other' | null
    avatarUrl?: string | null
    dateOfBirth?: string | null
    address?: UserAddress | null
    emergencyContact?: UserEmergencyContact | null
    citizenId?: string | null
    passportNumber?: string | null
    dietary?: string | null
    medicalNotes?: string | null
  }) {
    return this.userModel.create({
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      phone: input.phone ?? null,
      gender: input.gender ?? null,
      avatarUrl: input.avatarUrl ?? null,
      dateOfBirth: input.dateOfBirth ?? null,
      address: input.address ?? null,
      emergencyContact: input.emergencyContact ?? null,
      citizenId: input.citizenId ?? null,
      passportNumber: input.passportNumber ?? null,
      dietary: input.dietary ?? null,
      medicalNotes: input.medicalNotes ?? null,
      passwordHash: input.passwordHash,
      role: input.role ?? 'customer',
    })
  }

  async setRefreshTokenHash(userId: string, refreshTokenHash: string | null) {
    await this.userModel.updateOne({ _id: userId }, { refreshTokenHash }).exec()
  }

  async setPasswordHash(userId: string, passwordHash: string) {
    await this.userModel.updateOne({ _id: userId }, { passwordHash }).exec()
  }

  async setPasswordResetAt(userId: string, at: Date) {
    await this.userModel.updateOne({ _id: userId }, { passwordResetAt: at }).exec()
  }

  async adminUpdateUser(userId: string, input: AdminUserUpdate) {
    const update: Record<string, unknown> = {}
    if (input.role) update.role = input.role
    if (typeof input.isActive === 'boolean') update.isActive = input.isActive
    await this.userModel.updateOne({ _id: userId }, update).exec()
    return this.findById(userId)
  }

  async adminListUsers(input: {
    search?: string
    role?: UserRole
    isActive?: boolean
    page?: number
    limit?: number
  }) {
    const page = Math.max(1, Math.floor(input.page ?? 1))
    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 20)))
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = {}
    if (input.role) filter.role = input.role
    if (typeof input.isActive === 'boolean') filter.isActive = input.isActive
    if (input.search) {
      const q = input.search.trim()
      if (q) {
        filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }]
      }
    }

    const [items, total] = await Promise.all([
      this.userModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.userModel.countDocuments(filter).exec(),
    ])

    return { items, total, page, limit }
  }

  async updateProfile(
    userId: string,
    input: {
      name?: string | null
      phone?: string | null
      gender?: 'male' | 'female' | 'other' | null
      avatarUrl?: string | null
      dateOfBirth?: string | null
      address?: Partial<UserAddress> | null
      emergencyContact?: Partial<UserEmergencyContact> | null
      citizenId?: string | null
      passportNumber?: string | null
      dietary?: string | null
      medicalNotes?: string | null
    },
  ) {
    const update: Record<string, unknown> = {}
    if (typeof input.name === 'string') update.name = input.name.trim()
    if (typeof input.phone === 'string') update.phone = input.phone.trim()
    if (input.phone === null) update.phone = null
    if (input.gender === 'male' || input.gender === 'female' || input.gender === 'other' || input.gender === null) {
      update.gender = input.gender
    }
    if (typeof input.avatarUrl === 'string') update.avatarUrl = input.avatarUrl.trim()
    if (input.avatarUrl === null) update.avatarUrl = null

    if (typeof input.dateOfBirth === 'string') update.dateOfBirth = input.dateOfBirth.trim()
    if (input.dateOfBirth === null) update.dateOfBirth = null

    if (input.address === null) {
      update.address = null
    } else if (input.address && typeof input.address === 'object') {
      const province = typeof input.address.province === 'string' ? input.address.province.trim() : null
      const district = typeof input.address.district === 'string' ? input.address.district.trim() : null
      const ward = typeof input.address.ward === 'string' ? input.address.ward.trim() : null
      const line1 = typeof input.address.line1 === 'string' ? input.address.line1.trim() : null
      update.address = province || district || ward || line1 ? { province, district, ward, line1 } satisfies UserAddress : null
    }

    if (input.emergencyContact === null) {
      update.emergencyContact = null
    } else if (input.emergencyContact && typeof input.emergencyContact === 'object') {
      const name = typeof input.emergencyContact.name === 'string' ? input.emergencyContact.name.trim() : null
      const phone = typeof input.emergencyContact.phone === 'string' ? input.emergencyContact.phone.trim() : null
      const relation = typeof input.emergencyContact.relation === 'string' ? input.emergencyContact.relation.trim() : null
      update.emergencyContact = name || phone || relation ? { name, phone, relation } satisfies UserEmergencyContact : null
    }

    if (typeof input.citizenId === 'string') update.citizenId = input.citizenId.trim()
    if (input.citizenId === null) update.citizenId = null
    if (typeof input.passportNumber === 'string') update.passportNumber = input.passportNumber.trim()
    if (input.passportNumber === null) update.passportNumber = null

    if (typeof input.dietary === 'string') update.dietary = input.dietary.trim()
    if (input.dietary === null) update.dietary = null
    if (typeof input.medicalNotes === 'string') update.medicalNotes = input.medicalNotes.trim()
    if (input.medicalNotes === null) update.medicalNotes = null

    await this.userModel.updateOne({ _id: userId }, update).exec()
    return this.findById(userId)
  }
}
