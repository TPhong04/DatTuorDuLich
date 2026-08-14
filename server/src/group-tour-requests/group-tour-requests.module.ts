import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { UsersModule } from '../users/users.module'
import { TodosModule } from '../todos/todos.module'
import { PublicGroupTourRequestsController } from './public-group-tour-requests.controller'
import { AdminGroupTourRequestsController } from './admin-group-tour-requests.controller'
import { StaffGroupTourRequestsController } from './staff-group-tour-requests.controller'
import { AdminGtrTodosController } from './admin-gtr-todos.controller'
import { StaffGtrTodosController } from './staff-gtr-todos.controller'
import { GroupTourRequest, GroupTourRequestSchema } from './group-tour-request.schema'
import { GroupTourRequestsService } from './group-tour-requests.service'
import { Booking, BookingSchema } from '../bookings/booking.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GroupTourRequest.name, schema: GroupTourRequestSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    AuditLogsModule,
    UsersModule,
    forwardRef(() => TodosModule),
  ],
  controllers: [
    PublicGroupTourRequestsController,
    AdminGroupTourRequestsController,
    StaffGroupTourRequestsController,
    AdminGtrTodosController,
    StaffGtrTodosController,
  ],
  providers: [GroupTourRequestsService],
  exports: [GroupTourRequestsService, MongooseModule],
})
export class GroupTourRequestsModule {}
