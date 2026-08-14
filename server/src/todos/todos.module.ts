import { Module, forwardRef } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Todo, TodoSchema } from './todo.schema'
import { TodosService } from './todos.service'
import { StaffTodosController } from './staff-todos.controller'
import { AdminTodosController } from './admin-todos.controller'
import { NotificationsModule } from '../notifications/notifications.module'
import { GroupTourRequestsModule } from '../group-tour-requests/group-tour-requests.module'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Todo.name, schema: TodoSchema }]),
    NotificationsModule,
    forwardRef(() => GroupTourRequestsModule),
  ],
  providers: [TodosService],
  controllers: [StaffTodosController, AdminTodosController],
  exports: [TodosService, MongooseModule],
})
export class TodosModule {}
