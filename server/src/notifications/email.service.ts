import { Logger } from '@nestjs/common'

export class EmailService {
  private readonly logger = new Logger(EmailService.name)

  constructor() {}

  private buildHtml(row: any): string {
    const title = String(row.title || 'Thông báo hệ thống')
    const body = String(row.body || '').replace(/\n/g, '<br/>')
    const actionUrl = row.actionUrl ? `<br/><br/><a href="${row.actionUrl}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Xem chi tiết</a>` : ''
    return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f7f8fa;color:#0f172a">
<table width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center"><table width="640" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
<thead><tr><td style="background:#1e293b;color:#fff;padding:18px 24px"><h2 style="margin:0;font-size:18px;font-weight:700">${title}</h2></td></tr></thead>
<tbody>
<tr><td style="padding:24px;font-size:15px;line-height:1.7">${body}${actionUrl}</td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #f1f5f9;color:#64748b;font-size:12px">Nếu có thắc mắc vui lòng liên hệ hotline 1900 1009. Thư tự động gửi từ hệ thống Tour đoàn.</td></tr>
</tbody></table></td></tr></table>
</body>
</html>`
  }

  private buildSubject(row: any) {
    return `[Thông báo] ${String(row.title || 'Hệ thống Tour đoàn')}`
  }

  async sendNotification(row: any, _setting: any) {
    const recipientEmail = String((row as any)._recipientEmail || '')
    if (!recipientEmail) {
      this.logger.debug(`skip email notification ${row._id} - missing recipient email`)
      return
    }
    const subject = this.buildSubject(row)
    const html = this.buildHtml(row)
    const mock = process.env.EMAIL_ENABLED !== 'true' || !process.env.SMTP_HOST
    if (mock) {
      this.logger.verbose(`[EMAIL-MOCK] -> ${recipientEmail} | ${subject}`)
      return true
    }
    const nodemailer = require('nodemailer')
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@tour.vn',
      to: recipientEmail,
      subject,
      html,
    })
    return true
  }
}
