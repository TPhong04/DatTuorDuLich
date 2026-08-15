import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { TodosService } from '../todos/todos.service'

@Controller('admin/group-tour-requests')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminGtrTodosController {
  constructor(private readonly svc: TodosService) {}

  @Get(':id/todos')
  async getTodosByGtrId(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
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
}
