import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

import { JwtPayload } from '../auth.types'

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<Request>()
  return req.user as JwtPayload
})

