import { apiFetch } from '@/lib/api'

export type PostCategory = 'promotion' | 'experience' | 'tour_launch' | 'company' | 'culture' | 'guide'
export type PostStatus = 'draft' | 'pending' | 'published' | 'scheduled'

export type PublicPost = {
  id: string
  title: string
  slug: string
  category: PostCategory
  tags: string[]
  relatedTourIds: string[]
  excerpt: string | null
  content: string | null
  coverImageUrl: string | null
  publishedAt: string | null
  viewCount: number
  isPinned: boolean
  sourceUrl: string | null
  sourceName: string | null
  createdAt: string | null
}

export type PublicPostDetail = PublicPost & { related: PublicPost[] }

export type PublicPostListResponse = {
  rows: PublicPost[]
  pinned: PublicPost[]
  page: number
  pageSize: number
  totalPages: number
  totalRows: number
}

export type AdminPost = PublicPost & {
  status: PostStatus
  scheduledAt: string | null
  authorId: string
  seoTitle: string | null
  seoDescription: string | null
  sourceUrl: string | null
  canStaffEdit: boolean
  canStaffDelete: boolean
  approvedBy: string | null
  updatedAt: string | null
}

export type AdminPostListResponse = {
  rows: AdminPost[]
  page: number
  pageSize: number
  totalPages: number
  totalRows: number
  pendingCount: number
}

export type PostCreatePayload = {
  title: string
  slug?: string
  category: PostCategory
  tags?: string[]
  relatedTourIds?: string[]
  excerpt?: string | null
  content?: string | null
  coverImageUrl?: string | null
  status?: PostStatus
  scheduledAt?: string | null
  seoTitle?: string | null
  seoDescription?: string | null
  isPinned?: boolean
  sourceUrl?: string | null
  sourceName?: string | null
}

export type PostUpdatePayload = Partial<PostCreatePayload>
export type PostStatusPayload = { status: PostStatus }
export type PostPermissionsPayload = { canStaffEdit: boolean; canStaffDelete: boolean }
export type RssImportPayload = { feeds?: string[]; createAs?: 'pending' | 'draft' }
export type RssImportResult = { imported: number; items: AdminPost[] }

export const POST_CATEGORY_META: Record<PostCategory, { label: string; color: string; chip: string; icon: string }> = {
  promotion:  { label: 'Khuyến mãi',    color: 'orange',  chip: 'bg-orange-50 text-orange-700 ring-orange-200',         icon: '🏷️' },
  experience: { label: 'Kinh nghiệm',  color: 'emerald', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',     icon: '🗺️' },
  tour_launch:{ label: 'Tour mới',     color: 'blue',    chip: 'bg-blue-50 text-blue-700 ring-blue-200',             icon: '✈️' },
  company:    { label: 'Công ty/TT',   color: 'violet',  chip: 'bg-violet-50 text-violet-700 ring-violet-200',       icon: '🏢' },
  culture:    { label: 'Văn hóa',      color: 'rose',    chip: 'bg-rose-50 text-rose-700 ring-rose-200',             icon: '🎎' },
  guide:      { label: 'Hướng dẫn',    color: 'amber',   chip: 'bg-amber-50 text-amber-800 ring-amber-200',           icon: '📖' },
}

export const POST_STATUS_META: Record<PostStatus, { label: string; chip: string; icon: string }> = {
  draft:     { label: 'Nháp',       chip: 'bg-slate-100 text-slate-700 ring-slate-200',       icon: '📝' },
  pending:   { label: 'Chờ duyệt',  chip: 'bg-amber-50 text-amber-800 ring-amber-200',         icon: '⏳' },
  published: { label: 'Xuất bản',   chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200',   icon: '✅' },
  scheduled: { label: 'Đặt lịch',   chip: 'bg-sky-50 text-sky-700 ring-sky-200',               icon: '📅' },
}

export type PostPermissionResult = {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canPublish: boolean
  canSetPermissions: boolean
  canImportRss: boolean
}

export function canUserEditPost(role: string | undefined, userId: string | undefined, post: { authorId: string; canStaffEdit?: boolean }): boolean {
  if (role === 'admin') return true
  if (role !== 'staff') return false
  if (userId && post.authorId !== userId) return false
  return Boolean(post.canStaffEdit)
}
export function canUserDeletePost(role: string | undefined, userId: string | undefined, post: { authorId: string; canStaffDelete?: boolean }): boolean {
  if (role === 'admin') return true
  if (role !== 'staff') return false
  if (userId && post.authorId !== userId) return false
  return Boolean(post.canStaffDelete)
}
export function canUserPublishPost(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserSetPostPermissions(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserImportRss(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserCreatePost(role: string | undefined): boolean {
  return role === 'admin' || role === 'staff'
}

function qs(p: Record<string, unknown>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) {
      if (v.length > 0) s.set(k, v.map((x) => String(x)).join(','))
    } else s.set(k, String(v))
  }
  const r = s.toString()
  return r ? `?${r}` : ''
}

export function fetchPublicPosts(params: {
  category?: PostCategory | 'all'
  tag?: string | null
  search?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}): Promise<PublicPostListResponse> {
  return apiFetch<PublicPostListResponse>(
    `/posts${qs({
      category: params.category === 'all' ? undefined : params.category,
      tag: params.tag,
      search: params.search,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 12,
    })}`,
    undefined,
    { signal: params.signal },
  )
}

export function fetchPublicPostBySlug(slug: string, opts?: { signal?: AbortSignal }): Promise<PublicPostDetail> {
  return apiFetch<PublicPostDetail>(`/posts/${encodeURIComponent(slug)}`, undefined, { signal: opts?.signal })
}

export function fetchAdminPosts(params: {
  status?: PostStatus | 'all'
  category?: PostCategory | 'all'
  authorId?: string | 'all'
  search?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}): Promise<AdminPostListResponse> {
  return apiFetch<AdminPostListResponse>(
    `/admin/posts${qs({
      status: params.status === 'all' ? undefined : params.status,
      category: params.category === 'all' ? undefined : params.category,
      authorId: params.authorId === 'all' ? undefined : params.authorId,
      search: params.search,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    undefined,
    { signal: params.signal },
  )
}

export function createAdminPost(payload: PostCreatePayload): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/admin/posts`, { method: 'POST', body: JSON.stringify(payload) })
}
export function updateAdminPost(id: string, payload: PostUpdatePayload): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/admin/posts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function setAdminPostStatus(id: string, payload: PostStatusPayload): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/admin/posts/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function setAdminPostPermissions(id: string, payload: PostPermissionsPayload): Promise<AdminPost> {
  return apiFetch<AdminPost>(`/admin/posts/${encodeURIComponent(id)}/permissions`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function deleteAdminPost(id: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>(`/admin/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function importAdminPostRss(payload: RssImportPayload = {}): Promise<RssImportResult> {
  return apiFetch<RssImportResult>(`/admin/posts/import/rss`, { method: 'POST', body: JSON.stringify(payload) })
}
