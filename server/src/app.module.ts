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
import { ApmResponseTimeMiddleware } from './monitoring/apm-response-time.middleware'
import { MonitoringModule } from './monitoring/monitoring.module'
import { CsrfDoubleSubmitMiddleware } from './security/csrf-double-submit.middleware'
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

const envSchema = z.object({
  PORT: z.string().optional(),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000'),
  CSRF_SECRET: z.string().min(16).default('local_dev_csrf_secret_change_me_please_min_32_chars_ok'),
  TOTP_ISSUER: z.string().default('VietNam Explorer'),
  TOTP_DISABLE_ENFORCEMENT: z.enum(['0', '1']).default('1'),
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  SENTRY_DSN_API: z.string().optional(),
  SENTRY_DSN_WEB: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.union([z.string(), z.number()]).optional(),
  SENTRY_REPLAY_SAMPLE_RATE: z.union([z.string(), z.number()]).optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
  NEW_RELIC_APP_NAME: z.string().optional(),
  ENABLE_METRICS_ENDPOINT: z.enum(['0', '1']).optional(),
  METRICS_BASIC_AUTH_USER: z.string().optional(),
  METRICS_BASIC_AUTH_PASS: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID_DEVONCALL: z.string().optional(),
  APM_P95_BOOKING_THRESHOLD_MS: z.union([z.string(), z.number()]).optional(),
  APM_ALERT_COOLDOWN_SECONDS: z.union([z.string(), z.number()]).optional(),
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  SERVER_ALLOW_PORT_BUMP: z.enum(['0', '1']).optional(),
  BOOKING_HOLD_CRON: z.string().optional(),
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
    PaymentsModule,
    TodosModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: TwoFactorRequiredForPrivilegedRolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ApmResponseTimeMiddleware)
      .exclude(
        { path: '/health', method: 0 },
        { path: '/health/live', method: 0 },
        { path: '/health/ready', method: 0 },
        { path: '/metrics', method: 0 },
      )
      .forRoutes('*')
    consumer
      .apply(CsrfDoubleSubmitMiddleware)
      .exclude(
        { path: '/api/payments/webhook/vnpay', method: 1 },
        { path: '/api/payments/webhook/vnpay/ipn', method: 2 },
        { path: '/api/payments/webhook/momo', method: 2 },
        { path: '/api/payments/webhook/stripe', method: 2 },
        { path: '/api/public/payments/*anyPath', method: 0 },
      )
      .forRoutes('*')
  }
}
