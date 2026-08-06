import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { Banner, BannerDocument, BannerTargetType } from './banner.schema'
import { CreateBannerDto, UpdateBannerDto } from './dto'

function normalizeString(input: unknown) {
  const v = typeof input === 'string' ? input.trim() : ''
  return v ? v : null
}

function normalizeTarget(input: { targetType: BannerTargetType; targetValue: string | null; openInNewTab: boolean }) {
  if (input.targetType === 'none') {
    return { targetType: 'none' as const, targetValue: null, openInNewTab: false }
  }

  const value = normalizeString(input.targetValue)
  if (!value) throw new BadRequestException('Thiếu đường dẫn banner')

  if (input.targetType === 'internal') {
    if (!value.startsWith('/')) throw new BadRequestException('Link nội bộ phải bắt đầu bằng /')
    return { targetType: 'internal' as const, targetValue: value, openInNewTab: false }
  }

  if (!/^https?:\/\//i.test(value)) throw new BadRequestException('Link ngoài phải bắt đầu bằng http:// hoặc https://')
  return { targetType: 'external' as const, targetValue: value, openInNewTab: Boolean(input.openInNewTab) }
}

function normalizeSchedule(input: { startAt: Date | null; endAt: Date | null }) {
  const startAt = input.startAt ?? null
  const endAt = input.endAt ?? null
  if (startAt && Number.isNaN(startAt.getTime())) throw new BadRequestException('startAt không hợp lệ')
  if (endAt && Number.isNaN(endAt.getTime())) throw new BadRequestException('endAt không hợp lệ')
  if (startAt && endAt && startAt.getTime() > endAt.getTime()) throw new BadRequestException('endAt phải sau startAt')
  return { startAt, endAt }
}

@Injectable()
export class BannersService {
  constructor(@InjectModel(Banner.name) private readonly banners: Model<BannerDocument>) {}

  async listAdmin() {
    return this.banners.find().sort({ order: 1, updatedAt: -1 }).exec()
  }

  async listPublic() {
    const now = new Date()
    return this.banners
      .find({
        isActive: true,
        $and: [
          { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
          { $or: [{ endAt: null }, { endAt: { $gte: now } }] },
        ],
      })
      .sort({ order: 1, updatedAt: -1 })
      .exec()
  }

  async create(input: CreateBannerDto) {
    const title = normalizeString(input.title)
    const imageUrl = normalizeString(input.imageUrl)
    if (!imageUrl) throw new BadRequestException('Thiếu ảnh banner')

    const rawType = (input.targetType ?? 'none') as BannerTargetType
    const rawTargetValue = normalizeString(input.targetValue)
    const rawOpenInNewTab = Boolean(input.openInNewTab)
    const target = normalizeTarget({ targetType: rawType, targetValue: rawTargetValue, openInNewTab: rawOpenInNewTab })
    const schedule = normalizeSchedule({ startAt: input.startAt ?? null, endAt: input.endAt ?? null })

    const order = typeof input.order === 'number' ? input.order : 0
    const isActive = typeof input.isActive === 'boolean' ? input.isActive : true

    const doc = await this.banners.create({
      title,
      imageUrl,
      ...target,
      order,
      isActive,
      ...schedule,
    })
    return doc
  }

  async update(id: string, patch: UpdateBannerDto) {
    const doc = await this.banners.findById(id).exec()
    if (!doc) throw new NotFoundException('Banner không tồn tại')

    const nextTitle = patch.title === undefined ? doc.title : normalizeString(patch.title)
    const nextImageUrl = patch.imageUrl === undefined ? doc.imageUrl : normalizeString(patch.imageUrl)
    if (!nextImageUrl) throw new BadRequestException('Thiếu ảnh banner')

    const nextType = (patch.targetType ?? doc.targetType) as BannerTargetType
    const nextTargetValue = patch.targetValue === undefined ? doc.targetValue : normalizeString(patch.targetValue)
    const nextOpenInNewTab = patch.openInNewTab === undefined ? doc.openInNewTab : Boolean(patch.openInNewTab)
    const target = normalizeTarget({ targetType: nextType, targetValue: nextTargetValue, openInNewTab: nextOpenInNewTab })

    const nextOrder = patch.order === undefined ? doc.order : patch.order
    const nextIsActive = patch.isActive === undefined ? doc.isActive : patch.isActive

    const schedule = normalizeSchedule({
      startAt: patch.startAt === undefined ? doc.startAt : (patch.startAt ?? null),
      endAt: patch.endAt === undefined ? doc.endAt : (patch.endAt ?? null),
    })

    doc.set({
      title: nextTitle,
      imageUrl: nextImageUrl,
      ...target,
      order: nextOrder,
      isActive: nextIsActive,
      ...schedule,
    })
    await doc.save()
    return doc
  }

  async remove(id: string) {
    const doc = await this.banners.findByIdAndDelete(id).exec()
    if (!doc) throw new NotFoundException('Banner không tồn tại')
    return doc
  }

  async reorder(ids: string[]) {
    const ops = ids.map((id, index) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { order: index + 1 } },
      },
    }))
    await this.banners.bulkWrite(ops, { ordered: false })
    return { ok: true }
  }
}

