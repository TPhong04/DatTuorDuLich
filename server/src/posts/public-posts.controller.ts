import { Controller, Get, Param, Query } from '@nestjs/common'
import { PostsService } from './posts.service'

@Controller('posts')
export class PublicPostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.posts.listPublic({
      category: category ?? null,
      tag: tag ?? null,
      search: search ?? null,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 12),
    })
  }

  @Get(':slug')
  detail(@Param('slug') slug: string) {
    return this.posts.getPublicBySlug(slug)
  }
}
