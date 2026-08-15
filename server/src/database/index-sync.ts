import { Connection } from 'mongoose'

export type IndexAuditRow = {
  collection: string
  name: string
  keys: Record<string, unknown>
  sizeBytes?: number
  isNew?: boolean
}

export type EnsureIndexesResult = {
  ok: boolean
  durationMs: number
  collections: Record<string, { total: number; added: string[]; existing: string[]; errors: string[] }>
  rows: IndexAuditRow[]
}

export async function ensureMongooseIndexes(connection: Connection): Promise<EnsureIndexesResult> {
  const start = process.hrtime.bigint()
  const result: EnsureIndexesResult = {
    ok: true,
    durationMs: 0,
    collections: {},
    rows: [],
  }
  const names: string[] = []
  try {
    const models = (connection as any).models as Record<string, any>
    for (const name of Object.keys(models)) names.push(name)
  } catch {
    try {
      const modelNames = (connection as any).collectionNames
      if (Array.isArray(modelNames)) for (const n of modelNames) names.push(n)
    } catch {}
  }
  for (const modelName of Array.from(new Set(names))) {
    const modelObj = (connection as any).models?.[modelName]
    if (!modelObj || typeof modelObj.syncIndexes !== 'function') continue
    const colName = modelObj.collection?.name ?? modelName.toLowerCase() + 's'
    const state = (result.collections[colName] = { total: 0, added: [] as string[], existing: [] as string[], errors: [] as string[] })
    try {
      const diffs: string[] = await modelObj.syncIndexes({ background: true })
      if (Array.isArray(diffs)) {
        state.added = diffs.filter((d) => typeof d === 'string')
      }
      try {
        const cur = await modelObj.listIndexes?.()
        const indexes = Array.isArray(cur) ? cur : []
        state.total = indexes.length
        for (const idx of indexes) {
          if (idx && typeof idx.name === 'string') {
            if (!state.added.includes(idx.name)) state.existing.push(idx.name)
            result.rows.push({
              collection: colName,
              name: idx.name,
              keys: idx.key || {},
              sizeBytes: typeof idx.size === 'number' ? idx.size : undefined,
            })
          }
        }
      } catch {
        state.total = state.added.length + state.existing.length
      }
    } catch (e: any) {
      state.errors.push(String(e?.message || e).slice(0, 200))
      result.ok = false
    }
  }
  result.durationMs = Math.round(Number(process.hrtime.bigint() - start) / 1e6)
  return result
}

export function formatIndexReportForBanner(r: EnsureIndexesResult): string[] {
  const lines: string[] = []
  const totalIndexes = Object.values(r.collections).reduce((s, c) => s + c.total, 0)
  const addedIndexes = Object.values(r.collections).reduce((s, c) => s + c.added.length, 0)
  lines.push(
    `🗂️  Mongo indexes sync ${r.ok ? '✅ ok' : '⚠️ partial'} in ${r.durationMs}ms: ${totalIndexes} total / ${addedIndexes} newly built / ${Object.keys(r.collections).length} collections`,
  )
  const booking = r.collections['bookings']
  if (booking) {
    const critical = booking.added.filter((n) => /reports|departure_created|customer_mybookings|staff_assigned|finance_payment/i.test(n))
    if (critical.length > 0) {
      lines.push(`   ▸ Bookings compound P95 added: ${critical.join(', ')}`)
    } else {
      lines.push(`   ▸ Bookings: ${booking.total} indexes OK (P95 reports_status_departure_created ready)`)
    }
  }
  const hadErr = Object.entries(r.collections).find(([, c]) => c.errors.length > 0)
  if (hadErr) {
    lines.push(`   ▸ Warning: ${hadErr[0]} sync errors: ${hadErr[1].errors.join(' | ')}`)
  }
  return lines
}
