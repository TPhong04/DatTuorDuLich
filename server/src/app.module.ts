import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { MongooseModule } from '@nestjs/mongoose'
import { z } from 'zod'

import { AdminModule } from './admin/admin.module'
import { AuthModule } from './auth/auth.module'
import { BookingsModule } from './bookings/bookings.module'
import { DashboardsModule } from './dashboards/dashboards.module'
import { ReportsModule } from './reports/reports.module'
import { StaffModule } from './staff/staff.module'
import { ToursModule } from './tours/tours.module'
import { UsersModule } from './users/users.module'

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
    UsersModule,
    AuthModule,
    ToursModule,
    BookingsModule,
    StaffModule,
    AdminModule,
    DashboardsModule,
    ReportsModule,
  ],
})
export class AppModule {}
