// #region debug-point booking-create-500
const DBG_ENV = new URLSearchParams((globalThis as any).__dbg_env || '')
const DBG_URL =
  (globalThis as any).__dbg_url || 'http://127.0.0.1:7777/event'
const DBG_SESSION = (globalThis as any).__dbg_session || 'booking-create-500'

let __dbgSeq = 0
async function dbg(event: string, data: Record<string, unknown>) {
  try {
    __dbgSeq += 1
    const body = JSON.stringify({ session: DBG_SESSION, runId: 'pre', seq: __dbgSeq, event, ts: Date.now(), ...data })
    await fetch(DBG_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {})
  } catch {}
}
// #endregion

export { dbg }
