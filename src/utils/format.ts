export function formatMoney(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return `${n.toLocaleString('vi-VN')}đ`
}

export function formatVNDShort(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) {
    const v = n / 1_000_000_000
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} tỷ`
  }
  if (abs >= 1_000_000) {
    const v = n / 1_000_000
    return `${v >= 10 ? v.toFixed(0) : v.toFixed(1)} tr`
  }
  if (abs >= 1_000) {
    return `${Math.round(n / 1_000)}k`
  }
  return `${Math.round(n)}đ`
}

export function formatInt(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return n.toLocaleString('vi-VN')
}
