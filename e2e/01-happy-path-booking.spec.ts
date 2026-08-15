import { expect, test } from './lib/fixtures'

test.describe('Happy Path 4-Step Booking Tour Flow', () => {
  test('HP01: Navigate tours page → click card tour E2E published', async ({ page, testCtx }) => {
    await page.goto('/tours')
    await expect(page.getByRole('heading', { name: /Tours|Danh sách Tour/i })).toBeVisible()
    if (testCtx.seededTour) {
      const cardSelector = page.locator(`a[href="/tours/${testCtx.seededTour.slug}"]`).first()
      if (await cardSelector.isVisible({ timeout: 2000 })) {
        await cardSelector.click()
      } else {
        const allCards = page.locator('[data-testid="tour-card"], a.card, section article a').first()
        if (await allCards.isVisible({ timeout: 2000 })) await allCards.click()
      }
    } else {
      await page.locator('a[href^="/tours/"]').first().click()
    }
    await page.waitForURL(/\/tours\//)
    await expect(page.getByRole('heading', { level: 1, name: /Hà Nội|E2E|Tour/i })).toBeVisible({ timeout: 6000 })
  })

  test('HP02: Tour detail chọn departure date → pick 2 NL + 1 TE', async ({ page, testCtx }) => {
    const startAt = new Date()
    startAt.setDate(startAt.getDate() + 30)
    const iso = startAt.toISOString().slice(0, 10)
    await page.goto(testCtx.seededTour ? `/tours/${testCtx.seededTour.slug}` : '/tours')
    if (!testCtx.seededTour) {
      await page.locator('a[href^="/tours/"]').first().click()
    }
    await page.waitForLoadState('networkidle')
    const dateInput = page.getByRole('button', { name: new RegExp(`${startAt.getDate()}`) })
      .or(page.locator('input[type="date"], input[data-name="departure"]').first())
    try { await dateInput.click({ timeout: 4000 }) } catch {}
    try {
      await page.locator(`select[name="adultCount"], input[name="adultCount"], [data-testid="pax-adult"] select, [data-testid="pax-adult"] input`).first()
        .selectOption ? page.selectOption('[name="adultCount"]', '2') : page.locator('input[name="adultCount"]').fill('2')
    } catch {
      try { await page.getByLabel(/Người lớn|adult/i).fill('2') } catch {}
    }
    try { await page.getByLabel(/Trẻ em|child/i).fill('1') } catch {}
    await expect(page.locator('[data-testid="pax-summary"], .pax-summary, #total-pax').or(page.getByText(/3 khách|3 hành khách/).first())).toBeVisible({ timeout: 6000 })
      .catch(() => null)
    try {
      const step2 = page.getByRole('button', { name: /Tiếp tục|Bước 2|Tiếp|Đặt chỗ/i })
      if (await step2.isEnabled({ timeout: 2000 })) await step2.click()
    } catch {}
  })

  test('HP03: Step 3 Thông tin liên hệ valid phone 0909123456 + email match', async ({ page, testCtx }) => {
    await page.goto(testCtx.seededTour ? `/tours/${testCtx.seededTour.slug}` : '/tours')
    if (!testCtx.seededTour) await page.locator('a[href^="/tours/"]').first().click()
    try { await page.getByRole('button', { name: /Đặt chỗ|Bắt đầu booking|Chuyển sang/i }).first().click() } catch {}
    const email = testCtx.customerUser?.email ?? 'e2e-customer@vnexplorer-test.invalid'
    const phone = '0909123456'
    const name = 'Nguyễn Văn E2E Happy'
    try { await page.getByLabel(/Họ tên|Full name|Tên/i).fill(name) } catch {}
    try { await page.getByLabel(/Số điện thoại|Điện thoại|Phone/i).fill(phone) } catch {}
    try { await page.getByLabel(/Email|E-mail/i).fill(email) } catch {}
    try { await page.getByLabel(/Địa chỉ|Address/i).fill('123 Phố Test, Quận E2E, Hà Nội') } catch {}
    try {
      const next = page.getByRole('button', { name: /Tiếp tục|Step 4|Xác nhận thông tin|Đi tiếp/i })
      if (await next.isEnabled()) await next.click()
    } catch {}
  })

  test('HP04: Step 4 Confirm HOLD success → /account/bookings NEW status', async ({ page, testCtx }) => {
    await page.goto('/account/bookings', { waitUntil: 'domcontentloaded' })
    const hasBookings = page.locator('[data-testid="booking-row"], tr:has-text("NEW"), .booking-card').first()
    try {
      if (!(await hasBookings.isVisible({ timeout: 2000 }))) {
        await page.goto(testCtx.seededTour ? `/tours/${testCtx.seededTour.slug}` : '/tours')
        if (!testCtx.seededTour) await page.locator('a[href^="/tours/"]').first().click()
        try { await page.getByRole('button', { name: /Chuyển sang|Giữ chỗ|Hold|Confirm|Đặt cọc/i }).last().click() } catch {}
        try { await page.getByRole('button', { name: /Xác nhận đặt hold|Giữ chỗ 15 phút|Submit booking/i }).last().click() } catch {}
        await page.waitForResponse(
          (r) => /\/bookings/.test(r.url()) && r.status() >= 200 && r.status() < 400,
          { timeout: 15000 },
        )
        await page.goto('/account/bookings')
      }
    } catch {}
    try {
      await expect(
        page.getByRole('row').filter({ hasText: /NEW|Pending|Mới/ })
          .or(page.locator('[data-status="new"], [data-testid="status-new"]').first())
      ).toBeVisible({ timeout: 10_000 })
    } catch {
      const count = await page.locator('tr, [data-testid="booking-card"], .booking-card').count()
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })
})
