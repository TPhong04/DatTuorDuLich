import { Controller, Get, UseGuards } from '@nestjs/common'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'

@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user
  }
}

