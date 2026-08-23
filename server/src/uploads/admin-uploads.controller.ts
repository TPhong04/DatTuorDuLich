import { BadRequestException, Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

import sharp from 'sharp'
import { extname } from 'node:path'
import multer from 'multer'
import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { CloudinaryService } from '../cloudinary/cloudinary.service'

function safeCategory(input: unknown) {
  const raw = typeof input === 'string' ? input.trim().toLowerCase() : ''
  const ok = /^[a-z0-9_-]{1,40}$/.test(raw)
  return ok ? raw : 'misc'
}

function fileExt(input: string) {
  const ext = extname(input || '').toLowerCase()
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext
  return ''
}

async function processBannerImageToHero(input: Buffer, ext: string): Promise<Buffer> {
  const targetW = 1920
  const targetH = 600
  const targetRatio = targetW / targetH

  const src = sharp(input).rotate()
  const meta = await src.metadata().catch(() => null)
  const ratio = meta?.width && meta?.height ? meta.width / meta.height : null

  let base: any
  if (ratio && ratio < targetRatio) {
    const bg = await src
      .clone()
      .resize(targetW, targetH, { fit: 'cover', position: 'centre' })
      .blur(24)
      .toBuffer()
    const fg = await src
      .clone()
      .resize(targetW, targetH, { fit: 'contain', position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer()
    base = sharp(bg).composite([{ input: fg, gravity: 'center' }])
  } else {
    base = src.resize(targetW, targetH, { fit: 'cover', position: 'centre' })
  }

  return ext === '.jpg' || ext === '.jpeg'
    ? base.jpeg({ quality: 82 }).toBuffer()
    : ext === '.png'
      ? base.png({ compressionLevel: 9 }).toBuffer()
      : base.webp({ quality: 82 }).toBuffer()
}

async function processTourImageToCard(input: Buffer, ext: string): Promise<Buffer> {
  const targetW = 1200
  const targetH = 675

  const src = sharp(input).rotate()
  const base = src.resize(targetW, targetH, { fit: 'cover', position: 'centre' })

  return ext === '.jpg' || ext === '.jpeg'
    ? base.jpeg({ quality: 85 }).toBuffer()
    : ext === '.png'
      ? base.png({ compressionLevel: 9 }).toBuffer()
      : base.webp({ quality: 85 }).toBuffer()
}

@Controller('admin/uploads')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminUploadsController {
  constructor(
    private readonly auditLogs: AuditLogsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: (multer as any).memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        const ext = fileExt(file.originalname)
        cb(null, Boolean(ext))
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: any,
    @Query('category') category: string | undefined,
    @CurrentUser() actor: JwtPayload,
  ) {
    if (!file) throw new BadRequestException('Thiếu file')
    const cat = safeCategory(category)
    const ext = fileExt(file.originalname) || '.jpg'

    let buffer: Buffer = file.buffer
    try {
      if (cat === 'banners') {
        buffer = await processBannerImageToHero(buffer, ext)
      } else if (cat === 'tours') {
        buffer = await processTourImageToCard(buffer, ext)
      }
    } catch {
      throw new BadRequestException('Không xử lý được ảnh. Vui lòng thử ảnh khác.')
    }

    const { url } = await this.cloudinary.uploadBuffer(buffer, cat)

    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.upload.image',
      entityType: 'upload',
      entityId: null,
      meta: { category: cat, url },
    })

    return { url }
  }
}