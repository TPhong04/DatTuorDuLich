import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ScheduleModule } from '@nestjs/schedule'

import { AuditLogsModule } from '../audit-logs/audit-logs.module'
import { AdminPostsController } from './admin-posts.controller'
import { Post, PostSchema } from './post.schema'
import { PostRssImportService } from './rss-import.service'
import { PostsService } from './posts.service'
import { PublicPostsController } from './public-posts.controller'

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Post.name, schema: PostSchema }]),
    ScheduleModule.forRoot(),
    AuditLogsModule,
  ],
  controllers: [PublicPostsController, AdminPostsController],
  providers: [PostsService, PostRssImportService],
  exports: [PostsService, MongooseModule],
})
export class PostsModule {}
