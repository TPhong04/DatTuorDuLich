import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import type { JwtPayload } from '../auth/auth.types'
import {
  confirmInquiryDto,
  contractActionDto,
  createContractDto,
  createHandoverDto,
  createInquiryDto,
  createQuotationDto,
  createSettlementDto,
  defaultChecklistDto,
  handoverActionDto,
  inquiryChangeStatusDto,
  listContractsDto,
  listHandoversDto,
  listInquiriesDto,
  listQuotationsDto,
  listSettlementsDto,
  quotationActionDto,
  settlementActionDto,
  suggestAvailableVehiclesDto,
  updateContractDto,
  updateHandoverDto,
  updateInquiryDto,
  updateQuotationDto,
  updateSettlementDto,
} from './dto'
import { RentalsService } from './rentals.service'

@ApiTags('Admin - Thuê xe (Rentals)')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
@Controller('admin/rentals')
export class AdminRentalsController {
  constructor(private readonly rentals: RentalsService) {}

  /* ================= Dashboard Stats ================= */
  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Thống kê nhanh cho màn hình dashboard' })
  async dashboardStats() {
    return this.rentals.dashboardStats('admin')
  }

  /* ================= Auto suggest xe available ================= */
  @Get('suggest-available-vehicles')
  @ApiOperation({ summary: 'Gợi ý xe SẴN SÀNG trong khoảng ngày (không bị conflict lịch với HĐ khác)' })
  async suggestVehicles(@Query() q: unknown) {
    const dto = suggestAvailableVehiclesDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số tìm kiếm xe không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.suggestAvailableVehicles(dto.data)
  }

  /* ================= INQUIRY ================= */
  @Get('inquiries')
  @ApiOperation({ summary: 'Danh sách Yêu cầu thuê xe' })
  async listInquiries(@Query() q: unknown) {
    const dto = listInquiriesDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số lọc không hợp lệ')
    return this.rentals.listInquiries(dto.data)
  }
  @Get('inquiries/:id')
  async getInquiry(@Param('id') id: string) {
    return this.rentals.getInquiryById(id)
  }
  @Post('inquiries')
  async createInquiry(@Body() body: unknown) {
    const dto = createInquiryDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin yêu cầu không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.createInquiry(dto.data)
  }
  @Put('inquiries/:id')
  async updateInquiry(@Param('id') id: string, @Body() body: unknown) {
    const dto = updateInquiryDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin yêu cầu không hợp lệ')
    return this.rentals.updateInquiry(id, dto.data)
  }
  @Patch('inquiries/:id/status')
  async inquiryChangeStatus(@Param('id') id: string, @Body() body: unknown) {
    const dto = inquiryChangeStatusDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin trạng thái không hợp lệ')
    return this.rentals.updateInquiry(id, { status: dto.data.status, cancelReason: dto.data.cancelReason })
  }
  @Patch('inquiries/:id/confirm')
  @ApiOperation({ summary: 'Admin XÁC NHẬN YÊU CẦU thuê xe → chuyển status confirmed, tạo Báo giá PDF, gửi Notif cho User + Staff' })
  async confirmInquiry(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const dto = confirmInquiryDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Dữ liệu xác nhận không hợp lệ: ' + dto.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join(' | '))
    const user = (req as any).user as JwtPayload | undefined
    const actor = user ? { id: user.sub, role: user.role } : undefined
    if (!actor) throw new BadRequestException('Thiếu thông tin phiên đăng nhập')
    return this.rentals.confirmInquiry(id, dto.data, actor as { id: string; role: string })
  }
  @Delete('inquiries/:id')
  async deleteInquiry(@Param('id') id: string) {
    return this.rentals.deleteInquiry(id)
  }

  /* ================= QUOTATION ================= */
  @Get('quotations')
  @ApiOperation({ summary: 'Danh sách Báo giá thuê xe' })
  async listQuotations(@Query() q: unknown) {
    const dto = listQuotationsDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số lọc không hợp lệ')
    return this.rentals.listQuotations(dto.data)
  }
  @Get('quotations/:id')
  async getQuotation(@Param('id') id: string) {
    return this.rentals.getQuotationById(id)
  }
  @Post('quotations')
  async createQuotation(@Body() body: unknown) {
    const dto = createQuotationDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin báo giá không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.createQuotation(dto.data)
  }
  @Put('quotations/:id')
  async updateQuotation(@Param('id') id: string, @Body() body: unknown) {
    const dto = updateQuotationDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin báo giá không hợp lệ')
    return this.rentals.updateQuotation(id, dto.data)
  }
  @Post('quotations/:id/actions')
  async quotationAction(@Param('id') id: string, @Body() body: unknown) {
    const dto = quotationActionDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Hành động báo giá không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.quotationAction(id, dto.data)
  }
  @Delete('quotations/:id')
  async deleteQuotation(@Param('id') id: string) {
    return this.rentals.deleteQuotation(id)
  }

  /* ================= CONTRACT ================= */
  @Get('contracts')
  @ApiOperation({ summary: 'Danh sách Hợp đồng thuê xe' })
  async listContracts(@Query() q: unknown) {
    const dto = listContractsDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số lọc không hợp lệ')
    return this.rentals.listContracts(dto.data)
  }
  @Get('contracts/:id')
  async getContract(@Param('id') id: string) {
    return this.rentals.getContractById(id)
  }
  @Post('contracts')
  async createContract(@Body() body: unknown) {
    const dto = createContractDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin hợp đồng không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.createContract(dto.data)
  }
  @Put('contracts/:id')
  async updateContract(@Param('id') id: string, @Body() body: unknown) {
    const dto = updateContractDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin hợp đồng không hợp lệ')
    return this.rentals.updateContract(id, dto.data)
  }
  @Post('contracts/:id/actions')
  async contractAction(@Param('id') id: string, @Body() body: unknown) {
    const dto = contractActionDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Hành động hợp đồng không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.contractAction(id, dto.data)
  }
  @Delete('contracts/:id')
  async deleteContract(@Param('id') id: string) {
    return this.rentals.deleteContract(id)
  }

  /* ================= HANDOVER (Giao / Thu hồi) ================= */
  @Get('handovers/default-checklist')
  @ApiOperation({ summary: 'Mẫu checklist mặc định Giao xe / Thu hồi xe' })
  async defaultChecklist(@Query() q: unknown) {
    const dto = defaultChecklistDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số checklist mặc định không hợp lệ')
    return this.rentals.getDefaultChecklist(
      dto.data.handoverType as 'pickup' | 'return',
      dto.data.vehicleClass as 'seat' | 'sleeper' | 'limousine' | 'cabin' | undefined,
    )
  }
  @Get('handovers')
  @ApiOperation({ summary: 'Danh sách biên bản Giao / Thu hồi xe' })
  async listHandovers(@Query() q: unknown) {
    const dto = listHandoversDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số lọc không hợp lệ')
    return this.rentals.listHandovers(dto.data)
  }
  @Get('handovers/:id')
  async getHandover(@Param('id') id: string) {
    return this.rentals.getHandoverById(id)
  }
  @Post('handovers')
  @ApiOperation({ summary: 'Tạo biên bản Giao (pickup) / Thu hồi (return) xe' })
  async createHandover(@Body() body: unknown) {
    const dto = createHandoverDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin biên bản không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.createHandover(dto.data)
  }
  @Put('handovers/:id')
  async updateHandover(@Param('id') id: string, @Body() body: unknown) {
    const dto = updateHandoverDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin biên bản không hợp lệ')
    return this.rentals.updateHandover(id, dto.data)
  }
  @Post('handovers/:id/actions')
  async handoverAction(@Param('id') id: string, @Body() body: unknown) {
    const dto = handoverActionDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Hành động biên bản không hợp lệ')
    return this.rentals.handoverAction(id, dto.data)
  }

  /* ================= SETTLEMENT (Tổng kết cuối) ================= */
  @Get('settlements')
  @ApiOperation({ summary: 'Danh sách Bảng kê thanh toán cuối (khi thu hồi xe xong)' })
  async listSettlements(@Query() q: unknown) {
    const dto = listSettlementsDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số lọc không hợp lệ')
    return this.rentals.listSettlements(dto.data)
  }
  @Get('settlements/:id')
  async getSettlement(@Param('id') id: string) {
    return this.rentals.getSettlementById(id)
  }
  @Post('settlements')
  async createSettlement(@Body() body: unknown) {
    const dto = createSettlementDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin bảng kê không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.createSettlement(dto.data)
  }
  @Put('settlements/:id')
  async updateSettlement(@Param('id') id: string, @Body() body: unknown) {
    const dto = updateSettlementDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin bảng kê không hợp lệ')
    return this.rentals.updateSettlement(id, dto.data)
  }
  @Post('settlements/:id/actions')
  async settlementAction(@Param('id') id: string, @Body() body: unknown) {
    const dto = settlementActionDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Hành động bảng kê không hợp lệ')
    return this.rentals.settlementAction(id, dto.data)
  }
}
