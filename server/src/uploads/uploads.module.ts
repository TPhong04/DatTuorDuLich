import { Module } from '@nestjs/common'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { UsersModule } from '../users/users.module'
import { CloudinaryModule } from '../cloudinary/cloudinary.module'
import { AdminUploadsController } from './admin-uploads.controller'
import { UploadsController } from './uploads.controller'

@Module({
  imports: [AuditLogsModule, UsersModule, CloudinaryModule],
  controllers: [AdminUploadsController, UploadsController],
})
export class UploadsModule {}