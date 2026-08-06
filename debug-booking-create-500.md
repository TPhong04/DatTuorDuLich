# Debug Session: booking-create-500

**Status:** [OPEN]  
**Date:** 2026-08-06  
**Symptom:** User ấn nút [✓ XÁC NHẬN ĐẶT TOUR] → Toast lỗi "Internal server error" (500) ở POST /api/tours/:slug/bookings. Không tạo được đơn đặt.  
**Repro:** Vào trang `/dat-tour/tour-du-lich-ha-noi-phu-quoc-4n3d?d=1` → điền Step1 pax, Step2 hành khách, Step3 đồng ý điều khoản → bấm xác nhận.  

## 5 Falsifiable Hypotheses (phải chứng minh đúng/sai bằng runtime log)

| # | Giả thuyết | Điểm quan sát |
|---|---|---|
| H1 | DTO Zod validate **sai shape** → ZodError 400 được Nest bắn thành 500 do thiếu exception filter. Kiểm tra key `departureId` vs `departureDateId` / `departureId` trong DTO vs FE payload. | tour-bookings.controller + createBookingDto |
| H2 | **generateCode(BK-VNEX-...)** hoặc **mongoose document.save()** lỗi: `code` unique index conflict do ngày cũ chưa +seq / casting `userId` `ObjectId` undefined khi KH vãng lai `createdBy = null`. | bookings.service generateCode + createBooking |
| H3 | `TourDocument.departures.id(departureId)` return **null** do FE gửi `?d=1` là **index number (string '1')** không phải **ObjectId hex** → lock chỗ crash khi read `availableSeats - 0 - infantCount`. | service validateSeatsAvailable |
| H4 | `computeTotals` đọc `surcharges.quantity = undefined` hoặc `passengers` undefined / rỗng → toán tử `NaN` crash khi create document. | service computeTotals |
| H5 | Auth `JwtAuthGuard` optional guard sai logic: FE không gửi JWT (khách vãng lai) → guard throw 401 -> NestExceptionHandler -> bắn 500 thay vì cho createdBy=null. | tour-bookings.controller UseGuards + req.user |

## Instrumentation Plan

- BE: `tour-bookings.controller` + `bookings.service.createBooking` + `validateSeatsAvailable` → instrument 6 checkpoints.
- FE: `BookingPage Step3 onSubmit` → instrument request payload shape trước khi fetch.
- Start Debug Server → thu thập log evidence 1 lượt reproduce.

## Evidence Logs

_(sau khi collect)_

## Fix Applied

_(sau khi có evidence)_

## Post-Fix Verification

_(sau khi fix + retest)_
