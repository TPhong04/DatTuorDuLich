import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { UsersModule } from '../users/users.module'
import { PublicGroupTourRequestsController } from './public-group-tour-requests.controller'
import { AdminGroupTourRequestsController } from './admin-group-tour-requests.controller'
import { StaffGroupTourRequestsController } from './staff-group-tour-requests.controller'
import { GroupTourRequest, GroupTourRequestSchema } from './group-tour-request.schema'
import { GroupTourRequestsService } from './group-tour-requests.service'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GroupTourRequest.name, schema: GroupTourRequestSchema }]),
    AuditLogsModule,
    UsersModule,
  ],
  controllers: [PublicGroupTourRequestsController, AdminGroupTourRequestsController, StaffGroupTourRequestsController],
  providers: [GroupTourRequestsService],
  exports: [GroupTourRequestsService, MongooseModule],
})
export class GroupTourRequestsModule {}
