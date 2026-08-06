type DateLike = string | number | Date | null | undefined

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function parseToDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : value
  }
  if (typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map((x) => Number(x))
      const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
      return Number.isNaN(dt.getTime()) ? null : dt
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [dPart, mPart, yPart] = s.split('/')
      const d = Number(dPart); const m = Number(mPart); const y = Number(yPart)
      const dt = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0)
      return Number.isNaN(dt.getTime()) ? null : dt
    }
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

export function toInputDate(value: DateLike): string {
  const d = parseToDate(value)
  if (!d) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function toISODateOnly(value: DateLike): string | null {
  const d = parseToDate(value)
  if (!d) return null
  const y = d.getFullYear()
  const m = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  const iso = new Date(Date.UTC(y, d.getMonth(), d.getDate(), 0, 0, 0, 0)).toISOString()
  return iso
}

export function toISODateTime(value: DateLike): string | null {
  const d = parseToDate(value)
  return d ? d.toISOString() : null
}

export function formatDate(value: DateLike): string {
  const d = parseToDate(value)
  if (!d) return '-'
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateDash(value: DateLike): string {
  const d = parseToDate(value)
  if (!d) return '-'
  return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`
}

export function formatDateTime(value: DateLike): string {
  const d = parseToDate(value)
  if (!d) return '-'
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function formatDateTimeSec(value: DateLike): string {
  const d = parseToDate(value)
  if (!d) return ''
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

export function formatRelativeVN(value: DateLike, nowInput: DateLike = null): string {
  const d = parseToDate(value)
  if (!d) return ''
  const now = parseToDate(nowInput) ?? new Date()
  const diffMs = now.getTime() - d.getTime()
  const abs = Math.abs(diffMs)
  const s = Math.floor(abs / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const day = Math.floor(h / 24)
  const sign = diffMs >= 0 ? '' : ''
  if (s < 60) return diffMs >= 0 ? 'vừa xong' : 'sắp tới'
  if (m < 60) return `${sign}${m} phút${diffMs >= 0 ? ' trước' : ' nữa'}`
  if (h < 24) return `${sign}${h} giờ${diffMs >= 0 ? ' trước' : ' nữa'}`
  if (day < 30) return `${sign}${day} ngày${diffMs >= 0 ? ' trước' : ' nữa'}`
  return formatDate(d)
}
