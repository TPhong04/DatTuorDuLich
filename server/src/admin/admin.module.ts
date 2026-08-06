import { Module } from '@nestjs/common'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { BannersModule } from '../banners/banners.module'
import { SettingsModule } from '../settings/settings.module'
import { UploadsModule } from '../uploads/uploads.module'
import { UsersModule } from '../users/users.module'
import { AdminController } from './admin.controller'
import { AdminAuditLogsController } from './admin-audit-logs.controller'
import { AdminUsersController } from './admin-users.controller'
import { AdminUsersService } from './admin-users.service'

@Module({
  imports: [UsersModule, AuditLogsModule, SettingsModule, UploadsModule, BannersModule],
  controllers: [AdminController, AdminUsersController, AdminAuditLogsController],
  providers: [AdminUsersService],
})
export class AdminModule {}
