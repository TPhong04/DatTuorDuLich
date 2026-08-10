import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { CreatePostDto, ImportRssFeedsDto, PatchPostPermissionsDto, PublishPostDto, UpdatePostDto } from './dto'
import { Post, PostDocument, PostStatus } from './post.schema'

export type AdminPostActor = { sub: string; email: string; role: 'admin' | 'staff' }

const ACTOR_ROLES = ['admin', 'staff'] as const
type ActorRole = (typeof ACTOR_ROLES)[number]

@Injectable()
export class PostsService {
  constructor(@InjectModel(Post.name) private readonly model: Model<PostDocument>) {}

  slugify(v: string, existing: string | null = null): string {
    let slug = String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ|Đ/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-+|-+$)/g, '')
      .slice(0, 240)
    if (!slug) slug = 'bai-viet'
    if (existing) return existing
    return slug
  }

  private isAdmin(actor: AdminPostActor): boolean {
    return actor.role === 'admin'
  }

  private sameAuthor(doc: PostDocument, actor: AdminPostActor): boolean {
    return String(doc.authorId) === String(actor.sub)
  }

  assertCanCreate(actor: AdminPostActor): void {
    if (!ACTOR_ROLES.includes(actor.role as ActorRole)) throw new ForbiddenException('Bạn không có quyền tạo bài')
  }

  assertCanEdit(doc: PostDocument, actor: AdminPostActor): void {
    if (this.isAdmin(actor)) return
    if (!this.sameAuthor(doc, actor)) throw new ForbiddenException('Chỉ có thể sửa bài do bạn viết')
    if (!doc.canStaffEdit) throw new ForbiddenException('Admin chưa cấp quyền sửa bài này cho staff')
  }

  assertCanDelete(doc: PostDocument, actor: AdminPostActor): void {
    if (this.isAdmin(actor)) return
    if (!this.sameAuthor(doc, actor)) throw new ForbiddenException('Chỉ có thể xóa bài do bạn viết')
    if (!doc.canStaffDelete) throw new ForbiddenException('Admin chưa cấp quyền xóa bài này cho staff')
  }

  assertCanPublishApprove(actor: AdminPostActor): void {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Chỉ Admin mới được duyệt / đổi trạng thái xuất bản')
  }

  assertCanSetPermissions(actor: AdminPostActor): void {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Chỉ Admin mới được bật/tắt quyền sửa/xóa cho staff')
  }

  assertCanImportRss(actor: AdminPostActor): void {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Chỉ Admin mới được import RSS tổng hợp')
  }

  async listPublic(args: {
    category?: string | null
    tag?: string | null
    search?: string | null
    page?: number
    pageSize?: number
  }) {
    const { category, tag, search } = args
    const page = Math.max(1, Number(args.page ?? 1))
    const pageSize = Math.min(60, Math.max(6, Number(args.pageSize ?? 12)))
    const filter: Record<string, unknown> = { status: 'published' }
    if (category && category !== 'all') filter.category = category
    if (tag) filter.tags = tag
    if (search) filter.$text = { $search: `"${search.replace(/"/g, '')}"` }
    const [totalRows, pinnedRows, rows] = await Promise.all([
      this.model.countDocuments(filter),
      this.model
        .find({ ...filter, isPinned: true })
        .sort({ publishedAt: -1 })
        .limit(3)
        .lean(),
      this.model
        .find(filter)
        .sort({ isPinned: -1, publishedAt: -1, createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ])
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    return {
      rows: rows.map(toPublicPost),
      pinned: pinnedRows.map(toPublicPost),
      page,
      pageSize,
      totalPages,
      totalRows,
    }
  }

  async getPublicBySlug(slug: string): Promise<ReturnType<typeof toPublicPost> & { related: ReturnType<typeof toPublicPost>[] }> {
    const doc = await this.model.findOne({ slug, status: 'published' }).lean()
    if (!doc) throw new NotFoundException('Bài viết không tồn tại')
    await this.model.updateOne({ _id: doc._id }, { $inc: { viewCount: 1 } })
    const tagQ = doc.tags?.[0] ? { tags: doc.tags[0], status: 'published', _id: { $ne: doc._id } } : undefined
    const relatedQuery = tagQ
      ? this.model.find(tagQ).sort({ publishedAt: -1 }).limit(4).lean()
      : this.model.find({ category: doc.category, status: 'published', _id: { $ne: doc._id } }).sort({ publishedAt: -1 }).limit(4).lean()
    const related = await relatedQuery
    return { ...toPublicPost(doc), related: related.map(toPublicPost) }
  }

  async listAdmin(args: {
    status?: string | null
    category?: string | null
    authorId?: string | null
    search?: string | null
    page?: number
    pageSize?: number
    actor: AdminPostActor
  }) {
    const page = Math.max(1, Number(args.page ?? 1))
    const pageSize = Math.min(200, Math.max(10, Number(args.pageSize ?? 25)))
    const filter: Record<string, unknown> = {}
    if (args.status && args.status !== 'all') filter.status = args.status
    if (args.category && args.category !== 'all') filter.category = args.category
    if (args.authorId && args.authorId !== 'all') filter.authorId = new Types.ObjectId(args.authorId)
    if (!this.isAdmin(args.actor)) filter.authorId = new Types.ObjectId(args.actor.sub)
    if (args.search) filter.$text = { $search: `"${args.search.replace(/"/g, '')}"` }
    const [totalRows, rows] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.find(filter).sort({ updatedAt: -1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ])
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const pendingCount = await this.model.countDocuments({ status: 'pending' })
    return { rows: rows.map(toAdminPost), page, pageSize, totalPages, totalRows, pendingCount }
  }

  async create(dto: CreatePostDto, actor: AdminPostActor) {
    this.assertCanCreate(actor)
    const dtoAny = dto as any
    let status: PostStatus = (dtoAny.status ?? 'draft') as PostStatus
    if (!this.isAdmin(actor) && (status === 'published' || status === 'scheduled')) {
      status = 'pending'
    }
    const slug = this.slugify(String(dtoAny.slug || dtoAny.title))
    const uniqueSlug = await this.makeUniqueSlug(slug)
    const tagsArr: string[] = Array.isArray(dtoAny.tags) ? (dtoAny.tags as string[]) : []
    const relatedArr: string[] = Array.isArray(dtoAny.relatedTourIds) ? (dtoAny.relatedTourIds as string[]) : []
    const created = await this.model.create({
      ...dto,
      slug: uniqueSlug,
      status,
      authorId: new Types.ObjectId(actor.sub),
      tags: tagsArr,
      relatedTourIds: relatedArr.map((x: any) => new Types.ObjectId(x)),
      publishedAt: status === 'published' ? new Date() : dtoAny.scheduledAt ?? null,
      canStaffEdit: false,
      canStaffDelete: false,
      approvedBy: status === 'published' && this.isAdmin(actor) ? new Types.ObjectId(actor.sub) : null,
    })
    return toAdminPost(await created.save().then((x) => x.toObject()))
  }

  async update(id: string, dto: UpdatePostDto, actor: AdminPostActor) {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài viết không tồn tại')
    this.assertCanEdit(doc, actor)
    const dtoAny = dto as any
    if (dtoAny.status && !this.isAdmin(actor)) {
      if (dtoAny.status === 'published' || dtoAny.status === 'scheduled') {
        throw new ForbiddenException('Bạn không có quyền xuất bản, hãy chuyển sang Chờ duyệt')
      }
    }
    if (dtoAny.slug) {
      const next = this.slugify(String(dtoAny.slug), null)
      if (next !== doc.slug) dtoAny.slug = await this.makeUniqueSlug(next, doc._id.toString())
    }
    if (dtoAny.relatedTourIds) {
      const arr: string[] = Array.isArray(dtoAny.relatedTourIds) ? (dtoAny.relatedTourIds as string[]) : []
      doc.relatedTourIds = arr.map((x: any) => new Types.ObjectId(x)) as any
    }
    for (const k of Object.keys(dtoAny)) {
      if (k === 'relatedTourIds') continue
      ;(doc as any)[k] = dtoAny[k]
    }
    if (dtoAny.status === 'published' && this.isAdmin(actor)) {
      doc.publishedAt = new Date()
      doc.approvedBy = new Types.ObjectId(actor.sub)
    }
    if (!this.isAdmin(actor)) {
      doc.canStaffEdit = doc.canStaffEdit
      doc.canStaffDelete = doc.canStaffDelete
    }
    const saved = await doc.save()
    return toAdminPost(saved.toObject())
  }

  async remove(id: string, actor: AdminPostActor) {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài viết không tồn tại')
    this.assertCanDelete(doc, actor)
    await this.model.deleteOne({ _id: doc._id })
    return toAdminPost(doc.toObject())
  }

  async setStatus(id: string, dto: PublishPostDto, actor: AdminPostActor) {
    this.assertCanPublishApprove(actor)
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài viết không tồn tại')
    doc.status = dto.status as PostStatus
    if ((dto.status as PostStatus) === 'published' && !doc.publishedAt) doc.publishedAt = new Date()
    if ((dto.status as PostStatus) === 'published') doc.approvedBy = new Types.ObjectId(actor.sub)
    const saved = await doc.save()
    return toAdminPost(saved.toObject())
  }

  async patchPermissions(id: string, dto: PatchPostPermissionsDto, actor: AdminPostActor) {
    this.assertCanSetPermissions(actor)
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài viết không tồn tại')
    doc.canStaffEdit = dto.canStaffEdit
    doc.canStaffDelete = dto.canStaffDelete
    const saved = await doc.save()
    return toAdminPost(saved.toObject())
  }

  async importRssFeeds(dto: ImportRssFeedsDto, actor: AdminPostActor) {
    this.assertCanImportRss(actor)
    const feeds = dto.feeds?.length
      ? dto.feeds
      : [
          'https://vnexpress.net/rss/du-lich.rss',
          'https://vietnamtourism.gov.vn/rss/feed/tin-tuc-su-kien',
        ]
    const createAs: 'pending' | 'draft' | 'published' | 'scheduled' = (dto.createAs ?? 'pending') as any
    const created: ReturnType<typeof toAdminPost>[] = []
    for (const feed of feeds) {
      const rows = await this.mockFetchRss(feed)
      for (const item of rows.slice(0, 6)) {
        const slug = await this.makeUniqueSlug(this.slugify(item.title))
        const doc = await this.model.create({
          title: item.title,
          slug,
          category: 'company' as const,
          tags: item.tags,
          excerpt: item.excerpt,
          content: item.content,
          coverImageUrl: null,
          status: createAs,
          scheduledAt: null,
          publishedAt: createAs === 'published' ? new Date() : null,
          authorId: new Types.ObjectId(actor.sub),
          seoTitle: item.title.slice(0, 120),
          seoDescription: item.excerpt?.slice(0, 280) ?? null,
          viewCount: 0,
          isPinned: false,
          sourceUrl: item.link,
          sourceName: item.sourceName,
          approvedBy: createAs === 'published' ? new Types.ObjectId(actor.sub) : null,
        })
        created.push(toAdminPost(doc.toObject()))
      }
    }
    return { imported: created.length, items: created }
  }

  private async mockFetchRss(feed: string): Promise<{ title: string; link: string; excerpt: string | null; content: string | null; tags: string[]; sourceName: string }[]> {
    const sourceName = feed.includes('vnexpress') ? 'VnExpress Du lịch' : 'Tổng cục Du lịch Việt Nam'
    const baseTitles: [string, string[]][] = feed.includes('vnexpress')
      ? [
          ['Khuyến mãi mùa hè 2025: Vietravel giảm đến 30% tour Châu Âu', ['khuyen mai', 'chau au']],
          ['Top 5 điểm du lịch miền Bắc mùa thu không thể bỏ lỡ', ['mien bac', 'mua thu', 'check-in']],
          ['Du lịch biển đảo Phú Quốc: Gợi ý 3 ngày 2 đêm tiết kiệm', ['phu quoc', 'bien dao', 'kinh nghiem']],
        ]
      : [
          ['Thông báo triển khai chương trình Khách Việt Nam khám phá Việt Nam năm 2025', ['su kien', 'chinh sach']],
          ['Hội thảo liên kết khu vực ASEAN du lịch bền vững lần thứ 6', ['hoi thao', 'asean', 'ben vung']],
          ['Công bố 3 địa điểm du lịch mới thuộc chương trình di sản thế giới', ['di san', 'van hoa']],
        ]
    const items: { title: string; link: string; excerpt: string | null; content: string | null; tags: string[]; sourceName: string }[] = []
    for (const [title, tags] of baseTitles) {
      const link = `${feed.includes('vnexpress') ? 'https://vnexpress.net/' : 'https://vietnamtourism.gov.vn/'}${encodeURIComponent(title.slice(0, 30))}`
      const excerpt = `${title}. Bài viết tổng hợp tự động từ nguồn ${sourceName}, nội dung gốc xem chi tiết tại link tham khảo.`
      items.push({ title, link, excerpt, content: `<p>${excerpt}</p>`, tags: tags.slice(), sourceName })
    }
    return items
  }

  private async makeUniqueSlug(base: string, excludeId?: string) {
    let slug = base
    let i = 2
    while (true) {
      const found = await this.model.findOne({ slug }).select('_id').lean()
      if (!found) return slug
      if (excludeId && String(found._id) === String(excludeId)) return slug
      slug = `${base}-${i++}`
      if (i > 9999) return `${base}-${Date.now().toString(36)}`
    }
  }
}

function iso(v: Date | null | undefined): string | null {
  return v ? new Date(v).toISOString() : null
}
function ids(v: Types.ObjectId[] | null | undefined): string[] {
  return Array.isArray(v) ? v.map((x) => String(x)) : []
}

export function toAdminPost(b: any) {
  return {
    id: String(b._id ?? b.id),
    title: b.title,
    slug: b.slug,
    category: b.category,
    tags: Array.isArray(b.tags) ? b.tags : [],
    relatedTourIds: ids(b.relatedTourIds),
    excerpt: b.excerpt ?? null,
    content: b.content ?? null,
    coverImageUrl: b.coverImageUrl ?? null,
    status: b.status,
    scheduledAt: iso(b.scheduledAt),
    publishedAt: iso(b.publishedAt),
    authorId: String(b.authorId),
    seoTitle: b.seoTitle ?? null,
    seoDescription: b.seoDescription ?? null,
    viewCount: Number(b.viewCount ?? 0),
    isPinned: Boolean(b.isPinned),
    sourceUrl: b.sourceUrl ?? null,
    sourceName: b.sourceName ?? null,
    canStaffEdit: Boolean(b.canStaffEdit),
    canStaffDelete: Boolean(b.canStaffDelete),
    approvedBy: b.approvedBy ? String(b.approvedBy) : null,
    createdAt: iso(b.createdAt),
    updatedAt: iso(b.updatedAt),
  }
}

export function toPublicPost(b: any) {
  return {
    id: String(b._id ?? b.id),
    title: b.title,
    slug: b.slug,
    category: b.category,
    tags: Array.isArray(b.tags) ? b.tags : [],
    relatedTourIds: ids(b.relatedTourIds),
    excerpt: b.excerpt ?? null,
    content: b.content ?? null,
    coverImageUrl: b.coverImageUrl ?? null,
    publishedAt: iso(b.publishedAt) ?? iso(b.createdAt),
    viewCount: Number(b.viewCount ?? 0),
    isPinned: Boolean(b.isPinned),
    sourceUrl: b.sourceUrl ?? null,
    sourceName: b.sourceName ?? null,
    createdAt: iso(b.createdAt),
  }
}
