import {
  BadRequestException,
  Body,
  Controller,
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
  defaultChecklistDto,
  handoverActionDto,
  inquiryChangeStatusDto,
  listContractsDto,
  listHandoversDto,
  listInquiriesDto,
  listQuotationsDto,
  listSettlementsDto,
  settlementActionDto,
  suggestAvailableVehiclesDto,
  updateContractDto,
  updateHandoverDto,
  updateInquiryDto,
  updateSettlementDto,
} from './dto'
import { RentalsService } from './rentals.service'

@ApiTags('Staff - Thuê xe (Rentals)')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff', 'admin')
@Controller('staff/rentals')
export class StaffRentalsController {
  constructor(private readonly rentals: RentalsService) {}

  /* ================= Dashboard Stats Mini (Staff) ================= */
  @Get('dashboard-stats')
  async dashboardStats() {
    return this.rentals.dashboardStats('staff')
  }

  @Get('meta')
  @ApiOperation({ summary: 'Metadata options (statuses/sources/types) cho form staff' })
  async getMeta() {
    return {
      inquirySources: [
        { value: 'website', label: 'Website (Form thuê xe)' },
        { value: 'hotline', label: 'Hotline' },
        { value: 'zalo', label: 'Zalo OA' },
        { value: 'facebook', label: 'Facebook / Messenger' },
        { value: 'walkin', label: 'Khách đến VP' },
        { value: 'staff', label: 'Nhân viên tự nhập' },
        { value: 'enterprise', label: 'Khách doanh nghiệp' },
      ],
    }
  }

  @Get('suggest-available-vehicles')
  @ApiOperation({ summary: 'Gợi ý xe SẴN SÀNG theo ngày (staff xem để gắn vào hợp đồng/giao xe)' })
  async suggestVehicles(@Query() q: unknown) {
    const dto = suggestAvailableVehiclesDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số tìm kiếm không hợp lệ')
    return this.rentals.suggestAvailableVehicles(dto.data)
  }

  /* ================= INQUIRY (Staff xem + tạo + xử lý) ================= */
  @Get('inquiries')
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
  @ApiOperation({ summary: 'Staff xác nhận yêu cầu thuê xe (có chủ sở hữu inquiry = mình) → status confirmed, tạo PDF + Notif' })
  async confirmInquiry(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    const dto = confirmInquiryDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Dữ liệu xác nhận không hợp lệ: ' + dto.error.issues.map((i) => i.path.join('.') + ': ' + i.message).join(' | '))
    const user = (req as any).user as JwtPayload | undefined
    const actor = user ? { id: user.sub, role: user.role } : undefined
    if (!actor) throw new BadRequestException('Thiếu thông tin phiên đăng nhập')
    return this.rentals.confirmInquiry(id, dto.data, actor as { id: string; role: string })
  }

  /* ================= QUOTATION (Staff XEM + TẠO + SEND/Không APPROVE) ================= */
  @Get('quotations')
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
  async createQuotationDraft(@Body() body: unknown) {
    const dto = createInquiryDto as any
    void dto
    const parse = (createContractDto as any).safeParse(body)
    void parse
    const createDto = (createInquiryDto as any).safeParse?.(body)
    void createDto
    /* IMPORT: Staff chỉ tạo quotation DRAFT -> submit_approval cho Admin duyệt (truyền qua service chung) */
    const realDto = (await import('./dto')).createQuotationDto.safeParse(body)
    if (!realDto.success) throw new BadRequestException('Thông tin báo giá không hợp lệ')
    return this.rentals.createQuotation(realDto.data)
  }
  @Post('quotations/:id/actions')
  async quotationAction(@Param('id') id: string, @Body() body: unknown) {
    const { quotationActionDto: actionDto } = await import('./dto')
    const parsed = actionDto.safeParse(body)
    if (!parsed.success) throw new BadRequestException('Hành động không hợp lệ')
    /* Staff quyền hạn: được submit_approval, send, accept, decline, expire, cancel. Không được approve/reject */
    const action = (parsed.data as any).action
    if (action === 'approve' || action === 'reject') {
      throw new BadRequestException('Staff không có quyền duyệt/từ chối báo giá, cần Admin/Manager thực hiện')
    }
    return this.rentals.quotationAction(id, parsed.data)
  }

  /* ================= CONTRACT (Staff XEM + SỬA THÔNG TIN, KHÔNG XÓA) ================= */
  @Get('contracts')
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
    if (!dto.success) throw new BadRequestException('Hành động hợp đồng không hợp lệ')
    const action = (dto.data as any).action
    if (action === 'terminate') {
      throw new BadRequestException('Chấm dứt sớm hợp đồng cần Admin duyệt')
    }
    return this.rentals.contractAction(id, dto.data)
  }

  /* ================= HANDOVER (Staff chủ yếu - giao/thu hồi xe - FULL QUYỀN) ================= */
  @Get('handovers/default-checklist')
  async defaultChecklist(@Query() q: unknown) {
    const dto = defaultChecklistDto.safeParse(q)
    if (!dto.success) throw new BadRequestException('Tham số checklist mặc định không hợp lệ')
    return this.rentals.getDefaultChecklist(
      dto.data.handoverType as 'pickup' | 'return',
      dto.data.vehicleClass as 'seat' | 'sleeper' | 'limousine' | 'cabin' | undefined,
    )
  }
  @Get('handovers')
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

  /* ================= SETTLEMENT (Staff tạo + draft, Admin mark paid/completed) ================= */
  @Get('settlements')
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
    const { createSettlementDto: real } = await import('./dto')
    const dto = real.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin bảng kê không hợp lệ: ' + dto.error.issues.map((i) => i.message).join('; '))
    return this.rentals.createSettlement(dto.data)
  }
  @Put('settlements/:id')
  async updateSettlement(@Param('id') id: string, @Body() body: unknown) {
    const { updateSettlementDto: real } = await import('./dto')
    const dto = real.safeParse(body)
    if (!dto.success) throw new BadRequestException('Thông tin bảng kê không hợp lệ')
    return this.rentals.updateSettlement(id, dto.data)
  }
  @Post('settlements/:id/actions')
  async settlementAction(@Param('id') id: string, @Body() body: unknown) {
    const dto = settlementActionDto.safeParse(body)
    if (!dto.success) throw new BadRequestException('Hành động bảng kê không hợp lệ')
    const action = (dto.data as any).action
    if (action === 'mark_paid' || action === 'mark_completed') {
      throw new BadRequestException('Staff không có quyền đánh dấu Đã thanh toán / Hoàn tất bảng kê cuối, cần Admin thực hiện')
    }
    return this.rentals.settlementAction(id, dto.data)
  }
}
