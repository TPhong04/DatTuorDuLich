import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Notification, NotificationDocument, NotificationSetting, NotificationSettingDocument, NotificationType, NotificationChannel } from './notification.schema'
import { NotificationGateway } from './notification.gateway'
import { EmailService } from './email.service'
import { UserRole } from '../users/user-role'

export interface CreateNotificationInput {
  recipientId: Types.ObjectId
  recipientRole: UserRole
  type: NotificationType
  title: string
  body: string
  channels?: NotificationChannel[]
  payload?: unknown
  entityType?: string | null
  entityId?: Types.ObjectId | string | null
  actionUrl?: string | null
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  senderUserId?: Types.ObjectId | null
  now?: Date
}

export interface ListNotificationsQuery {
  page?: number
  pageSize?: number
  isRead?: boolean | null
  type?: NotificationType | NotificationType[] | null
  search?: string | null
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
    @InjectModel(NotificationSetting.name) private readonly settingModel: Model<NotificationSettingDocument>,
    private readonly gateway: NotificationGateway,
    private readonly emailService: EmailService,
  ) {}

  private readonly DEFAULT_CHANNELS: NotificationChannel[] = ['in_app', 'email']
  private readonly URGENT_CHANNELS: NotificationChannel[] = ['in_app', 'email', 'sms']
  private readonly listCache = new Map<string, { value: unknown; expires: number }>()
  private readonly LIST_CACHE_MAX = 200
  private readonly LIST_CACHE_TTL_MS = 2000

  private listCacheKey(...parts: unknown[]) { return parts.map((p) => (p == null ? 'null' : String(p))).join('|') }
  private tryGetListCache<T = unknown>(key: string): T | null {
    const e = this.listCache.get(key)
    if (!e) return null
    if (e.expires < Date.now()) { this.listCache.delete(key); return null }
    return e.value as T
  }
  private setListCache(key: string, value: unknown) {
    if (this.listCache.size >= this.LIST_CACHE_MAX) {
      const firstKey = this.listCache.keys().next().value
      if (firstKey) this.listCache.delete(firstKey)
    }
    this.listCache.set(key, { value, expires: Date.now() + this.LIST_CACHE_TTL_MS })
  }
  private invalidateUserListCache(userId: Types.ObjectId | string) {
    const prefix = String(userId) + '|'
    for (const k of [...this.listCache.keys()]) {
      if (k.startsWith(prefix)) this.listCache.delete(k)
    }
  }
  private invalidateAllAdminListCache() {
    for (const k of [...this.listCache.keys()]) {
      if (k.startsWith('admin|')) this.listCache.delete(k)
    }
  }

  async getOrCreateSetting(userId: Types.ObjectId) {
    return this.settingModel
      .findOneAndUpdate(
        { userId },
        { $setOnInsert: { userId, muted: {}, channelsPerType: {}, enableEmail: true, enableSms: true, enableInApp: true, enableZalo: false, quietHours: [] } },
        { upsert: true, new: true },
      )
      .exec()
  }

  async updateSetting(userId: Types.ObjectId, patch: Partial<Omit<NotificationSetting, 'userId'>>) {
    const current = await this.getOrCreateSetting(userId)
    await this.settingModel.findByIdAndUpdate(current._id, { $set: patch as any }).exec()
    return this.getOrCreateSetting(userId)
  }

  private isMuted(setting: NotificationSettingDocument, type: NotificationType) {
    if (!setting) return false
    return !!setting.muted?.[type]
  }

  private resolveChannels(input: CreateNotificationInput, setting: NotificationSettingDocument): NotificationChannel[] {
    const def = input.priority === 'urgent' ? this.URGENT_CHANNELS : this.DEFAULT_CHANNELS
    const list = input.channels && input.channels.length > 0 ? [...input.channels] : [...def]
    if (!setting.enableEmail) {
      const idx = list.indexOf('email')
      if (idx >= 0) list.splice(idx, 1)
    }
    if (!setting.enableSms) {
      const idx = list.indexOf('sms')
      if (idx >= 0) list.splice(idx, 1)
    }
    if (!setting.enableInApp) {
      const idx = list.indexOf('in_app')
      if (idx >= 0) list.splice(idx, 1)
    }
    if (!setting.enableZalo) {
      const idx = list.indexOf('zalo')
      if (idx >= 0) list.splice(idx, 1)
    }
    const override = setting.channelsPerType?.[input.type]
    if (Array.isArray(override) && override.length > 0) return override
    return list
  }

  async create(input: CreateNotificationInput): Promise<{ row: NotificationDocument }> {
    const recipientId = new Types.ObjectId(String(input.recipientId))
    const now = input.now || new Date()
    const setting = await this.getOrCreateSetting(recipientId)
    if (this.isMuted(setting, input.type)) {
      this.logger.debug(`notification muted ${input.type} for user ${recipientId}`)
      return { row: null as any }
    }
    const channels = this.resolveChannels(input, setting)
    if (channels.length === 0) return { row: null as any }

    const entityIdSafe = input.entityId ? new Types.ObjectId(String(input.entityId)) : null

    const row = new this.model({
      recipientId,
      recipientRole: input.recipientRole,
      type: input.type,
      title: input.title,
      body: input.body,
      channels,
      sentVia: [],
      failedVia: [],
      isRead: false,
      readAt: null,
      payload: input.payload ?? null,
      entityType: input.entityType ?? null,
      entityId: entityIdSafe,
      actionUrl: input.actionUrl ?? null,
      priority: input.priority || 'medium',
      senderUserId: input.senderUserId ? new Types.ObjectId(String(input.senderUserId)) : null,
      retryCount: 0,
      lastErrorAt: null,
      lastErrorMessage: null,
      createdAt: now,
      updatedAt: now,
    } as any)
    await row.save()
    this.invalidateUserListCache(recipientId)
    if (typeof input.type === 'string' && (String(input.type).startsWith('admin_') || String(input.type).startsWith('staff_') || input.recipientRole === 'admin' || input.recipientRole === 'staff')) {
      this.invalidateAllAdminListCache()
    }

    const sent: NotificationChannel[] = []
    const failed: NotificationChannel[] = []
    const errors: string[] = []
    // #region debug-point H2:create-before-emit
    ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'pre-fix', hypothesisId: 'H2', location: 'notifications.service.ts:133', msg: '[DEBUG] svc.create post-save about to dispatch', data: { _id: String(row?._id || ''), type: input.type, recipientId: String(recipientId), recipientRole: input.recipientRole, channels, inAppIncluded: channels.includes('in_app') }, ts: Date.now() }) }).catch(() => { }) })();
    // #endregion

    if (channels.includes('in_app')) {
      try {
        this.gateway.emitNotification(recipientId, row)
        const unreadCount = await this.countUnread(recipientId)
        this.gateway.emitBadge(recipientId, unreadCount)
        // #region debug-point H2:emit-called-no-badge
        ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'post-fix', hypothesisId: 'H2', location: 'notifications.service.ts:136', msg: '[DEBUG] POST-FIX emitNotification + emitBadge BOTH CALLED', data: { _id: String(row?._id || ''), recipientId: String(recipientId), emitBadgeCalled: true, unreadCount }, ts: Date.now() }) }).catch(() => { }) })();
        // #endregion
        sent.push('in_app')
      } catch (err: any) {
        failed.push('in_app')
        errors.push(`in_app: ${String(err?.message || err)}`)
      }
    }

    if (channels.includes('email')) {
      try {
        await this.emailService.sendNotification(row, setting)
        sent.push('email')
      } catch (err: any) {
        failed.push('email')
        errors.push(`email: ${String(err?.message || err)}`)
      }
    }

    await this.model.findByIdAndUpdate(row._id, {
      $set: {
        sentVia: sent,
        failedVia: failed,
        lastErrorMessage: errors.length ? errors.join(' | ') : null,
        lastErrorAt: failed.length ? new Date() : null,
        retryCount: failed.length ? 1 : 0,
      } as any,
    }).exec()
    const finalRow = await this.model.findById(row._id).lean().exec()
    return { row: finalRow as unknown as NotificationDocument }
  }

  async bulk(inputs: CreateNotificationInput[]) {
    const results = []
    for (const i of inputs) results.push(await this.create(i))
    return { rows: results.map((r) => r.row).filter(Boolean) }
  }

  async listMe(userId: Types.ObjectId, q: ListNotificationsQuery = {}) {
    const page = Math.max(1, Number(q.page || 1))
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize || 25)))
    const typeKey = Array.isArray(q.type) ? q.type.map((t) => String(t)).join(',') : (q.type || 'null')
    const cacheKey = this.listCacheKey(String(userId), q.isRead, typeKey, page, pageSize, q.search || '')
    const cached = this.tryGetListCache<{ items: any[]; total: number; page: number; pageSize: number }>(cacheKey)
    if (cached) {
      // #region debug-point H8:listme-cache-hit
      ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'post-fix-h8', hypothesisId: 'H8', location: 'notifications.service.ts:listMe-cache', msg: '[DEBUG] H8 listMe IN-MEMORY CACHE HIT (no Mongo round-trip → sub ms)', data: { cacheKey, hit: true, role: 'customer', page, pageSize, rowsCount: cached.items.length, total: cached.total, ttlMs: this.LIST_CACHE_TTL_MS }, ts: Date.now() }) }).catch(() => { }) })();
      // #endregion
      return cached
    }
    const filter: any = { recipientId: new Types.ObjectId(String(userId)) }
    if (q.isRead === true || q.isRead === false) filter.isRead = q.isRead
    if (q.type) filter.type = Array.isArray(q.type) ? { $in: q.type } : q.type
    if (q.search) {
      const regex = { $regex: String(q.search), $options: 'i' }
      filter.$or = [{ title: regex }, { body: regex }]
    }
    const t0 = Date.now()
    const [total, rows] = await Promise.all([
      this.model.countDocuments(filter).exec(),
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).select('-failedVia -retryCount -lastErrorAt -lastErrorMessage').lean().exec(),
    ])
    const duration = Date.now() - t0
    const result = { items: rows, total, page, pageSize }
    this.setListCache(cacheKey, result)
    // #region debug-point H5:listme-duration-no-projection
    ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'post-fix-h8', hypothesisId: 'H5', location: 'notifications.service.ts:192', msg: '[DEBUG] POST-FIX listMe count+find duration WITH projection + H8 cache miss fill', data: { role: 'customer', page, pageSize, rowsCount: rows.length, total, durationMs: duration, projectionUsed: true, excludedCols: 'failedVia,retryCount,lastErrorAt,lastErrorMessage', cacheHit: false, cacheKey }, ts: Date.now() }) }).catch(() => { }) })();
    // #endregion
    return result
  }

  async countUnread(userId: Types.ObjectId) {
    const uid = new Types.ObjectId(String(userId))
    return this.model.countDocuments({ recipientId: uid, isRead: false }).exec()
  }

  async markRead(userId: Types.ObjectId, id: string) {
    const uid = new Types.ObjectId(String(userId))
    const nid = new Types.ObjectId(id)
    const row = await this.model.findOneAndUpdate(
      { _id: nid, recipientId: uid },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    ).exec()
    this.invalidateUserListCache(userId)
    return { ok: !!row, row }
  }

  async markAllRead(userId: Types.ObjectId) {
    const uid = new Types.ObjectId(String(userId))
    await this.model.updateMany(
      { recipientId: uid, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    ).exec()
    this.invalidateUserListCache(userId)
    return { ok: true, unreadCount: 0 }
  }

  async remove(userId: Types.ObjectId, id: string) {
    const uid = new Types.ObjectId(String(userId))
    const nid = new Types.ObjectId(id)
    const res = await this.model.deleteOne({ _id: nid, recipientId: uid }).exec()
    this.invalidateUserListCache(userId)
    this.invalidateAllAdminListCache()
    return { ok: res.deletedCount === 1 }
  }

  async listAdmin(q: ListNotificationsQuery & { recipientRole?: UserRole | UserRole[] | null }) {
    const page = Math.max(1, Number(q.page || 1))
    const pageSize = Math.min(200, Math.max(1, Number(q.pageSize || 50)))
    const recipientRoleKey = Array.isArray(q.recipientRole) ? q.recipientRole.map((r) => String(r)).join(',') : (q.recipientRole || 'any')
    const typeKey = Array.isArray(q.type) ? q.type.map((t) => String(t)).join(',') : (q.type || 'null')
    const cacheKey = this.listCacheKey('admin', recipientRoleKey, q.isRead, typeKey, page, pageSize, q.search || '')
    const cached = this.tryGetListCache<{ items: any[]; total: number; page: number; pageSize: number }>(cacheKey)
    if (cached) return cached
    const filter: any = {}
    if (q.isRead === true || q.isRead === false) filter.isRead = q.isRead
    if (q.type) filter.type = Array.isArray(q.type) ? { $in: q.type } : q.type
    if (q.recipientRole) filter.recipientRole = Array.isArray(q.recipientRole) ? { $in: q.recipientRole } : q.recipientRole
    if (q.search) {
      const regex = { $regex: String(q.search), $options: 'i' }
      filter.$or = [{ title: regex }, { body: regex }]
    }
    const [total, rows] = await Promise.all([
      this.model.countDocuments(filter).exec(),
      this.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).select('-failedVia -retryCount -lastErrorAt -lastErrorMessage').lean().exec(),
    ])
    const result = { items: rows, total, page, pageSize }
    this.setListCache(cacheKey, result)
    return result
  }
}
