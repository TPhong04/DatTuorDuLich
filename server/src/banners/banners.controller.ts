import { Controller, Get } from '@nestjs/common'

import { BannersService } from './banners.service'

function toPublicBanner(b: any) {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.imageUrl,
    targetType: b.targetType,
    targetValue: b.targetValue,
    openInNewTab: b.openInNewTab,
    order: b.order,
    startAt: b.startAt ? b.startAt.toISOString() : null,
    endAt: b.endAt ? b.endAt.toISOString() : null,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
  }
}

@Controller('banners')
export class BannersController {
  constructor(private readonly banners: BannersService) {}

  @Get()
  async list() {
    const items = await this.banners.listPublic()
    return { items: items.map(toPublicBanner) }
  }
}

