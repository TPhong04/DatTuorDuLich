import axios from 'axios'

type AlertKey = string
const lastFiredAt = new Map<AlertKey, number>()
let enabledCache: boolean | null = null

export function isTelegramAlertEnabled(): boolean {
  if (enabledCache !== null) return enabledCache
  const token = String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
  const chatId = String(process.env.TELEGRAM_CHAT_ID_DEVONCALL ?? '').trim()
  enabledCache = token.length > 10 && chatId.length > 2
  return enabledCache
}

function defaultCooldownSeconds(): number {
  const v = Number(process.env.APM_ALERT_COOLDOWN_SECONDS ?? 300)
  return Number.isFinite(v) && v > 0 ? v : 300
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export async function sendTelegramDevOnCall(params: {
  alertKey: AlertKey
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
  title: string
  body: string
  cooldownSeconds?: number
}): Promise<{ sent: boolean; reason?: string }> {
  if (!isTelegramAlertEnabled()) return { sent: false, reason: 'disabled' }
  const { alertKey, severity, title, body, cooldownSeconds } = params
  const now = Date.now()
  const cdMs = ((cooldownSeconds ?? defaultCooldownSeconds()) | 0) * 1000
  const last = lastFiredAt.get(alertKey) ?? 0
  if (last > 0 && now - last < cdMs) {
    return { sent: false, reason: `cooldown ${formatDuration(cdMs - (now - last))}` }
  }
  lastFiredAt.set(alertKey, now)
  const token = String(process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
  const chatId = String(process.env.TELEGRAM_CHAT_ID_DEVONCALL ?? '').trim()
  const env = String(process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'unknown')
  const sevIcon = severity === 'CRITICAL' ? '🔴' : severity === 'WARNING' ? '🟡' : 'ℹ️'
  const textLines = [
    `${sevIcon} *[DevOnCall ${env.toUpperCase()}]*`,
    `*${title.replace(/\*/g, '')}*`,
    ``,
    body.replace(/[_*`[\]()~>#+\-=|{}.!]/g, '\\$&'),
    ``,
    `_key: \`${alertKey.replace(/`/g, '')}\`_`,
    `_ts: ${new Date(now).toISOString()}_`,
  ]
  try {
    await axios.post(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        chat_id: chatId,
        text: textLines.join('\n'),
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
      },
      { timeout: 6000 },
    )
    return { sent: true }
  } catch (e: any) {
    lastFiredAt.delete(alertKey)
    const msg = e?.response?.data || e?.message || String(e)
    if (process.env.NODE_ENV === 'development') {
      try { console.error('[monitoring:telegram] send failed:', msg) } catch {}
    }
    return { sent: false, reason: String(msg).slice(0, 200) }
  }
}
