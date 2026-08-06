import { Controller, Get } from '@nestjs/common'

import { SettingsService } from './settings.service'

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async get() {
    const s = await this.settingsService.getOrCreate()
    return {
      company: s.company,
      branding: s.branding,
      home: s.home,
      booking: s.booking,
      payment: s.payment,
      notifications: s.notifications,
      security: s.security,
      integrations: s.integrations,
      masterData: s.masterData,
      updatedAt: (s as any).updatedAt,
    }
  }
}

