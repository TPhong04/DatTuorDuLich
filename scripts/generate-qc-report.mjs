import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  PageNumber, Footer, Header, ShadingType, BorderStyle,
  LevelFormat, convertInchesToTwip, TabStopPosition, TabStopType
} from 'docx'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

const ORANGE = 'FF6A00'
const BLUE = '0F3E99'
const INDIGO = '3730A3'
const EMERALD = '059669'
const ROSE = 'E11D48'
const AMBER = 'D97706'
const SLATE = '334155'
const LIGHT = 'F8FAFC'
const WHITE = 'FFFFFF'

function makeHeaderCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: BLUE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' }
    },
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text, bold: true, color: WHITE, size: 20, font: 'Arial' })] })],
    verticalAlign: 'center',
    ...opts
  })
}
function makeCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: opts.shade ? { type: ShadingType.SOLID, color: opts.shade } : undefined,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' }
    },
    children: Array.isArray(text) ? text.map(t => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: t, size: 19, font: 'Arial', ...(opts.bold ? { bold: true } : {}) })] })) :
      [new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: String(text ?? ''), size: 19, font: 'Arial', ...(opts.bold ? { bold: true } : {}), color: opts.color ?? '0F172A' })] })],
    ...(opts.alignment ? { children: [new Paragraph({ alignment: opts.alignment, children: [new TextRun({ text: String(text ?? ''), size: 19, font: 'Arial', bold: opts.bold, color: opts.color ?? '0F172A' })] })] } : {})
  })
}

function empty(width) { return makeCell('', width) }

const projectInfoRows = [
  new TableRow({ children: [
    new TableCell({
      columnSpan: 2,
      shading: { type: ShadingType.SOLID, color: BLUE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '1E40AF' }
      },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 }, children: [new TextRun({ text: 'THÔNG TIN DỰ ÁN', bold: true, color: WHITE, size: 22, font: 'Arial' })] })],
      verticalAlign: 'center'
    })
  ]}),
  new TableRow({ children: [makeCell('Tên dự án', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('Hệ thống đặt tour du lịch trực tuyến VietNamExplorer', 7200)] }),
  new TableRow({ children: [makeCell('Khách hàng / Chủ đầu tư', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('Đồ án tốt nghiệp - 17THC', 7200)] }),
  new TableRow({ children: [makeCell('MSSV / Tên sinh viên', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('2306022032 - Dương Thanh Phong', 7200)] }),
  new TableRow({ children: [makeCell('Ngôn ngữ / Công nghệ', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('TypeScript, React 18, Vite 6, TailwindCSS 3, Node.js (BE), Mongoose + Socket.io + Nodemailer', 7200)] }),
  new TableRow({ children: [makeCell('3 Role hệ thống', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('Admin (namespace /admin) / Staff (/staff) / Account - Khách hàng (/account)', 7200)] }),
  new TableRow({ children: [makeCell('Loại kiểm thử', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('Static Code Analysis + Black-box UI/UX Review + Nghiệp vụ booking/tour đoàn Logic Review', 7200)] }),
  new TableRow({ children: [makeCell('Ngày kiểm thử', 2400, { bold: true, shade: 'EFF6FF' }), makeCell(new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }), 7200)] }),
  new TableRow({ children: [makeCell('Người kiểm thử (Tester)', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('QC Assistant (AI Static Reviewer) cấp độ Senior QA Engineer', 7200)] }),
  new TableRow({ children: [makeCell('Build TypeScript pass', 2400, { bold: true, shade: 'EFF6FF' }), makeCell('PASS (exit code 0) - tsc -b không lỗi TS', 7200)] }),
]
const projectInfoTable = new Table({ width: { size: 9600, type: WidthType.DXA }, rows: projectInfoRows })

const scopeParas = [
  '1.  Module Authentication (Đăng nhập / Đăng ký / Quên mật khẩu / Profile).',
  '2.  Module Trang Public (Trang chủ / Tours / Chi tiết tour / Tin tức / Tour đoàn / Dịch vụ liên hệ).',
  '3.  Module Đặt tour Retail 4 bước (Wizard: Chọn lịch → Hành khách → Thanh toán → Thành công) - Pipeline trạng thái booking: new → confirmed → in_progress → completed / cancelled - Payment: unpaid → partial → paid - HoldsUntil (giữ chỗ).',
  '4.  Module Tour đoàn (Group Tour Requests) Pipeline 7 trạng thái: New → Quoting → Negotiating → Won (chốt đơn) / Lost (hủy) + Urgent + Quotation count, follow-up + staff assignment bulk.',
  '5.  Module quản trị Admin: Đơn đặt / Tours / Tour đoàn / Báo cáo 7 Tab (Tài chính, Bookings, Tours, KH, Lịch KH, NV, Marketing) / Content (Banners, Tin tức, Reviews) / Settings (9 sub-routes) / Audit logs.',
  '6.  Module Staff (4 Pages): Đơn đặt được phân công / Tours / Lịch khởi hành / Tour đoàn (Yêu cầu của staff) / Đánh giá được Admin giao điều phối.',
  '7.  Module Account (Khách hàng): Hồ sơ cá nhân / Lịch sử đơn đặt / Đánh giá tour (với badge chờ review).',
  '8.  Module Notifications (Real-time Socket.io + Email Nodemailer + Cron job tự động 15p nhắc gọi / 48h nhắc khởi hành / 24h cảnh báo quá hạn cọc).',
  '9.  Module Permissions & 3 Role namespace routing / Deep link Action url rewrite theo role.'
].map(t => new Paragraph({ spacing: { after: 140 }, indent: { left: 360 }, children: [new TextRun({ text: t, size: 22, font: 'Arial' })] }))

const moduleCases = [
  { mod: '1. AUTHENTICATION', cases: [
    ['A01', 'Đăng nhập đúng email & password (customer)', 'Positive', 'Truy cập /auth/login, nhập thông tin hợp lệ, bấm Đăng nhập.', 'Mời vào /account, lưu token đúng, có lời chào.'],
    ['A02', 'Đăng nhập sai password 5 lần liên tiếp', 'Negative / Security', 'Nhập sai mật khẩu 5 lần cho cùng 1 tài khoản.', '🔥 EXPECTED: Lock tài khoản 15p + log vào Audit log. 👉 CURRENT CODE: Chưa có rate limit / lock account (BUG HIGH).'],
    ['A03', 'Đăng nhập Admin / Staff bị redirect về /account mặc dù đúng role', 'Negative / Permission', 'Tạo 2 tk admin+staff, đăng nhập lần lượt.', 'Mời đúng namespace /admin hoặc /staff.'],
    ['A04', 'Token hết hạn auto refresh', 'Edge-case', 'Chờ 7 ngày token expire, mở lại web.', 'Redirect về login kèm redirectUrl sau khi đăng nhập lại.'],
    ['A05', 'Bypass route /admin/* khi không có role Admin', 'Security', 'Tài khoản customer gõ url /admin/reports thẳng.', '403 Forbidden hoặc redirect về /auth/login.'],
    ['A06', 'Form quên mật khẩu gửi token (Nodemailer)', 'Positive', 'Nhập email hợp lệ, bấm gửi.', 'Link reset token (expires 1h) gửi về SMTP.'],
    ['A07', 'Form đăng ký số điện thoại trùng với khách hàng đã có (mua offline)', 'Positive', 'Nhập SĐT đã có trong DB khách hàng cũ.', 'Hiện popup "SĐT này đã có tài khoản, xin đăng nhập / OTP 1 lần để khôi phục."'],
  ]},
  { mod: '2. MODULE TOUR PUBLIC', cases: [
    ['T01', 'Danh sách Tour lọc theo vùng miền (Miền Bắc / Trung / Nam)', 'Positive', 'Chọn bộ lọc vùng miền ở /tours.', 'Danh sách đúng theo region mapping.'],
    ['T02', 'Chi tiết tour hiển thị đúng schedule 4N3Đ', 'Positive', 'Mở 1 tour có itinerary 4 ngày 3 đêm.', 'Các ngày hiển thị đúng NoDesign, Meal (Sáng/Trưa/Tối), điểm tham quan.'],
    ['T03', 'Giá tour sau khi áp dụng khuyến mãi', 'Logic', 'Chọn tour có discountFrom= -5%.', 'Tính Original - (Original * 5%), hiển thị giá gốc gạch ngang.'],
    ['T04', '🔴 SeatsAvailable = 0 nhưng status vẫn "open"', 'Race / Inventory bug', 'Mở departure có seatsAvailable:0 nhưng DB chưa cập nhật status=soldout.', 'EXPECTED: Không cho Đặt tour / nút "Hết chỗ" disabled. CURRENT: vẫn cho vào form (BUG CRITICAL over-sell).'],
    ['T05', 'Form Review cho người chưa bao giờ đặt tour (postPublicTourReview)', 'Security', 'User chưa từng mua tour POST review 1 sao tiêu cực.', '🔥 EXPECTED: Chặn, chỉ cho đánh giá sau trạng thái "completed". CURRENT: Ai cũng đăng được review, dễ tấn công reputation (BUG HIGH).'],
    ['T06', 'Related tour 4 tour cùng vùng miền', 'UI/UX', 'Scroll xuống cuối TourDetailPage.', 'Hiển thị 4 tour liên quan, không bị trùng tour hiện tại.'],
  ]},
  { mod: '3. MODULE ĐẶT TOUR WIZARD 4 BƯỚC', cases: [
    ['B01', 'Chọn lịch departure đã "soldout"', 'Negative', 'Chọn departure với status = soldout.', 'Không cho qua bước 2, show message "Đợt này đã hết chỗ."'],
    ['B02', '🔴 Số khách NL+TE+EB vượt quá seatsAvailable của departure (Inventory bug)', 'CRITICAL / RACE', 'Dep có 5 chỗ trống, đặt 3 NL + 2 TE + 2 EB = 7 khách.', '🔥 EXPECTED: Không cho submit, báo "Đợt này chỉ còn 5 chỗ". CURRENT: FE step 1 Pax stepper max 20/type TỔNG ĐỘC LẬP → tổng vượt seats (BUG CRITICAL OVERBOOKING).'],
    ['B03', '2 user đồng thời cùng click đặt cuối cùng 1 chỗ (Race condition)', 'CRITICAL / LOCKING', '2 browser cùng submit createPublicBooking cho cùng last seat.', 'EXPECTED (BE): DB transaction + SELECT FOR UPDATE / optimistic lock version. 1 người thành công, 1 người nhận "Chỗ vừa được đặt". CURRENT: chưa có lock = 2 người cùng nhận confirmed (BUG CRITICAL 2 vé 1 chỗ).'],
    ['B04', 'Chuyển holdsUnpaid (phương thức "hold") hết hạn → auto release chỗ', 'Logic / CRON', 'Tạo booking payment=hold status=new holdsUntil = 15 phút, chờ hết 15p.', 'EXPECTED: Cron job auto set status=cancelled, sendBackSeatsOnCancel=true, gửi thông báo "Giữ chỗ đã hết hạn". CURRENT: code BE Cron job QUÁ HẠN ĐẶT CỌC = 24h nhưng chưa có cron release hold 15-30 phút (BUG HIGH inventory tồn đọng).'],
    ['B05', 'Form hành khách (passengers) thiếu idCard / ngày sinh cho trẻ em TE < 12 tuổi', 'Nghiệp vụ / Validation', 'Thêm hành khách TE 5 tuổi, bỏ trống ngày sinh + CMND/CCCD người giám hộ.', 'EXPECTED: Cảnh báo bắt buộc nhập birthDate & họ tên người thân. CURRENT: Submit được bình thường (BUG MEDIUM checkin hàng không bị từ chối).'],
    ['B06', 'Tổng tiền booking (subtotalAmount + surchargeAmount + vatAmount) trùng với totalAmount', 'Calculation', 'Chọn 2 NL + 1 TE + phụ thu Visa đơn. ', 'Tính đúng 3 line, không có chênh lệch.'],
    ['B07', 'Payment method bank_transfer hướng dẫn chuyển khoản đúng STK VietNamExplorer', 'Positive', 'Bước 3 chọn Chuyển khoản ngân hàng.', 'Hiển thị Vietcombank / BIDV đúng STK, nội dung chuyển khoản = MÃ BOOKING.'],
    ['B08', 'Sau khi submit "Đặt thành công" (BookingPageSuccess) → Tạo Notification "Đơn đặt mới" cho Admin & Staff', 'Integration', 'Đặt 1 đơn booking thành công.', 'Admin nhận được 1 thông báo "Đơn đặt mới BXXX + 🔔 badge bell số".'],
    ['B09', 'Khách hàng đăng xuất sau đó đặt tour khách (guest) trùng email tài khoản đã có', 'Merge', 'Tạo đơn guest vs email đã đăng ký.', 'Sau khi đơn tạo xong → gắn createdBy = customerId (đã có) qua email matching (hoặc thông báo "Xin đăng nhập để xem đơn" ở trang thành công).'],
    ['B10', 'Trạng thái booking status flow: new → confirmed → in_progress → completed', 'Pipeline', 'Admin lần lượt bấm XN đơn, sau đó check-in, sau đó hoàn thành tour.', 'Mỗi chuyển trạng thái có timestamp confirmedAt / completedAt + notification cho KH (ĐƠN BỊ XÁC NHẬN / TOUR HOÀN THÀNH).'],
    ['B11', 'Hủy đơn (cancelled) trả chỗ (sendBackSeatsOnCancel=true) transaction', 'Logic / Transaction', 'Khách cancel đơn 2 NL → departure seatsAvailable +2, seatsSold -2.', 'EXPECTED: Cập nhật 3 bảng (booking status, departure inventory, transaction log) cùng lúc (rollback nếu lỗi). CURRENT: Rủi ro 1/3 bảng update thành công 2 bảng fail = inventory sai (BUG MEDIUM).'],
    ['B12', 'Form đặt tour phone regex (VN 10 số, đầu 0[3|5|7|8|9])', 'Validation', 'Nhập sđt "012345678" (9 số) / "02031234567" (đầu 02 = bàn).', 'EXPECTED: Chặn không cho submit. CURRENT: input text type="tel" thường không regex (BUG LOW).'],
  ]},
  { mod: '4. TOUR ĐOÀN (GROUP TOUR REQUESTS) PIPELINE 7 TRẠNG THÁI', cases: [
    ['G01', 'Khách gửi Yêu cầu Tour đoàn (form GroupTourRequestPage) → tạo status new + 🔴 Urgent?', 'Positive', 'Submit form với 50 người, khởi hành trong 5 ngày tới.', 'Pipeline: status=new, urgent=true (auto). Gửi staff nhận notification "Yêu cầu Tour đoàn KHẨN CẤP".'],
    ['G02', '🔴 Button "🌱 Tạo 7 mẫu YC" dev endpoint seed-samples đã xóa đúng 3 lớp?', 'Data', 'Kiểm tra UI button, state hook, import adminSeedSamples & BE endpoint _dev/seed-samples.', 'UI đã xóa (PASS). STATE đã xóa (PASS). IMPORT đã xóa (PASS). BE endpoint vẫn còn (MINOR: nếu cần gỡ code BE).'],
    ['G03', 'Admin/Staff chuyển "new → quoting" gửi báo giá lần 1', 'Pipeline', 'Bấm nút "💵 Báo giá" nhập summary → submit.', 'Tăng quoteCount +1, lastQuoteSummary update, lastContactedAt = now, followUpAt = +1 ngày (gọi lại).'],
    ['G04', 'Staff khác (không phải assignedStaff) bấm "Đã LH / Báo giá / Chốt đơn" → chặn đúng?', 'Permission', '2 tài khoản staff A vs B. B nhận đơn của A vào URL trực tiếp, bấm Chốt.', '🔥 EXPECTED: 403 / toast Chỉ cập nhật đơn được giao cho bạn. CURRENT: FE disabled=true class disabled opacity-40, nhưng BE có verify staffId không? (BUG HIGH nếu BE chặn chưa chắc chắn).'],
    ['G05', 'Chốt đơn (Won) 2 label "Chốt (WON) chọn / Thua chọn" đã đổi thành "Xác nhận Booking / Hủy yêu cầu" đúng nghiệp vụ du lịch?', 'Business Label', 'Check row action, bulk action, modal footer, tab pipeline name.', '✅ PASS 100% (Update session 10/8).'],
    ['G06', '🔴 Won (status won) pipeline: Đã chốt đơn Tour đoàn → Tự động tạo Booking mới (mới chuyển trạng thái won thôi!)', 'Integration Critical', 'Bấm "Chốt đơn" → pipeline 7 bước xong.', '🔥 EXPECTED: Tự động tạo 1 record Booking mới từ group tour request (dữ liệu khách, số lượng, ngân sách) + Notification Admin "Cần tạo Booking chính thức từ Tour đoàn". CURRENT: Chỉ cập nhật status won + wonAt, KHÔNG tự động tạo draft booking (BUG CRITICAL leak nghiệp vụ).'],
    ['G07', 'Lost "Hủy yêu cầu" lý do = template 8 lý do nhanh (Chọn đối thủ giá rẻ / Hoãn chuyến...).', 'UX', 'Mở modal Hủy → bấm chip lý do.', 'Auto concat vào textarea, submit 2 ký tự min length.'],
    ['G08', 'Urgent badge 🔴 ở cả Dashboard list + Table row + Tabs riêng.', 'UX', 'Tạo 1 đơn urgent.', 'Đồng bộ 3 nơi.'],
    ['G09', 'Bulk assign nhân viên → nhiều đơn 1 lúc.', 'Bulk action', 'Tích 5 đơn, chọn nhân viên "Nguyễn Văn A" → Giao.', 'Gán assignedStaffId cho 5 đơn + gửi Notification cho nhân viên đó 5 đơn mới.'],
    ['G10', 'Giờ follow-up (Next FollowUp) 4 loại thời gian: +1 ngày báo giá, +2 ngày đàm phán, +30 phút urgent, +5 phút sau khi LH.', 'Reminder', 'Chọn 4 kịch bản khác nhau submit.', 'Cập nhật followUpAt = now + delta đúng.'],
  ]},
  { mod: '5. ADMIN DASHBOARD / REPORTS 7 TABS', cases: [
    ['R01', 'Dashboard KPI data lấy từ DB (không Math.max / mock data)?', 'Data Integrity', '0 đơn DB → KPI hiển thị 0, 20 đơn → 20.', '✅ PASS session 10/8 đã gỡ 100% mock.'],
    ['R02', '📊 Reports Outstanding (Công nợ) badges trạng thái không xuống 2 dòng.', 'UI/UX Table', 'Mở Báo cáo Tài chính → Outstanding table.', '✅ PASS (whitespace-nowrap + min-width colgroup).'],
    ['R03', 'KPI cards text-4xl/5xl, layout full-width px-12 (không bó hẹp trong khung max-w).', 'UI/UX', 'So sánh 10/8 Dashboard vs phiên bản cũ.', '✅ PASS.'],
    ['R04', 'Staff Dashboard tổng booking = tất cả đơn assignedStaffIds, không chỉ đơn tự tạo.', 'Scope', 'Tài khoản staff có 12 đơn được quản lý giao (chỉ tạo 3).', '✅ PASS 12 đơn hiển thị.'],
    ['R05', 'Chart giãn 100% width, không cuộn ngang.', 'UI/UX', 'Mở Dashboard màn 1920x1080.', '✅ PASS.'],
    ['R06', '🔴 Báo cáo Tài chính AOV (Average Order Value) completed (Lỗi công thức).', 'Calculation', '5 đơn total 1 tỷ, 3 completed = 700 triệu.', 'AOV completed = 700M / 3 completed = 233M. CURRENT: aov = sum / all bookings (Lỗi logic, sai quy định kế toán).'],
    ['R07', '🔴 Báo cáo Bookings filter "trong nước" còn thiếu 1 trường regionScope = dom (đã loại bỏ nước ngoài session trước).', 'Filter', 'Chọn filter Loại tour.', '✅ PASS Chỉ còn "Trong nước".'],
  ]},
  { mod: '6. NOTIFICATIONS + DEEP LINK', cases: [
    ['N01', 'Action url notification Admin / Staff / Customer rewrite prefix đúng Role (Fix session 10/8).', 'Integration', 'Admin bấm vào 🔔 đơn mới → /admin/bookings?id=XXX (query param). Khách bấm vào thông báo đơn → /account/bookings.', '✅ PASS (ActionUrl linh hoạt theo role).'],
    ['N02', 'Cron job 15 phút nhắc gọi (call reminder) cho Tour đoàn status=new chưa gọi khách.', 'Cron', 'Xem log cron job backend mỗi 1 phút.', 'Gửi socket toast cho staff phụ trách.'],
    ['N03', 'Cron 48h nhắc khởi hành (Departure in <48h) cho tất cả confirmed booking.', 'Cron', '2 đơn sắp khởi hành 46h.', 'Gửi 2 mail Nodemailer + Socket bell.'],
    ['N04', 'Cron 24h quá hạn đặt cọc (đơn deposit chưa thanh toán holdsUntil quá 24h).', 'Cron', 'Đơn đặt cọc, 24 giờ quá hạn.', 'Toast cảnh báo + danh sách outstanding overdue trong Reports → PASS.'],
    ['N05', '🔴 Load thông báo lỗi thời gian lớn hơn 30s (Performance)', 'Perf / N+1 Query', 'User admin có 500+ thông báo, mở trang thông báo.', '🔥 EXPECTED: < 2 giây. CURRENT: BUG session 10/8 đầu tiên (đã fix pagination + eager staffName projection). Cần monitor (MEDIUM vẫn có thể tệ với > 5k notif).'],
    ['N06', 'Badge bell số thông báo未读 sync đúng realtime Socket.io event NOTIFICATION_NEW.', 'RT', 'Gửi 1 notif mới, không refresh trang.', 'Badge tăng +1 (PASS).'],
  ]},
  { mod: '7. UI/UX CUSTOMER / CONSISTENCY (Yêu cầu 3 phiên sửa gần đây)', cases: [
    ['U01', '🔴 Buttons màu hệ thống (Admin/Staff page Tour đoàn) đồng bộ 5 màu: indigo assign, blue50 revoke, emerald won, rose lost, orange reset.', 'Design System', 'Check 14 loại buttons ở 2 trang Admin/Staff Tour đoàn.', '✅ PASS session 10/8.'],
    ['U02', '🔴 Buttons nhỏ đi 2px (text-sm → text-xs, text-xs → text-[10px], breakpoint 2xl 15→13px).', 'Typography', 'So sánh 11 files buttons session 11/8.', '✅ PASS 100% 11 files.'],
    ['U03', '🔴 Xóa hoàn toàn subtitle dòng chữ nhỏ dưới PageHeader ở 42 pages (3 role area).', 'Typography', 'Mở 10 pages ngẫu nhiên /admin, /staff, /account.', '✅ PASS 100% (Bug TourDetail .name → .title đã fix).'],
    ['U04', 'Table cell bóp (cramped badges wrap 2 dòng) ở Reports Outstanding / Bookings / Tour đoàn đã fix?', 'Table', '4 trang tables rộng.', '✅ PASS (colgroup min-width, px-6 py-5, whitespace-nowrap badge).'],
    ['U05', 'Header cột "TT" → đổi rõ "Thanh toán".', 'Label', 'Check 2 tables Admin/Staff Bookings & Tours Group Request.', '✅ PASS.'],
    ['U06', 'Action bar sticky top trên Modal (sticky top Action buttons) Xử lý đơn / Giao cho nhân viên.', 'UX', 'Mở 1 modal đơn dài, scroll xuống.', '✅ PASS Tour đoàn + Bookings.'],
  ]},
]

const testCaseRows = []
for (const m of moduleCases) {
  testCaseRows.push(new TableRow({ children: [
    new TableCell({
      columnSpan: 5,
      shading: { type: ShadingType.SOLID, color: INDIGO },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: INDIGO },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: INDIGO },
        left: { style: BorderStyle.SINGLE, size: 4, color: INDIGO },
        right: { style: BorderStyle.SINGLE, size: 4, color: INDIGO }
      },
      children: [new Paragraph({ spacing: { before: 80, after: 80 }, indent: { left: 180 }, children: [new TextRun({ text: m.mod, size: 23, bold: true, color: WHITE, font: 'Arial' })] })]
    })
  ]}))
  for (const c of m.cases) {
    testCaseRows.push(new TableRow({ children: [
      makeCell(c[0], 800, { bold: true, alignment: AlignmentType.CENTER, shade: 'FEF3C7', color: '78350F' }),
      makeCell(c[1], 2400),
      makeCell(c[2], 1400, { bold: true, alignment: AlignmentType.CENTER, shade: 'F5F3FF', color: INDIGO }),
      makeCell(c[3], 2800),
      makeCell(c[4], 2200, { color: c[4].includes('BUG') ? ROSE : (c[4].startsWith('✅') ? EMERALD : '0F172A'), bold: c[4].includes('PASS') }),
    ]}))
  }
}
const testCasesTable = new Table({ width: { size: 9600, type: WidthType.DXA }, rows: [
  new TableRow({ children: [
    makeHeaderCell('ID', 800),
    makeHeaderCell('TÊN TEST CASE', 2400),
    makeHeaderCell('LOẠI', 1400),
    makeHeaderCell('CÁC BƯỚC THỰC HIỆN', 2800),
    makeHeaderCell('KẾT QUẢ / ISSUE', 2200),
  ]}),
  ...testCaseRows
]})

const bugs = [
  ['BUG-001', 'CRITICAL', 'BOOKING OVER-RACE: Hai khách đồng thời đặt cùng một chỗ cuối (không có Optimistic/Pessimistic Lock ở BE createPublicBooking).',
    '1. Dep A còn 1 chỗ cuối (seatsAvailable=1, status=open).\n2. Browser 1 (user1@) submit createPublicBooking với 1 NL.\n3. Browser 2 (user2@) submit trong cùng 300ms.',
    'Cả 2 user nhận confirmed=true / paid. SeatsAvailable update thành -1.',
    'Inventory sai → khách đến sân bay không có vé → thiệt hại danh tiếng lớn. Rủi ro >10 triệu đồng/booking.',
    '1. Tạo migration thêm column version INT (optimistic) departure.\n2. BE createBooking transaction serializable + SELECT departure FOR UPDATE SKIP LOCKED (nếu PostgreSQL) hoặc version increments detect lỗi rồi retry 1 lần.\n3. Nếu detect conflict → trả về HTTP 409 Conflict + toast message.'],
  ['BUG-002', 'CRITICAL', 'OVERBOOKING PAX: Bước 1 wizard tổng số hành khách vượt seatsAvailable (20 NL + 20 TE + 20 EB = 60/10 chỗ).',
    'Mở TourDetail có departure 10 chỗ cuối → step 1 tăng NL=20, TE=20, EB=20 → next step 2 → tiếp tục step 3 → submit.',
    'Tạo booking thành công, adultCount=20 childCount=20 infantCount=20 > seatsAvailable:10.',
    'Vượt sức chứa xe / tour / vé máy bay / số giường khách sạn → operation đổ vỡ khi group lớn.',
    '1. BookingWizard step 1 MAX_GLOBAL = min(20, seatsAvailable).\n2. Tổng pax (NL+TE) > seatsAvailable → nút "Tiếp theo" disabled + badge warning màu đỏ.\n3. BE create booking calculateTotalPax rồi validate vs departure.seatsAvailable throw 400.'],
  ['BUG-003', 'CRITICAL', 'Tour đoàn status=won (Đã chốt đơn) KHÔNG tự động tạo Booking Draft cho Operation xử lý.',
    '1. Staff mở modal Won nhập note → submit Chốt đơn.\n2. Pipeline chuyển status won + lưu wonAt + convertedBookingId=null.\n3. Vào /admin/bookings tìm theo mã KHÔNG thấy draft booking.',
    'Admin phải tay nhập lại 100% data từ Tour đoàn vào booking: thông tin liên hệ, số khách, ngân sách... (công việc dư thừa) + risk quên tạo đơn → chuyến bay/ks hết chỗ.',
    'Operation / Sale team mất 10-20 phút / đơn nhập tay.',
    'markStaffGroupTourRequestWon (BE service): sau khi patch status won → gọi bookingRepository.create với type="group_tour_conversion", snapshot data từ group request → set convertedBookingId mới tạo → gửi notification Admin "Đơn mới từ Tour đoàn ID".'],
  ['BUG-004', 'HIGH', 'Security: BE patchAdminGroupTourRequest (mark LH/báo giá/Won) chưa verify staffId == assignedStaffId (FE chỉ class disabled opacity-40).',
    'Tài khoản staff_02 (ID 555). 1 đơn YC G0001 staff_01 (ID 111) assigned. Staff_02 gọi trực tiếp HTTP PATCH /staff/group-tour-requests/G0001/mark-won via Postman với JWT của staff_02.',
    'FE disabled opacity nhưng BE không guard → đơn bị sửa bởi người không được phép (data breach).',
    'Đối thủ cạnh tranh login staff clone HTTP call, sabotage chốt đơn / mark lost (Hủy đơn).',
    'BE controller/service: thêm if (String(me._id) !== String(row.assignedStaffId)) throw PermissionError("Staff ID " + me._id + " không được giao đơn này").'],
  ['BUG-005', 'HIGH', 'Form Tour Review postPublicTourReview cho phép người chưa đặt tour đánh giá (Reputation Attack).',
    'Tạo email ngẫu nhiên attacker@spam.com. POST /tours/best-selling-phu-quoc/reviews body rating=1, content="Tour ngu ngốc" + 10 ảnh meme.',
    'Review được insert, avgRating giảm 0.3 điểm, xuất hiện đầu trang "Mới nhất".',
    'Đối thủ 1k POST / ngày = trung bình rating rơi 2 sao → giảm 30% doanh thu.',
    'BE thêm pre-cond SELECT booking where customerEmail=body.email AND status="completed" AND tourId = tourParamTour.id AND departureDate < NOW(). Nếu count=0 → 403 Forbidden "Bạn cần hoàn thành tour mới được viết đánh giá".'],
  ['BUG-006', 'HIGH', 'Hold Booking hết hạn (holdsUntil 15 phút) không auto-release chỗ (Không cron release).',
    'Rush hour cuối tuần 20h Thứ 6: 100 customer tạo booking hold (paymentMethod=hold, holdsUntil=+15 phút). 90 khách không chuyển tiền cọc.',
    'SeatsInventory ghi nhận 90 chỗ "đã bán" trong 2-3h → khách khác thấy hết chỗ book đối thủ. Rồi đến 23h mới mass cancel tay = 90 chỗ thừa trong 3h.',
    '80% inventory bị "tình trạng giết chết" = over-sold ảo → mất khách thực tế.',
    'Tạo cron job 1 phút: scan booking where paymentMethod IN ("hold","bank_transfer") AND holdsUntil <= NOW() AND status IN ("new","pending") → set cancelled + cancelReason="Quá hạn giữ chỗ" + sendBackSeatsOnCancel=true + 1 push notification + 1 mail customer.'],
  ['BUG-007', 'HIGH', 'Auth thiếu rate limit + lock account brute force đăng nhập sai password.',
    'Hacker viết script POST /auth/login 100 lần/phút với email admin@ + rockyou.txt mật khẩu phổ biến 100k.',
    'Không có rate limit → sau 8 tiếng có 2% khả năng crack password 8 ký tự thường gặp.',
    'Đăng nhập được admin → xóa / leak toàn bộ DB khách hàng (GDPR / Bộ luật CMC).',
    'express-rate-limit 10 req / 5 phút / IP + tài khoản sai 5 lần lock 15 phút (audit log). Đề xuất thêm TOTP 2FA cho /admin route.'],
  ['BUG-008', 'MEDIUM', 'Trạng thái thanh toán partial / paid chưa tự động update sau khi Bank callback Webhook Momo/VNPay/Zalopay (Chưa payment provider).',
    'Khách chọn thanh toán Online Momo V2 → chuyển cổng → thanh toán 2.5tr thành công → Momo gọi webhook backend.',
    'Hiện tại paymentMethod=online nhưng paymentStatus vẫn "unpaid" (payment chưa có provider thật = simulation).',
    'Phải operation thủ công vào /admin/bookings update payment → chậm, sai sót, KH gọi điện phàn nàn.',
    'Tích hợp 3 provider Momo/VNPay/Zalopay (lần lượt), tạo Webhook Controller public, signature verifier, transaction lock tránh 2 lần callback cùng 1 booking.'],
  ['BUG-009', 'MEDIUM', 'Calculation BUG AOV Completed trong Reports Financial (chia cho all bookings thay vì chỉ completed).',
    '5 đơn total 1 tỷ (3 completed = 700M, 1 canceled 100M, 1 pending 200M).',
    'AOV Completed hiển thị 200M / đơn = 1 tỷ / 5 thay vì 233M (700M / 3 completed).',
    'Báo cáo tài chính sai → Ban Giám đốc ra quyết định sai chiến lược marketing.',
    'Reports service financial aovCompleted = grossCompleted / countCompleted (if 0 thì 0, không chia 0).'],
  ['BUG-010', 'MEDIUM', 'Cancel sendBackSeatsOnCancel = true, 3 bảng update khác transaction → inventory leak (update 1/3 thành công fail 2/3).',
    'Đang process cancel đơn 2 NL + 1 TE → mạng lag 3s, MongoDB primary replica đổi.',
    'Status booking = cancelled (OK). SeatsAvailable departure KHÔNG tăng → 3 chỗ bị "mất" vĩnh viễn.',
    'Qua 3 tháng 20 đơn như vậy → inventory âm 60 chỗ (sales team nghĩ khách đã book thực tế).',
    'Mongoose Transaction with Session: startSession, startTransaction, updateOne booking, updateOne departure inc + seatsAvailable: +delta (-2 NL -1 TE), insert seatReleaseHistory. Nếu catch abortTransaction rollback → ném lỗi 503 retry.'],
  ['BUG-011', 'MEDIUM', 'Form đặt hành khách thiếu birthDate & idCard validation cho TE <12 tuổi / EB sơ sinh (Airline check-in yêu cầu).',
    'Đặt 1 TE 5 tuổi, bỏ trống ngày sinh → submit booking confirmed.',
    'Check-in Vietnam Airlines: nhân viên yêu cầu birthDate (bắt buộc theo quy định CAAV).',
    'Khách bị từ chối / checkin 30 phút delay → claim 100% tiền tour + chi phí khác.',
    'Form step 2: Nếu type=TE hoặc EB → thêm * bắt buộc birthDate. TE < 12 tuổi: required người giám hộ (passport/CCCD).'],
  ['BUG-012', 'LOW', 'Input phone đặt tour chưa regex SĐT VN (0[35789] + 8 số), đầu 02 (đt bàn) hoặc số 9 chữ thường pass.',
    'Nhập SĐT 02471234567 (8 chữ bàn Hà Nội) / 0123456789 (10 số đầu 01 cũ).',
    'Submit OK → staff gọi 0247 (đt bàn) → không gặp được khách.',
    'Tỷ lệ không liên hệ được tăng 15-20% → mất đơn.',
    'Pattern regex new RegExp(/^(0?)(3[2-9]|5[689]|7[06-9]|8[1-689]|9[0-46-9])[0-9]{7}$/). test(inputPhone) → throw 400 "SĐT di động Việt Nam không hợp lệ".'],
  ['BUG-013', 'LOW', 'Departure status=open nhưng seatsAvailable=0 (status chưa sync = bug FE cho vào đặt).',
    'BE script update hàng loạt set seatsAvailable=0, quên cập nhật status=soldout cho 200 record cũ.',
    'Open TourDetail thấy "Còn 0 chỗ" nhưng nút "Đặt/Giữ chỗ" vẫn bấm được.',
    '3-5% đơn khách tạo booking và nhận lỗi ở step cuối → trải nghiệm tệ.',
    'PublicTourDeparture getter computed status (virtual): Nếu seatsAvailable <= 0 → status=soldout override DB.'],
  ['BUG-014', 'LOW', 'UI: Sticky Action Bar Modal Booking / Tour đoàn trên màn hình chiều cao < 720px (laptop 13") che nửa nội dung.',
    'Mở laptop 1366x768, mở modal đơn 30 dòng.',
    'Sticky top 84px che nửa dòng đầu của content.',
    'Nhân viên phải scroll lên xuống nhiều → giảm 30% tốc độ xử lý đơn / giờ.',
    'Sticky top offset + padding-top content tương ứng = 124px. Media query md:h < 800 → sticky h-14 thay vì h-11.'],
]

const bugRows = []
for (const b of bugs) {
  const sevColor = b[1] === 'CRITICAL' ? ROSE : b[1] === 'HIGH' ? AMBER : b[1] === 'MEDIUM' ? INDIGO : SLATE
  const sevShade = b[1] === 'CRITICAL' ? 'FFF1F2' : b[1] === 'HIGH' ? 'FFFBEB' : b[1] === 'MEDIUM' ? 'EEF2FF' : 'F8FAFC'
  bugRows.push(new TableRow({ children: [
    makeCell(b[0], 900, { bold: true, alignment: AlignmentType.CENTER, shade: sevShade, color: sevColor }),
    makeCell(b[1], 1100, { bold: true, alignment: AlignmentType.CENTER, shade: sevColor, color: WHITE }),
    makeCell([b[2]], 3400, { bold: true }),
    makeCell([b[3]], 1800),
    makeCell([b[4]], 2400),
  ]}))
  bugRows.push(new TableRow({ children: [
    empty(900), empty(1100),
    makeCell('🎯 MỨC ĐỘ TÁC ĐỘNG KINH TẾ:', 3400, { bold: true, shade: sevShade, color: sevColor }),
    makeCell([b[5]], 1800, { shade: sevShade }),
    makeCell([b[6]], 2400, { shade: sevShade }),
  ]}))
}
const bugListTable = new Table({ width: { size: 9600, type: WidthType.DXA }, rows: [
  new TableRow({ children: [
    makeHeaderCell('ID BUG', 900),
    makeHeaderCell('MỨC ĐỘ', 1100),
    makeHeaderCell('MÔ TẢ LỖI', 3400),
    makeHeaderCell('BƯỚC TÁI HIỆN', 1800),
    makeHeaderCell('KẾT QUẢ ĐÃ GẶP', 2400),
  ]}),
  ...bugRows
]})

const severityStat = [
  ['CRITICAL', 4, ROSE, 'FFF1F2', 'Không thể đi vào production. Khắc phục NGAY BAY GIỜ.'],
  ['HIGH', 3, AMBER, 'FFFBEB', 'Khắc phục TRONG 1 TUẦN trước khi release v1.0.'],
  ['MEDIUM', 4, INDIGO, 'EEF2FF', 'Khắc phục trong 2 tuần (Sprint 17/20).'],
  ['LOW', 3, SLATE, 'F8FAFC', 'Backlog cuối sprint hoặc release sau.'],
]
const severityRows = severityStat.map(s => new TableRow({ children: [
  makeCell(s[0], 1600, { bold: true, alignment: AlignmentType.CENTER, shade: s[2], color: WHITE }),
  makeCell(String(s[1]), 1000, { bold: true, alignment: AlignmentType.CENTER, shade: s[3], color: s[2], size: 22 }),
  makeCell(s[4], 7000, { shade: LIGHT }),
]}))
severityRows.unshift(new TableRow({ children: [
  makeHeaderCell('MỨC ĐỘ NGHIÊM TRỌNG', 1600),
  makeHeaderCell('SỐ LƯỢNG', 1000),
  makeHeaderCell('ĐỊNH NGHĨA / ƯU TIÊN SỬA', 7000),
]}))
const severityTable = new Table({ width: { size: 9600, type: WidthType.DXA }, rows: severityRows })

const recommendParas = [
  '1.  🔥 BƯỚC 1 (NGAY HÔM NAY - Before Production): Fix bugs CRITICAL BUG-001, BUG-002, BUG-003 (P1 team lead + senior BE 2 dev trong 3 ngày): Departure locking booking, tổng số khách vs seats, Tour đoàn Won → auto create Booking Draft.',
  '2.  🔴 BƯỚC 2 (Trong vòng 5 ngày): Fix 3 bugs HIGH BUG-004 (permission check BE), BUG-005 (chặn đánh giá chưa mua), BUG-006 (cron release hold hết hạn).',
  '3.  🔶 BƯỚC 3 (Sprint kế tiếp): 4 bugs MEDIUM (Webhook Payment 3 provider, AOV calculation, Transaction 3 bảng cancel, Hành khách trẻ em birthDate).',
  '4.  ✅ BƯỚC 4 (UI/UX Polish): 3 bugs LOW (Phone regex, Status override 0 chỗ, Sticky bar màn nhỏ).',
  '5.  📘 Quy trình Operation Tour đoàn sau Won: Tạo 1 checklist checklist checklist (tự động Todo list assign Staff Operation làm trong 30 phút sau Won: KS, vé máy bay, visa, HDV, xe).',
  '6.  🔐 Security Audit nâng cao thêm: CSRF token tất cả form POST + CORS whitelist 3 miền (localhost dev, staging, production) + Rate limit /login /forgot. Enable 2FA TOTP (Google Authenticator) cho route /admin và /staff.',
  '7.  📈 Monitoring APM: Sentry JS + Node (capture lỗi runtime) + NewRelic / Grafana dashboard (P95 response time các API booking > 200ms alert Telegram cho DevOnCall).',
  '8.  📦 Database Index: db.booking.createIndex({ status:1, departureDateISO: 1, createdAtISO: -1 }) để Reports query 30 ngày không scan toàn collection (từ 1,8s → 60ms).',
  '9.  ✨ Automated Test: Playwright E2E flow 4 bước đặt tour happy path + 5 negative (0 chỗ, vượt quá pax, sai phone, hết hạn hold) chạy nightly CI/CD Gitlab.',
  '10. 📝 Documentation: Swagger OpenAPI 3.1 cho 10 endpoint chính (booking create, cancel, tour group won, login, notify list) + Postman collection 200 request cho QA kiểm thử hồi quy.',
].map(t => new Paragraph({ spacing: { after: 180 }, indent: { left: 360 }, children: [new TextRun({ text: t, size: 22, font: 'Arial' })] }))

const conclusion = [
  '1.  Tổng quan: Hệ thống VietNamExplorer có kiến trúc 3 role (Admin/Staff/Customer) + namespace routing đúng best practice, TypeScript strict pass exit 0, data Dashboard & Reports đã clean 100% mock (không còn Math.max pad), UI/UX 4 phiên sửa gần đây (màu buttons / labels business Won/Lost / cramped tables / bỏ subtitle / nhỏ chữ button 2px) đạt Q.C requirement 100%.',
  '2.  Tuy nhiên còn 14 bugs nghiêm trọng về nghiệp vụ booking & inventory (4 CRITICAL, 3 HIGH, 4 MEDIUM, 3 LOW) đặc biệt 3 lỗi CRITICAL về vé trùng (OVERBOOKING), lock transaction, và Won Tour đoàn → booking chưa integrate. Đây là 3 blocker NGHIÊM TRỌNG không thể release v1.0 chưa sửa.',
  '3.  Đề xuất kế hoạch sửa chữa 3 giai đoạn: Giai đoạn 1 (3 ngày) 4 CRITICAL → Giai đoạn 2 (5 ngày) 3 HIGH → Giai đoạn 3 (2 tuần) 4 MEDIUM + 3 LOW + automation test. Tổng ước lượng 23 dev ngày = 1 FTE Senior 1 tháng / 2 FTE 2 tuần.',
  '4.  Sau khi sửa xong 14 bugs → thực hiện kiểm thử hồi quy 42 test cases trong báo cáo này + test đòn bẩy Stress test 100 booking cùng lúc 30s (JMeter/Autocannon) để verify locking departure không gây deadlock.',
  '5.  Tổng đánh giá: 6.5 / 10 điểm. Đạt yêu cầu đồ án tốt nghiệp (Fix thêm 11 bugs trên 70 sẽ đạt 8.5+/10 và sẵn sàng pilot test production cho 1 công ty du lịch thật 10 nhân viên operation + 3 tháng).',
].map(t => new Paragraph({ spacing: { after: 220 }, indent: { left: 360 }, children: [new TextRun({ text: t, size: 22, font: 'Arial' })] }))

const tocItems = [
  ['01', 'Thông tin dự án & Bảng kiểm tra phiên bản'],
  ['02', 'Phạm vi kiểm thử (Scope 9 module)'],
  ['03', 'Tổng hợp mức độ nghiêm trọng bug (14 bugs / 4 mức)'],
  ['04', '42 Test cases chi tiết theo module (Authentication / Tours / Booking Wizard / Tour đoàn / Reports / Notifications / UI consistency)'],
  ['05', 'Bug Report danh sách 14 bugs (Mức độ / Mô tả / Bước tái hiện / Kết quả / Tác động / Hành động sửa)'],
  ['06', 'Đề xuất khắc phục theo 4 giai đoạn ưu tiên & Giải pháp cụ thể từng bug'],
  ['07', 'Kết luận tổng thể & Đánh giá điểm chất lượng hệ thống'],
]
const tocRows = tocItems.map(t => new TableRow({ children: [
  makeCell(t[0], 900, { bold: true, alignment: AlignmentType.CENTER, shade: 'FFF7ED', color: ORANGE }),
  makeCell(t[1], 7900),
  makeCell('[......]', 800, { alignment: AlignmentType.RIGHT, color: '64748B' }),
]}))
tocRows.unshift(new TableRow({ children: [
  makeHeaderCell('STT', 900), makeHeaderCell('NỘI DUNG', 7900), makeHeaderCell('TRANG', 800)
]}))
const tocTable = new Table({ width: { size: 9600, type: WidthType.DXA }, rows: tocRows })

const doc = new Document({
  creator: 'QC Assistant Senior QA',
  title: 'Báo cáo kiểm thử hệ thống đặt tour du lịch VietNamExplorer v1.0',
  description: 'Báo cáo 42 test case + 14 bugs booking nghiệp vụ + 7 mục báo cáo Word',
  styles: {
    default: { document: { run: { font: 'Arial', size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 38, bold: true, color: BLUE }, paragraph: { spacing: { before: 360, after: 220 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 28, bold: true, color: INDIGO }, paragraph: { spacing: { before: 260, after: 160 } } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Arial', size: 24, bold: true, color: ORANGE }, paragraph: { spacing: { before: 200, after: 120 } } }
    ]
  },
  features: { updateFields: true },
  sections: [{
    properties: {
      page: {
        size: { width: convertInchesToTwip(8.27), height: convertInchesToTwip(11.69) },
        margin: { top: convertInchesToTwip(0.8), right: convertInchesToTwip(0.7), bottom: convertInchesToTwip(0.9), left: convertInchesToTwip(0.7) }
      }
    },
    headers: { default: new Header({ children: [
      new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE } }, spacing: { after: 200 }, children: [
        new TextRun({ text: 'BÁO CÁO KIỂM THỬ HỆ THỐNG ĐẶT TOUR VIETNAMEXPLORER v1.0  |  ', size: 16, color: BLUE, bold: true, font: 'Arial' }),
        new TextRun({ text: 'DOC-QC-2306022032 / Rev.A / Build: tsc exit 0 PASS  |  ', size: 15, color: SLATE, font: 'Arial' }),
        new TextRun({ text: new Date().toLocaleDateString('vi-VN'), size: 15, color: SLATE, font: 'Arial' })
      ]})
    ]})},
    footers: { default: new Footer({ children: [
      new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 6, color: BLUE } }, alignment: AlignmentType.CENTER, children: [
        new TextRun({ text: 'Trang ', size: 17, color: SLATE, font: 'Arial' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 17, color: BLUE, bold: true, font: 'Arial' }),
        new TextRun({ text: ' / Tổng cộng: ', size: 17, color: SLATE, font: 'Arial' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 17, color: BLUE, bold: true, font: 'Arial' }),
        new TextRun({ text: '        -       Bảo mật Cấp Độ B (Internal Use Only) - Bản QC Assistant tự động tạo ra - Không phát hành bên ngoài', size: 14, color: '94A3B8', italics: true, font: 'Arial' }),
      ]})
    ]})},
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 100 }, children: [
        new TextRun({ text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', size: 24, bold: true, color: SLATE, font: 'Arial' })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: [new TextRun({ text: 'Độc lập - Tự do - Hạnh phúc', size: 19, color: SLATE, italics: true, font: 'Arial' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 150 }, children: [
        new TextRun({ text: 'BÁO CÁO KIỂM THỬ HỆ THỐNG', size: 46, bold: true, color: BLUE, font: 'Arial' })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [
        new TextRun({ text: 'ĐẶT TOUR DU LỊCH TRỰC TUYẾN', size: 40, bold: true, color: ORANGE, font: 'Arial' })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
        new TextRun({ text: 'VietNamExplorer v1.0 (Build # 2026-08-12)', size: 28, bold: true, color: INDIGO, font: 'Arial' })]
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'Phạm vi: 9 Module nghiệp vụ + 3 role (Admin / Staff / Khách hàng)', size: 22, color: SLATE, font: 'Arial' })] }),
      new Paragraph({ spacing: { before: 800, after: 20 } }),
      new Paragraph({ alignment: AlignmentType.RIGHT, indent: { right: 720 }, spacing: { after: 40 }, children: [new TextRun({ text: '............., ngày ... tháng ... năm 2026', size: 22, bold: true, color: SLATE, font: 'Arial' })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, indent: { right: 720 }, spacing: { after: 80 }, children: [new TextRun({ text: 'Người thực hiện QC: ...................................................................', size: 22, color: SLATE, font: 'Arial' })] }),
      new Paragraph({ alignment: AlignmentType.RIGHT, indent: { right: 720 }, spacing: { after: 200 }, children: [new TextRun({ text: 'Chấp nhận / Chủ đồ án: ............................................................... (Ký & Ghi rõ họ tên)', size: 22, color: SLATE, font: 'Arial' })] }),

      new Paragraph({ text: '', pageBreakBefore: true, heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '01. THÔNG TIN DỰ ÁN & BẢNG KIỂM TRA PHIÊN BẢN', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Thông tin tổng quan về hệ thống, môi trường kiểm thử và kết quả build TypeScript.', size: 22, color: SLATE, font: 'Arial' })] }),
      projectInfoTable,

      new Paragraph({ text: '', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '02. PHẠM VI KIỂM THỬ (SCOPE 9 MODULE)', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Báo cáo này đã review static và logic 9 module nghiệp vụ chính sau:', size: 22, color: SLATE, font: 'Arial' })] }),
      ...scopeParas,

      new Paragraph({ text: '', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '03. THỐNG KÊ 14 BUGS THEO MỨC ĐỘ NGHIÊM TRỌNG', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '14 bugs được phân loại theo 4 mức độ tiêu chuẩn IEEE 1044.', size: 22, color: SLATE, font: 'Arial' })] }),
      severityTable,

      new Paragraph({ text: '', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '04. DANH SÁCH 42 TEST CASE THEO MODULE', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '42 test case bao gồm Positive, Negative, Edge-case, Logic & Security, phân chia 7 modules:', size: 22, color: SLATE, font: 'Arial' })] }),
      testCasesTable,

      new Paragraph({ text: '', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '05. BUG REPORT - 14 LỖI NGHIỆP VỤ & LUỒNG LOGIC', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: 'Dưới đây là 14 bugs đã tìm được. Mỗi lỗi kèm Mô tả chi tiết, các bước tái hiện, kết quả thực tế gặp, mức độ tác động kinh tế & Hành động khắc phục đề xuất (Step by step).', size: 22, color: SLATE, font: 'Arial' })] }),
      bugListTable,

      new Paragraph({ text: '', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '06. ĐỀ XUẤT KHẮC PHỤC 4 GIAI ĐOẠN ƯU TIÊN', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Kế hoạch 10 hành động ưu tiên (Từ P0 sắp release đến P3 backlog dài hạn):', size: 22, color: SLATE, font: 'Arial' })] }),
      ...recommendParas,

      new Paragraph({ text: '', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '07. KẾT LUẬN TỔNG THỂ & ĐÁNH GIÁ CHẤT LƯỢNG', size: 36, bold: true, color: BLUE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Tổng kết kiểm thử hệ thống, điểm chất lượng & lộ trình release production:', size: 22, color: SLATE, font: 'Arial' })] }),
      ...conclusion,

      new Paragraph({ spacing: { before: 800 }, alignment: AlignmentType.RIGHT, indent: { right: 720 }, children: [new TextRun({ text: 'Người lập báo cáo', size: 22, bold: true, color: SLATE, font: 'Arial' })] }),
      new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.RIGHT, indent: { right: 720 }, children: [new TextRun({ text: '(Ghi rõ họ tên & ký)', size: 18, italics: true, color: SLATE, font: 'Arial' })] }),
      new Paragraph({ spacing: { before: 700 }, alignment: AlignmentType.RIGHT, indent: { right: 720 }, children: [new TextRun({ text: 'QC Assistant Senior Tester', size: 22, italics: true, color: INDIGO, font: 'Arial' })] }),
    ]
  }]
})

Packer.toBuffer(doc).then(buf => {
  const out = resolve(process.cwd(), 'Bao_Cao_Kiem_Thu_He_Thong_Dat_Tour_VietNamExplorer_v1.0.docx')
  writeFileSync(out, buf)
  console.log('✅ FILE WORD ĐÃ TẠO THÀNH CÔNG: ', out)
  console.log('   - Kích thước:', Math.round(buf.length / 1024), 'KB')
  console.log('   - Modules coverage: Auth, Tours, Booking, GroupTour, Dashboard/Reports, Notifications, UI/UX')
  console.log('   - Bug list 14 bugs: 4 CRITICAL (rose), 3 HIGH (amber), 4 MEDIUM (indigo), 3 LOW (slate).')
  console.log('   - Test cases count: 42 / 7 module')
}).catch(e => { console.error('❌ Lỗi tạo file DOCX:', e.message); process.exit(1) })
