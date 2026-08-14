import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Clock, XCircle, PlayCircle } from 'lucide-react'
import clsx from 'clsx'
import { useToast } from '@/components/notifications/ToastProvider'
import {
  fetchStaffGtrTodos,
  fetchAdminGtrTodos,
  patchTodoStatus,
  todoTimeLeftText,
  TODO_CATEGORY_META,
  TODO_PRIORITY_META,
  TODO_STATUS_META,
  TodoRow,
  TodoStatus,
  TodoListEnvelope,
} from '@/features/todos/todos'
import { formatDateTime } from '@/utils/date'

export function GtrTodosChecklist({
  gtrId,
  role,
  compact = false,
}: {
  gtrId: string
  role: 'staff' | 'admin'
  compact?: boolean
}) {
  const toast = useToast()
  const nonceRef = useRef(0)
  const [loading, setLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [data, setData] = useState<TodoListEnvelope | null>(null)
  const load = useCallback(async () => {
    const nonce = ++nonceRef.current
    if (!loading) setStale(true)
    try {
      const res = role === 'admin' ? await fetchAdminGtrTodos(gtrId) : await fetchStaffGtrTodos(gtrId)
      if (nonce !== nonceRef.current) return
      setData(res)
      setLoading(false)
      setStale(false)
    } catch (e) {
      if (nonce !== nonceRef.current) return
      setData(null)
      setLoading(false)
      setStale(false)
      toast.warning((e as any)?.message || 'Không thể tải Checklist Operation (vui lòng kiểm tra server).')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gtrId, role])
  useEffect(() => { void load() }, [load])
  const items: TodoRow[] = useMemo(() => (data?.items as TodoRow[] || []), [data])
  const summary = data?.summary
  const total = summary?.total || items.length
  const progress = Math.round((summary?.progressPct) ?? (total ? ((summary?.done ?? 0) / total) * 100 : 0))

  const toggleDone = async (todo: TodoRow, next: TodoStatus) => {
    setStale(true)
    try {
      await patchTodoStatus(todo._id, next, role)
      toast.success(`✅ Đã cập nhật trạng thái "${TODO_STATUS_META[next].label}"`)
      await load()
    } catch (err) {
      toast.error((err as any)?.message || 'Không thể cập nhật todo. Chỉ người được giao việc mới được cập nhật.')
      setStale(false)
    }
  }

  if (loading) {
    return (
      <div className={clsx('space-y-3', compact ? 'pt-2' : 'p-5')}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 rounded-2xl border border-slate-100 p-4">
            <div className="h-6 w-6 rounded-full bg-slate-200" />
            <div className="h-4 w-40 rounded bg-slate-200" />
            <div className="ml-auto h-4 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    )
  }

  if (!total) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-14 text-center space-y-3">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">📋</div>
        <div className="text-sm font-semibold text-slate-600">Chưa có Checklist Operation</div>
        <div className="text-[13px] text-slate-500">Khi trạng thái chuyển sang <b>Đã chốt (Won)</b>, hệ thống sẽ tự động tạo 5 việc (KS / Vé máy bay / Visa / HDV / Xe) giao cho nhân viên phụ trách trong 30 phút.</div>
      </div>
    )
  }

  return (
    <div className={clsx('space-y-4', stale && 'opacity-90 transition')}>
      <div className={clsx('rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm', compact && 'px-4 py-3')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">Tiến độ Checklist Operation (Won)</div>
            <div className="mt-1 text-2xl font-black text-slate-900 tabular-nums flex items-center gap-2">
              {summary?.done ?? 0}<span className="text-slate-300 text-xl">/</span>{total}
              <span className="ml-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700 ring-1 ring-emerald-100">{progress}%</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Todo {summary?.todo ?? 0}</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" />Đang làm {summary?.in_progress ?? 0}</div>
            <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Xong {summary?.done ?? 0}</div>
            <button onClick={() => load()} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-600 hover:bg-white">🔄 Tải lại</button>
          </div>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              progress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500',
            )}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      <div className="space-y-2.5">
        {items.map((t) => {
          const catMeta = TODO_CATEGORY_META[t.category] || TODO_CATEGORY_META.other
          const priMeta = TODO_PRIORITY_META[t.priority] || TODO_PRIORITY_META.normal
          const statusMeta = TODO_STATUS_META[t.status]
          const tLeft = todoTimeLeftText(t.dueAt || null, t.status)
          const isDone = t.status === 'done'
          const isProgress = t.status === 'in_progress'
          const readOnly = (t as any).__readOnlyForCurrentStaff && role !== 'admin'
          return (
            <div key={t._id} className={clsx(
              'rounded-3xl border p-4 transition shadow-sm',
              isDone ? 'border-emerald-100 bg-emerald-50/30' : tLeft.isOverdue ? 'border-rose-100 bg-rose-50/30' : 'border-slate-200 bg-white',
              readOnly && 'opacity-80',
            )}>
              <div className="flex items-start gap-3.5">
                <button
                  disabled={readOnly}
                  onClick={() => toggleDone(t, isDone ? 'todo' : 'done')}
                  className={clsx(
                    'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition',
                    isDone ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-400 hover:border-emerald-500 hover:text-emerald-500',
                    readOnly && 'cursor-not-allowed',
                  )}
                  title={isDone ? 'Bỏ hoàn thành' : 'Đánh dấu hoàn thành'}
                >
                  {isDone ? <CheckCircle2 size={16} /> : <span className="h-3 w-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ring-1', catMeta.badge)}>
                      <span>{catMeta.icon}</span>{catMeta.label}
                    </span>
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase ring-1', priMeta.chip)}>
                      <span className={clsx('h-1.5 w-1.5 rounded-full', priMeta.dot)} />{priMeta.label}
                    </span>
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-black uppercase ring-1', statusMeta.chip)}>
                      <span className={clsx('h-1.5 w-1.5 rounded-full', statusMeta.dot)} />{statusMeta.label}
                    </span>
                    <span className={clsx('inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold whitespace-nowrap', tLeft.cls)}>
                      {tLeft.isOverdue ? <XCircle size={12} /> : <Clock size={12} />}{tLeft.text}
                    </span>
                    {readOnly ? <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700 ring-1 ring-amber-100">👷 Staff khác</span> : null}
                  </div>
                  <div className={clsx('mt-2 text-[15px] 2xl:text-base font-black leading-snug', isDone ? 'line-through text-slate-500' : 'text-slate-900')}>
                    {t.title}
                  </div>
                  {t.description ? (
                    <div className={clsx(
                      'mt-2 whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[13px] 2xl:text-sm leading-relaxed',
                      isDone ? 'bg-slate-100/50 text-slate-500' : 'bg-slate-50 text-slate-600',
                    )}>{t.description}</div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] 2xl:text-xs text-slate-500 font-semibold">
                    {t.dueAt ? <span>⏰ Deadline: {formatDateTime(t.dueAt)}</span> : null}
                    {t.doneAt ? <span>✅ Xong lúc: {formatDateTime(t.doneAt)}</span> : null}
                    {t.createdAt ? <span>📅 Tạo lúc: {formatDateTime(t.createdAt)}</span> : null}
                    <div className="ml-auto flex items-center gap-1.5">
                      {!isDone && !isProgress ? (
                        <button disabled={readOnly} onClick={() => toggleDone(t, 'in_progress')} className={clsx('inline-flex h-8 items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100', readOnly && 'opacity-50 cursor-not-allowed')}><PlayCircle size={12} />Bắt đầu</button>
                      ) : null}
                      {isProgress ? (
                        <button disabled={readOnly} onClick={() => toggleDone(t, 'todo')} className={clsx('inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50', readOnly && 'opacity-50 cursor-not-allowed')}>↩ Tạm hoãn</button>
                      ) : null}
                      {t.status === 'done' ? (
                        <button disabled={readOnly} onClick={() => toggleDone(t, 'todo')} className={clsx('inline-flex h-8 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50', readOnly && 'opacity-50 cursor-not-allowed')}>↩ Mở lại</button>
                      ) : null}
                      {!['done', 'cancelled'].includes(t.status) ? (
                        <button disabled={readOnly} onClick={() => toggleDone(t, 'done')} className={clsx('inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-black uppercase text-white hover:bg-emerald-700', readOnly && 'opacity-50 cursor-not-allowed')}>✅ Xong</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
