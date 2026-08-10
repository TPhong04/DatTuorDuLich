import { Injectable, Logger } from '@nestjs/common'
import { SchedulerRegistry } from '@nestjs/schedule'
import { InjectModel } from '@nestjs/mongoose'
import { CronJob } from 'cron'
import { Model, Types } from 'mongoose'
import { Post, PostDocument } from './post.schema'
import { PostsService } from './posts.service'

@Injectable()
export class PostRssImportService {
  private readonly logger = new Logger(PostRssImportService.name)

  constructor(
    private readonly posts: PostsService,
    @InjectModel(Post.name) private readonly model: Model<PostDocument>,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const job = CronJob.from({
      cronTime: '0 0 */1 * * *',
      onTick: () => void this.runCron().catch((e) => this.logger.error(`RSS cron fail: ${e && e.message ? e.message : e}`)),
      timeZone: 'Asia/Ho_Chi_Minh',
    })
    this.scheduler.addCronJob('posts_rss_import_hourly', job)
    job.start()
    this.logger.log('RSS import cron hourly started (Asia/Ho_Chi_Minh)')
  }

  private async runCron() {
    const adminStub = { sub: new Types.ObjectId().toString(), email: 'system-cron@internal.local', role: 'admin' as const }
    const res = await this.posts.importRssFeeds({ feeds: undefined, createAs: 'pending' }, adminStub)
    this.logger.log(`[cron] RSS imported ${res.imported} articles as pending, chờ admin duyệt`)
    return res
  }
}
