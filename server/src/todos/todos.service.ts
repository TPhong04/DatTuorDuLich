import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Todo, TodoDocument, TodoStatus, TodoPriority, TodoCategory } from './todo.schema'
import type { GroupTourRequestDocument } from '../group-tour-requests/group-tour-request.schema'
import { NotificationsService, CreateNotificationInput } from '../notifications/notifications.service'

export type TodoCreateInput = {
  groupTourRequestId?: Types.ObjectId | null
  groupTourRequestCode?: string | null
  bookingId?: Types.ObjectId | null
  bookingCode?: string | null
  assigneeId: Types.ObjectId
  category: TodoCategory
  title: string
  description?: string | null
  order?: number
  priority?: TodoPriority
  status?: TodoStatus
  dueAt?: Date | null
  createdById?: Types.ObjectId | null
  metadata?: Record<string, any> | null
}

export type GroupTourTodoTemplate = {
  category: TodoCategory
  icon: string
  title: string
  description: string
  priority: TodoPriority
  slaMinutes: number
  checklist: string[]
}

export const DEFAULT_GTR_WON_CHECKLIST: GroupTourTodoTemplate[] = [
  {
    category: 'hotel',
    icon: '🏨',
    title: 'Khách sạn (KS) — Confirm phòng theo class',
    description: 'Liên hệ 3 KS hạng tương ứng class yêu cầu, confirm số lượng phòng twin/double/single, check breakfast + VAT + service charge, gửi quote + hình ảnh thực tế phòng/hall ăn, đồng ý policy hủy (free cancel 15 ngày trước).',
    priority: 'high',
    slaMinutes: 30,
    checklist: [
      'Xác nhận số phòng đúng loại (twin/double/single) theo số hành khách',
      'Bảo lãnh phòng (deposit 20-30% hoặc phát hành PO) cho KS trong 1h sau confirm khách',
      'Gửi email xác nhận KS (voucher tạm) cho trưởng đoàn trong ngày',
    ],
  },
  {
    category: 'flight',
    icon: '✈️',
    title: 'Vé máy bay — Xác nhận block vé',
    description: 'Liên hệ đại lý / airline block seat charter hoặc group fare, confirm mã chuyến bay đi/về, giờ khởi hành, hành lý ký gửi (20kg/23kg), chỗ ngồi (hàng lối đi nếu có đoàn lớn), giá vé + thuế (phát hành EMD/ETKT ngay).',
    priority: 'urgent',
    slaMinutes: 30,
    checklist: [
      'Block 20% số chỗ NGAY sau Won (nguy cơ giá tăng / hết vé cao điểm Tết/hè)',
      'Confirm 2 chiều chuyến bay (đi/về) — mã flight + giờ khởi hành/đến',
      'Thu passport scan toàn đoàn trong 48h để phát hành vé (ETKT)',
    ],
  },
  {
    category: 'visa',
    icon: '🛂',
    title: 'Visa / Giấy tờ — Visa đoàn + bảo hiểm',
    description: 'Kiểm tra điều kiện visa điểm đến (visa free / eVisa / visa đoàn tạm trú 30 ngày), thu hộ chiếu gốc (nếu cần sticker visa), mua bảo hiểm du lịch toàn đoàn (gói tối thiểu 50.000 USD, kể cả TE/EB).',
    priority: 'high',
    slaMinutes: 30,
    checklist: [
      'Check visa policy điểm đến, cập nhật trưởng đoàn ngay nếu có thay đổi 2025',
      'Thu scan passport 30 ngày trước khởi hành + visa letter (nếu t/m)',
      'Mua bảo hiểm du lịch cho 100% hành khách (bao gồm cả hủy chuyến / y tế nước ngoài)',
    ],
  },
  {
    category: 'guide',
    icon: '🧑‍✈️',
    title: 'HDV (Hướng dẫn viên) — Lựa chọn phù hợp đoàn',
    description: 'Chọn HDV kinh nghiệm trên 5 năm điểm đến, ngoại ngữ phù hợp (Việt/Anh/Trung), rating 4.5+/5 review, ký hợp đồng HDV, brief thông tin đoàn (đặc thù TE, giới tính, yêu cầu ăn chay, dị ứng thức ăn/khí hậu).',
    priority: 'normal',
    slaMinutes: 60,
    checklist: [
      'Lọc HDV rank cao phù hợp đặc điểm đoàn (doanh nghiệp / đoàn trẻ em / đoàn gia đình lớn tuổi)',
      'Gửi brief HDV (danh sách pass, đặc thù ăn uống, lịch trình chi tiết, SĐT trưởng đoàn)',
      'Thu thập ảnh chân dung HDV, giới thiệu trưởng đoàn 3 ngày trước khởi hành',
    ],
  },
  {
    category: 'transport',
    icon: '🚗',
    title: 'Xe du lịch — Xe đời mới + tài xế 5 năm KN',
    description: 'Đặt xe du lịch Limousine 9 chỗ / 16 chỗ / 29 / 35 / 45 chỗ (dư 5-10% số hành khách), tài xế ≥ 5 năm kinh nghiệm đường dài, xe đời <3 năm, có nước uống + khăn lạnh + WiFi trên xe, giờ đón/trả sân bay confirm trước 24h.',
    priority: 'high',
    slaMinutes: 30,
    checklist: [
      'Confirm số ghế dư 10% (vd đoàn 30 → xe 35) và đời xe <3 năm',
      'Liên hệ tài xế + Cty xe 24h trước chuyến để confirm giờ đón',
      'Gửi list xe / biển số / Tên Tài Xế / SĐT tài xế cho trưởng đoàn + HDV',
    ],
  },
]

@Injectable()
export class TodosService {
  constructor(
    @InjectModel(Todo.name) private readonly model: Model<TodoDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  private _o(id: Types.ObjectId | string | undefined | null): Types.ObjectId | null {
    if (!id) return null
    try { return new Types.ObjectId(String(id)) } catch { return null }
  }

  private _idsOfUserRole(actor: { sub: string | Types.ObjectId; role: string }): { isAdmin: boolean; isStaff: boolean; actorOid: Types.ObjectId } {
    const actorOid = new Types.ObjectId(String(actor.sub))
    const role = String(actor.role || '').toLowerCase()
    return { isAdmin: role === 'admin', isStaff: role === 'staff', actorOid }
  }

  async create(input: TodoCreateInput): Promise<TodoDocument> {
    if (!input?.title?.trim()) throw new BadRequestException('Todo title không được trống')
    const assigneeId = this._o(input.assigneeId)
    if (!assigneeId) throw new BadRequestException('Cần xác định người được giao việc (assigneeId)')
    return this.model.create({
      groupTourRequestId: input.groupTourRequestId ? this._o(input.groupTourRequestId) : null,
      groupTourRequestCode: input.groupTourRequestCode ? String(input.groupTourRequestCode).trim() : null,
      bookingId: input.bookingId ? this._o(input.bookingId) : null,
      bookingCode: input.bookingCode ? String(input.bookingCode).trim() : null,
      assigneeId,
      category: input.category ?? 'other',
      title: String(input.title).trim().slice(0, 200),
      description: input.description ? String(input.description).trim().slice(0, 2000) : null,
      order: typeof input.order === 'number' ? input.order : 0,
      priority: input.priority ?? 'normal',
      status: input.status ?? 'todo',
      dueAt: input.dueAt ?? null,
      doneAt: null,
      doneById: null,
      createdById: input.createdById ? this._o(input.createdById) : null,
      metadata: input.metadata ?? null,
    })
  }

  async createBulkTodoForWonGroupTourRequest(params: {
    gtr: GroupTourRequestDocument
    bookingId?: Types.ObjectId | null
    actorId?: Types.ObjectId | null
    templates?: GroupTourTodoTemplate[]
  }): Promise<TodoDocument[]> {
    const { gtr, bookingId, actorId, templates = DEFAULT_GTR_WON_CHECKLIST } = params
    const now = new Date()
    const assignee = gtr.assignedStaffId ? this._o(gtr.assignedStaffId) : null
    if (!assignee) return []
    const created: TodoDocument[] = []
    for (let i = 0; i < templates.length; i += 1) {
      const t = templates[i]
      const dueAt = new Date(now.getTime() + Math.max(1, t.slaMinutes) * 60 * 1000)
      try {
        const row = await this.create({
          groupTourRequestId: (gtr._id as any) instanceof Types.ObjectId ? (gtr._id as any) : new Types.ObjectId(String((gtr as any)._id)),
          groupTourRequestCode: String(gtr.code || ''),
          bookingId: bookingId ?? null,
          bookingCode: (gtr as any).convertedBookingCode ? String((gtr as any).convertedBookingCode) : bookingId ? String(bookingId) : null,
          assigneeId: assignee,
          category: t.category,
          title: `${t.icon} ${t.title}`,
          description: t.description + '\n\n✨ Checklist nội bộ:\n' + t.checklist.map((c, j) => `  ${j + 1}. ${c}`).join('\n'),
          order: i,
          priority: t.priority,
          status: 'todo',
          dueAt,
          createdById: actorId ?? null,
          metadata: {
            wonAt: gtr.wonAt ? new Date(gtr.wonAt as any).toISOString() : now.toISOString(),
            slaMinutes: t.slaMinutes,
            categoryLabel: t.category,
            checklistItems: t.checklist,
            destination: gtr.destination ?? null,
            priorityGtr: gtr.priority ?? null,
          },
        })
        created.push(row)
      } catch (_err) { /* continue next */ }
    }
    if (created.length > 0) {
      try {
        const firstId = (gtr._id as any) instanceof Types.ObjectId ? (gtr._id as any) : new Types.ObjectId(String((gtr as any)._id))
        const notif: CreateNotificationInput = {
          recipientId: assignee,
          recipientRole: 'staff',
          type: 'todo_assigned_staff' as any,
          title: `🗂 Có ${created.length} việc MỚI cần làm trong 30 phút (Tour đoàn ${gtr.code || 'WON'})`,
          body: `${created.map((t) => t.title.split(' ', 2).slice(1).join(' ')).filter(Boolean).join(' · ')}`,
          entityType: 'todo' as any,
          entityId: created[0]._id as any,
          actionUrl: `/staff/group-tour-requests?id=${firstId}&tab=checklist`,
          priority: (gtr.priority === 'urgent' || gtr.priority === 'high') ? 'high' : 'medium',
          senderUserId: actorId ?? null,
        }
        await this.notifications.bulk([notif])
      } catch { /* noop */ }
    }
    return created
  }

  async listByGroupTourRequestId(gtrId: string | Types.ObjectId, actor: { sub: string | Types.ObjectId; role: string }): Promise<TodoDocument[]> {
    const { isAdmin, isStaff, actorOid } = this._idsOfUserRole(actor)
    const gtrOid = this._o(gtrId)
    if (!gtrOid) throw new BadRequestException('Id tour đoàn không hợp lệ')
    const rows = await this.model.find({ groupTourRequestId: gtrOid }).sort({ order: 1, createdAt: 1 }).lean().exec()
    if (!isAdmin && isStaff) {
      for (const r of rows) {
        if (r.assigneeId && String(r.assigneeId) !== String(actorOid)) {
          ;(r as any).__readOnlyForCurrentStaff = true
        }
      }
    }
    return rows as any[]
  }

  async listByStaff(actor: { sub: string | Types.ObjectId; role: string }, opts: { status?: TodoStatus; onlyOverdue?: boolean; page?: number; pageSize?: number } = {}) {
    const { isAdmin, isStaff, actorOid } = this._idsOfUserRole(actor)
    if (!isAdmin && !isStaff) throw new ForbiddenException('Bạn không có quyền xem danh sách việc cần làm')
    const staffOid = isStaff ? actorOid : null
    const filter: any = {}
    if (isStaff && staffOid) filter.assigneeId = staffOid
    if (opts.status) filter.status = opts.status
    if (opts.onlyOverdue) { filter.dueAt = { $exists: true, $ne: null, $lte: new Date() }; filter.status = { $nin: ['done', 'cancelled'] } }
    const page = Math.max(1, Number(opts.page) || 1)
    const pageSize = Math.min(200, Math.max(5, Number(opts.pageSize) || 50))
    const skip = (page - 1) * pageSize
    const [items, total] = await Promise.all([
      this.model.find(filter).sort({ priority: -1, dueAt: 1, createdAt: -1 }).skip(skip).limit(pageSize).lean().exec(),
      this.model.countDocuments(filter),
    ])
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async getById(id: string | Types.ObjectId): Promise<TodoDocument> {
    const oid = this._o(id)
    if (!oid) throw new BadRequestException('Id todo không hợp lệ')
    const row = await this.model.findById(oid).exec()
    if (!row) throw new NotFoundException('Todo không tồn tại')
    return row
  }

  async updateStatus(id: string | Types.ObjectId, newStatus: TodoStatus, actor: { sub: string | Types.ObjectId; role: string }): Promise<TodoDocument> {
    const { isAdmin, isStaff, actorOid } = this._idsOfUserRole(actor)
    const row = await this.getById(id)
    if (isStaff && String(row.assigneeId) !== String(actorOid)) {
      throw new ForbiddenException('Chỉ người được giao việc mới được cập nhật trạng thái todo này.')
    }
    if (!['todo', 'in_progress', 'done', 'cancelled'].includes(String(newStatus))) {
      throw new BadRequestException('Trạng thái todo không hợp lệ')
    }
    row.status = newStatus as TodoStatus
    if (newStatus === 'done') {
      row.doneAt = new Date()
      row.doneById = actorOid
    } else if (newStatus === 'todo' || newStatus === 'in_progress') {
      if (row.doneAt) { row.doneAt = null; row.doneById = null }
    }
    row.markModified('status')
    return row.save()
  }
}
