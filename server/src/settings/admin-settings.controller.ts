import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import {
  bookingSettingsDto,
  brandingSettingsDto,
  companySettingsDto,
  homeSettingsDto,
  integrationsSettingsDto,
  masterDataSettingsDto,
  notificationsSettingsDto,
  paymentSettingsDto,
  securitySettingsDto,
} from './dto'
import { SettingsService } from './settings.service'

const sectionSchemaMap = {
  company: companySettingsDto,
  branding: brandingSettingsDto,
  home: homeSettingsDto,
  booking: bookingSettingsDto,
  payment: paymentSettingsDto,
  notifications: notificationsSettingsDto,
  security: securitySettingsDto,
  integrations: integrationsSettingsDto,
  masterData: masterDataSettingsDto,
} as const

type SectionKey = keyof typeof sectionSchemaMap

@Controller('admin/settings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminSettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get()
  async get() {
    const s = await this.settingsService.getOrCreate()
    return {
      id: s.id,
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
      createdAt: (s as any).createdAt,
    }
  }

  @Patch(':section')
  async patchSection(
    @Param('section') section: string,
    @Body() body: unknown,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (!(section in sectionSchemaMap)) {
      throw new BadRequestException('Section không hợp lệ')
    }

    const key = section as SectionKey
    const dto = this.parseBody(sectionSchemaMap[key], body)
    const s = await this.settingsService.updateSection(key, dto as any)

    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.settings.update',
      entityType: 'settings',
      entityId: s.id,
      meta: { section: key, patch: dto },
    })

    return {
      id: s.id,
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
      createdAt: (s as any).createdAt,
    }
  }

  private parseBody(schema: { parse: (input: unknown) => unknown }, input: unknown) {
    try {
      return schema.parse(input)
    } catch (e) {
      if (e instanceof ZodError) {
        const errors = e.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }))
        throw new BadRequestException({ message: 'Dữ liệu không hợp lệ', errors })
      }
      throw e
    }
  }
}
