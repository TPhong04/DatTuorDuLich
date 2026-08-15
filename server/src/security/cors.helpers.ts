export function parseCorsOrigins(envOrigins: string | undefined): string[] {
  if (!envOrigins) return []
  return envOrigins
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function corsOriginCallback(allowedOrigins: string[]) {
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) => {
    if (!origin) return callback(null, true)
    const trimmed = origin.replace(/\/+$/, '')
    if (allowedOrigins.includes(trimmed)) return callback(null, true)
    const originHost = (() => {
      try {
        const u = new URL(trimmed)
        return u.hostname
      } catch {
        return null
      }
    })()
    if (originHost && (originHost === 'localhost' || originHost === '127.0.0.1')) {
      return callback(null, true)
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`), false)
  }
}
