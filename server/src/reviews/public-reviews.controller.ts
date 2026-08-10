import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import {
  listReviewsQueryDto,
  createReviewDto,
  reportReviewDto,
  myPendingReviewBookingsQueryDto,
} from './dto'
import { ReviewsService } from './reviews.service'

@Controller('reviews')
export class PublicReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  private parse<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
    try {
      return schema.parse(body)
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.errors[0]
        const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dữ liệu không hợp lệ'
        throw new (require('@nestjs/common').BadRequestException)(msg)
      }
      throw err
    }
  }

  @Get()
  async list(
    @Query('tourId') tourId?: string,
    @Query('tourSlug') tourSlug?: string,
    @Query('rating') rating?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const dto = this.parse(listReviewsQueryDto, { tourId, tourSlug, rating, status, sort, search, page, pageSize })
    return this.reviews.listPublic(dto as any)
  }

  @Get('summary')
  async summary(@Query('tourId') tourId?: string, @Query('tourSlug') tourSlug?: string) {
    return this.reviews.getTourSummary(tourId ?? '', tourSlug ?? null)
  }

  @Get('me/pending-bookings')
  @UseGuards(AccessTokenGuard)
  async myPendingBookings(
    @CurrentUser() actor: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const dto = this.parse(myPendingReviewBookingsQueryDto, { page, pageSize })
    return this.reviews.myPendingReviewBookings(actor.sub, dto)
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  async create(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(createReviewDto, body)
    return this.reviews.create(dto as any, actor)
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard)
  async update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const UpdateReviewSchema = (require('./dto') as typeof import('./dto')).updateReviewDto
    const dto = this.parse(UpdateReviewSchema, body)
    return this.reviews.update(id, dto as any, actor)
  }

  @Post(':id/report')
  async report(
    @CurrentUser() actor: JwtPayload | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Ip() ip?: string,
  ) {
    const dto = this.parse(reportReviewDto, body)
    return this.reviews.report(id, dto as any, actor ?? null, ip ?? null)
  }

  @Post(':id/like')
  @UseGuards(AccessTokenGuard)
  async like(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.reviews.toggleLike(id, actor)
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard)
  async removeSelf(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.reviews.remove(id, actor)
  }

  @Get('me/state')
  @UseGuards(AccessTokenGuard)
  async myState(@CurrentUser() actor: JwtPayload) {
    return this.reviews.canCustomerEditState(actor.sub)
  }
}
