import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AdminBannersController } from './admin-banners.controller'
import { Banner, BannerSchema } from './banner.schema'
import { BannersController } from './banners.controller'
import { BannersService } from './banners.service'

@Module({
  imports: [MongooseModule.forFeature([{ name: Banner.name, schema: BannerSchema }]), AuditLogsModule],
  controllers: [BannersController, AdminBannersController],
  providers: [BannersService],
  exports: [BannersService, MongooseModule],
})
export class BannersModule {}

