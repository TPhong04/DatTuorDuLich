import { Global, Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { JwtModule } from '@nestjs/jwt'
import { Notification, NotificationSchema, NotificationSetting, NotificationSettingSchema } from './notification.schema'
import { Booking, BookingSchema } from '../bookings/booking.schema'
import { GroupTourRequest, GroupTourRequestSchema } from '../group-tour-requests/group-tour-request.schema'
import { NotificationGateway } from './notification.gateway'
import { NotificationsService } from './notifications.service'
import { EmailService } from './email.service'
import { MeNotificationsController } from './me-notifications.controller'
import { StaffNotificationsController } from './staff-notifications.controller'
import { AdminNotificationsController } from './admin-notifications.controller'
import { NotificationCronService } from './notification-cron.service'

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationSetting.name, schema: NotificationSettingSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: GroupTourRequest.name, schema: GroupTourRequestSchema },
    ]),
    JwtModule,
  ],
  controllers: [MeNotificationsController, StaffNotificationsController, AdminNotificationsController],
  providers: [NotificationsService, NotificationGateway, EmailService, NotificationCronService],
  exports: [NotificationsService, NotificationGateway],
})
export class NotificationsModule {}
