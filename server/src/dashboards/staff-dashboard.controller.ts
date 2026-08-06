import { Controller, Get, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { DashboardsService } from './dashboards.service'
import { Types } from 'mongoose'

@Controller('staff/dashboard')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff', 'admin')
export class StaffDashboardController {
  constructor(private readonly service: DashboardsService) {}

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload) {
    return this.service.getAdminSummary(user?.sub ? new Types.ObjectId(user.sub) : null, { scopeToOwner: true })
  }
}
