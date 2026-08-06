import { BadRequestException, Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { extname, join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'

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

async function processBannerImageToHero(inputPath: string, ext: string) {
  const targetW = 1920
  const targetH = 600
  const targetRatio = targetW / targetH

  const src = sharp(inputPath).rotate()
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

  const pipeline =
    ext === '.jpg' || ext === '.jpeg'
      ? base.jpeg({ quality: 82 })
      : ext === '.png'
        ? base.png({ compressionLevel: 9 })
        : base.webp({ quality: 82 })

  writeFileSync(inputPath, await pipeline.toBuffer())
}

async function processTourImageToCard(inputPath: string, ext: string) {
  const targetW = 1200
  const targetH = 675

  const src = sharp(inputPath).rotate()
  const base = src.resize(targetW, targetH, { fit: 'cover', position: 'centre' })

  const pipeline =
    ext === '.jpg' || ext === '.jpeg'
      ? base.jpeg({ quality: 85 })
      : ext === '.png'
        ? base.png({ compressionLevel: 9 })
        : base.webp({ quality: 85 })

  writeFileSync(inputPath, await pipeline.toBuffer())
}

@Controller('admin/uploads')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminUploadsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req: any, _file: any, cb: any) => {
          const category = safeCategory((req as any)?.query?.category)
          const dest = join(process.cwd(), 'uploads', category)
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
    if (cat === 'banners') {
      try {
        const ext = fileExt(file.filename)
        const path = join(process.cwd(), 'uploads', cat, file.filename)
        await processBannerImageToHero(path, ext || '.jpg')
      } catch {
        throw new BadRequestException('Không xử lý được ảnh banner. Vui lòng thử ảnh khác.')
      }
    } else if (cat === 'tours') {
      try {
        const ext = fileExt(file.filename)
        const path = join(process.cwd(), 'uploads', cat, file.filename)
        await processTourImageToCard(path, ext || '.jpg')
      } catch {
        throw new BadRequestException('Không xử lý được ảnh tour. Vui lòng thử ảnh khác.')
      }
    }
    const url = `/uploads/${cat}/${file.filename}`

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
