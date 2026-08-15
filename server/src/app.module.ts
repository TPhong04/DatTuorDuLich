import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { MongooseModule } from '@nestjs/mongoose'
import { z } from 'zod'

import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { TwoFactorRequiredForPrivilegedRolesGuard } from './auth/guards/two-factor-required.guard'
import { BannersModule } from './banners/banners.module'
import { BookingsModule } from './bookings/bookings.module'
import { DashboardsModule } from './dashboards/dashboards.module'
import { GroupTourRequestsModule } from './group-tour-requests/group-tour-requests.module'
import { NotificationsModule } from './notifications/notifications.module'
import { PaymentsModule } from './payments/payments.module'
import { PostsModule } from './posts/posts.module'
import { ReportsModule } from './reports/reports.module'
import { ReviewsModule } from './reviews/reviews.module'
import { ScheduleModule } from '@nestjs/schedule'
import { StaffModule } from './staff/staff.module'
import { TodosModule } from './todos/todos.module'
import { ToursModule } from './tours/tours.module'
import { UsersModule } from './users/users.module'
import { MonitoringModule } from './monitoring/monitoring.module'

const envSchema = z.object({
  PORT: z.string().optional(),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
})

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    ScheduleModule.forRoot(),
    MonitoringModule,
    UsersModule,
    AuthModule,
    ToursModule,
    BookingsModule,
    StaffModule,
    AdminModule,
    DashboardsModule,
    ReportsModule,
    BannersModule,
    PostsModule,
    ReviewsModule,
    NotificationsModule,
    GroupTourRequestsModule,
  ],
})
export class AppModule {}
