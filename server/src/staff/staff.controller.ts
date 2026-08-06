import { Controller, Get, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'

@Controller('staff')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff', 'admin')
export class StaffController {
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user
  }
}

