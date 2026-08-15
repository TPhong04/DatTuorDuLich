import { Controller, Get, Param, Patch, Body, Query, UseGuards, BadRequestException } from '@nestjs/common'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { TodosService } from './todos.service'
import { TodoStatus } from './todo.schema'
import { GroupTourRequestsService } from '../group-tour-requests/group-tour-requests.service'

@Controller('admin/todos')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminTodosController {
  constructor(
    private readonly svc: TodosService,
    private readonly gtrSvc: GroupTourRequestsService,
  ) {}

  @Get('')
  async list(
    @CurrentUser() u: JwtPayload,
    @Query('status') status?: TodoStatus,
    @Query('onlyOverdue') onlyOverdue?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const res = await this.svc.listByStaff(u, {
      status: status as any,
      onlyOverdue: onlyOverdue === '1' || onlyOverdue === 'true',
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    })
    return { ok: true, ...res }
  }

  @Get('overview')
  async overview(@CurrentUser() u: JwtPayload) {
    const [todoRows, inProgressRows, doneRows, overdueRows] = await Promise.all([
      this.svc.listByStaff(u, { status: 'todo', pageSize: 9999 }),
      this.svc.listByStaff(u, { status: 'in_progress', pageSize: 9999 }),
      this.svc.listByStaff(u, { status: 'done', pageSize: 9999 }),
      this.svc.listByStaff(u, { onlyOverdue: true, pageSize: 9999 }),
    ])
    return {
      ok: true,
      totals: {
        todo: todoRows.total,
        in_progress: inProgressRows.total,
        done: doneRows.total,
        overdue: overdueRows.total,
      },
    }
  }

  @Get('by-group-tour-request/:id')
  async getByGtrId(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
  ) {
    if (!id) throw new BadRequestException('Id không hợp lệ')
    try { await this.gtrSvc.getById(id) } catch { throw new BadRequestException('Tour đoàn không tồn tại') }
    const items = await this.svc.listByGroupTourRequestId(id, u)
    const done = items.filter((i: any) => i.status === 'done').length
    const todo = items.filter((i: any) => i.status === 'todo').length
    const inProgress = items.filter((i: any) => i.status === 'in_progress').length
    return {
      ok: true,
      items,
      summary: {
        total: items.length,
        done,
        in_progress: inProgress,
        todo,
        progressPct: items.length ? Math.round((done / items.length) * 100) : 0,
      },
    }
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { status: TodoStatus } | any,
  ) {
    if (!body?.status) throw new BadRequestException('Cần gửi trạng thái status (todo/in_progress/done/cancelled)')
    const row = await this.svc.updateStatus(id, String(body.status) as TodoStatus, u)
    return { ok: true, row }
  }
}
