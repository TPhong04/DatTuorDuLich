import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AdminSettingsController } from './admin-settings.controller'
import { SettingsController } from './settings.controller'
import { Settings, SettingsSchema } from './settings.schema'
import { SettingsService } from './settings.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Settings.name, schema: SettingsSchema }]), AuditLogsModule],
  controllers: [AdminSettingsController, SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
