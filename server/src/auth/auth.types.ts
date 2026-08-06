import { UserRole } from '../users/user-role'

export type JwtPayload = {
  sub: string
  email: string
  role: UserRole
}

