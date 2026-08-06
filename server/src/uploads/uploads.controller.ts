import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { mkdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { extname, join } from 'node:path'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { UsersService } from '../users/users.service'

function fileExt(input: string) {
  const ext = extname(input || '').toLowerCase()
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext
  return ''
}

@Controller('uploads')
@UseGuards(AccessTokenGuard)
export class UploadsController {
  constructor(private readonly usersService: UsersService) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req: any, _file: any, cb: any) => {
          const dest = join(process.cwd(), 'uploads', 'avatars')
          mkdirSync(dest, { recursive: true })
          cb(null, dest)
        },
        filename: (_req: any, file: any, cb: any) => {
          const ext = fileExt(file.originalname)
          if (!ext) return cb(new Error('Invalid file'), '')
          const name = `${Date.now()}_${randomBytes(8).toString('hex')}${ext}`
          cb(null, name)
        },
      }),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        const ext = fileExt(file.originalname)
        cb(null, Boolean(ext))
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: any, @CurrentUser() user: JwtPayload) {
    if (!file) throw new BadRequestException('Thiếu file')
    const url = `/uploads/avatars/${file.filename}`

    const updated = await this.usersService.updateProfile(user.sub, { avatarUrl: url })
    if (!updated) throw new BadRequestException('Tài khoản không tồn tại')

    return {
      url,
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        phone: updated.phone,
        gender: updated.gender,
        avatarUrl: updated.avatarUrl,
        dateOfBirth: updated.dateOfBirth,
        address: updated.address,
        emergencyContact: updated.emergencyContact,
        citizenId: updated.citizenId,
        passportNumber: updated.passportNumber,
        dietary: updated.dietary,
        medicalNotes: updated.medicalNotes,
        role: updated.role,
      },
    }
  }
}

