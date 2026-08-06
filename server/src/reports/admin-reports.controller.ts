import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Types } from 'mongoose'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'

import { ReportsService, type ReportBookingsFilterInput, type ReportBookingsGroupKey, type ReportBookingsSortKey, type ReportPeriodPreset } from './reports.service'

function splitCsvList(v: string | undefined): string[] {
  if (!v) return []
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
function toNumberOrNull(v: string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function toIntOrNull(v: string | undefined): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

@Controller('admin/reports')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin', 'staff')
export class AdminReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('financial')
  financialSummary(
    @CurrentUser() user: JwtPayload,
    @Query('preset') preset?: ReportPeriodPreset,
    @Query('from') fromISO?: string,
    @Query('to') toISO?: string,
    @Query('tourTypeCategory') tourTypeCategory?: string,
    @Query('createdBy') createdBy?: string,
    @Query('channel') channel?: string,
  ) {
    return this.service.getFinancialReport({
      preset,
      fromISO,
      toISO,
      tourTypeCategory,
      createdById: createdBy,
      channel,
      userId: user?.sub ? new Types.ObjectId(user.sub) : null,
    })
  }

  @Get('bookings')
  bookingsReport(
    @CurrentUser() user: JwtPayload,
    @Query('preset') preset?: ReportPeriodPreset,
    @Query('from') fromISO?: string,
    @Query('to') toISO?: string,
    @Query('statuses') statuses?: string,
    @Query('paymentStatuses') paymentStatuses?: string,
    @Query('passengerTypes') passengerTypes?: string,
    @Query('paymentMethods') paymentMethods?: string,
    @Query('tourTypeCategory') tourTypeCategory?: string,
    @Query('tourIds') tourIds?: string,
    @Query('departureFrom') departureFromISO?: string,
    @Query('departureTo') departureToISO?: string,
    @Query('createdBy') createdByStaffIds?: string,
    @Query('minAmount') minAmountRaw?: string,
    @Query('maxAmount') maxAmountRaw?: string,
    @Query('search') searchKeyword?: string,
    @Query('channels') channels?: string,
    @Query('groupBy') groupBy?: ReportBookingsGroupKey,
    @Query('sort') sort?: ReportBookingsSortKey,
    @Query('page') pageRaw?: string,
    @Query('pageSize') pageSizeRaw?: string,
  ) {
    const scopeToOwner = user?.role === 'staff'
    const statusArr = splitCsvList(statuses)
    const paymentStatusArr = splitCsvList(paymentStatuses)
    const paxTypes = splitCsvList(passengerTypes) as Array<'NL' | 'TE' | 'EB'>
    const payMethods = splitCsvList(paymentMethods)
    const tourIdArr = splitCsvList(tourIds)
    const staffArr = splitCsvList(createdByStaffIds)
    const channelArr = splitCsvList(channels)
    const input: ReportBookingsFilterInput = {
      preset,
      fromISO,
      toISO,
      statuses: statusArr.length > 0 ? (statusArr as any) : null,
      paymentStatuses: paymentStatusArr.length > 0 ? (paymentStatusArr as any) : null,
      passengerTypes: paxTypes.length > 0 ? paxTypes : null,
      paymentMethods: payMethods.length > 0 ? (payMethods as any) : null,
      tourTypeCategory,
      tourIds: tourIdArr.length > 0 ? tourIdArr : null,
      departureFromISO,
      departureToISO,
      createdByStaffIds: staffArr.length > 0 ? staffArr : null,
      minAmount: toNumberOrNull(minAmountRaw),
      maxAmount: toNumberOrNull(maxAmountRaw),
      searchKeyword,
      channels: channelArr.length > 0 ? channelArr : null,
      groupBy,
      sort,
      page: toIntOrNull(pageRaw) ?? 1,
      pageSize: toIntOrNull(pageSizeRaw) ?? 25,
      scopeToOwner,
      userId: user?.sub ? new Types.ObjectId(user.sub) : null,
    }
    return this.service.getBookingsReport(input)
  }
}
