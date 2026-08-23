import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import multer from 'multer'
import { extname } from 'node:path'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { UsersService } from '../users/users.service'
import { CloudinaryService } from '../cloudinary/cloudinary.service'

function fileExt(input: string) {
  const ext = extname(input || '').toLowerCase()
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext
  return ''
}

@Controller('uploads')
@UseGuards(AccessTokenGuard)
export class UploadsController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (multer as any).memoryStorage(),
      limits: { fileSize: 3 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        const ext = fileExt(file.originalname)
        cb(null, Boolean(ext))
      },
    }),
  )
  async uploadAvatar(@UploadedFile() file: any, @CurrentUser() user: JwtPayload) {
    if (!file) throw new BadRequestException('Thiếu file')

    const { url } = await this.cloudinary.uploadBuffer(file.buffer, 'avatars')

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