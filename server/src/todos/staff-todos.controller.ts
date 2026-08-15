import { Controller, Get, Param, Patch, Body, Query, UseGuards, BadRequestException } from '@nestjs/common'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { TodosService } from './todos.service'
import { TodoStatus } from './todo.schema'

@Controller('staff/todos')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff')
export class StaffTodosController {
  constructor(private readonly svc: TodosService) {}

  @Get('me')
  async listMine(
    @CurrentUser() u: JwtPayload,
    @Query('status') status?: TodoStatus | undefined,
    @Query('onlyOverdue') onlyOverdue?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const res = await this.svc.listByStaff(u, {
      status: status as any,
      onlyOverdue: onlyOverdue === '1' || onlyOverdue === 'true' || onlyOverdue === 'yes',
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    })
    return { ok: true, ...res }
  }

  @Get('me/overview')
  async overview(@CurrentUser() u: JwtPayload) {
    const [todoRows, inProgressRows, overdueRows, todayDueRows] = await Promise.all([
      this.svc.listByStaff(u, { status: 'todo', pageSize: 9999 }),
      this.svc.listByStaff(u, { status: 'in_progress', pageSize: 9999 }),
      this.svc.listByStaff(u, { onlyOverdue: true, pageSize: 9999 }),
      (async () => {
        const all = await this.svc.listByStaff(u, { pageSize: 9999 })
        const now = new Date()
        const endOfDay = new Date(now)
        endOfDay.setHours(23, 59, 59, 999)
        const items = (all.items || []).filter((t: any) => {
          if (t.status === 'done' || t.status === 'cancelled') return false
          if (!t.dueAt) return false
          const due = new Date(t.dueAt)
          return due.getTime() <= endOfDay.getTime()
        })
        return { ok: true, items, total: items.length }
      })(),
    ])
    return {
      ok: true,
      totals: {
        todo: todoRows.total,
        in_progress: inProgressRows.total,
        overdue: overdueRows.total,
        today: todayDueRows.total,
      },
      today: todayDueRows.items,
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
