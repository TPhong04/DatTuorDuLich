import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Request } from 'express'

import { JwtPayload } from '../auth.types'
import { ROLES_KEY } from '../decorators/roles.decorator'
import { UserRole } from '../../users/user-role'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (!roles || roles.length === 0) return true

    const req = context.switchToHttp().getRequest<Request>()
    const user = req.user as JwtPayload | undefined
    if (!user) return false
    return roles.includes(user.role)
  }
}

