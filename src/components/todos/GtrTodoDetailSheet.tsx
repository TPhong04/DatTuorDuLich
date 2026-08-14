import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { CheckCircle2, Clock, CircleDashed, X, ChevronRight } from 'lucide-react'
import {
  patchTodoStatus,
  TODO_CATEGORY_META,
  TODO_PRIORITY_META,
  TODO_STATUS_META,
  todoTimeLeftText,
  TodoListEnvelope,
  TodoRow,
  TodoStatus,
} from '@/features/todos/todos'
import { formatDateTime } from '@/utils/date'
import { useToast } from '@/components/notifications/ToastProvider'

type Props = {
  open: { row: TodoRow; list: TodoRow[] } | null
  onClose: () => void
  role?: 'staff' | 'admin'
  onUpdated?: (next: TodoRow) => void
}

export default function GtrTodoDetailSheet({ open, onClose, role = 'staff', onUpdated }: Props) {
  const t = useToast()
  const [submitting, setSubmitting] = useState(false)
  const todo = open?.row ?? null
  const list = open?.list ?? []
  const metaCat = todo ? TODO_CATEGORY_META[todo.category] : null
  const metaPrio = todo ? TODO_PRIORITY_META[todo.priority] : null
  const timeMeta = todo ? todoTimeLeftText(todo.dueAt ?? null, todo.status) : null

  const setStatus = useCallback(async (next: TodoStatus) => {
    if (!todo) return
    setSubmitting(true)
    try {
      const updated = await patchTodoStatus(todo._id || todo.id, next, role)
      onUpdated?.(updated)
      t.success(`✅ Cập nhật trạng thái "${TODO_STATUS_META[next].label}" thành công.`)
    } catch (e) {
      t.error((e as any)?.message || 'Không thể cập nhật trạng thái todo')
    } finally {
      setSubmitting(false)
    }
  }, [todo, role, onUpdated, t])

  if (!todo) return null
  const catIdx = list.findIndex((x) => (x._id || x.id) === (todo._id || todo.id))
  const prev = catIdx > 0 ? list[catIdx - 1] : null
  const next = catIdx >= 0 && catIdx < list.length - 1 ? list[catIdx + 1] : null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className={clsx(
          'w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl animate-[slideInRight_.2s_ease-out]',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className={clsx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-sm', metaCat?.badge)}>
              <span>{metaCat?.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider', metaCat?.badge)}>
                  <span className={clsx('h-1.5 w-1.5 rounded-full', metaCat?.dot)} />{metaCat?.label}
                </span>
                {metaPrio && <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider', metaPrio.chip)}>{metaPrio.label}</span>}
              </div>
              <div className="mt-1 truncate text-[15px] font-black text-slate-900">{todo.title}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button disabled={!prev} onClick={() => prev && open && onClose()} title="Prev">
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <div className="text-xs font-black text-slate-400">{catIdx + 1}/{list.length || 0}</div>
            <button disabled={!next} onClick={() => next && open && onClose()} title="Next">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={onClose} className="ml-1 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={18} /></button>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-5">
          <div className="grid gap-2 rounded-3xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-500">Tiến độ checklist</div>
              {timeMeta && (
                <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black', timeMeta.isOverdue ? 'bg-rose-100 text-rose-700' : timeMeta.isSoon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                  <Clock size={12} className="shrink-0" />{timeMeta.text}
                </span>
              )}
            </div>
            {todo.dueAt && (
              <div className="text-xs text-slate-500">⏰ Hạn chót: <b className="text-slate-700">{formatDateTime(new Date(todo.dueAt))}</b> (tạo lúc {formatDateTime(new Date(todo.createdAt))})</div>
            )}
            {todo.doneAt && (
              <div className="text-xs font-black text-emerald-600">✅ Hoàn thành lúc: {formatDateTime(new Date(todo.doneAt))}</div>
            )}
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px]">
              {todo.groupTourRequestCode && (
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <div className="font-black uppercase tracking-wider text-slate-500">Tour đoàn</div>
                  <div className="mt-0.5 font-black text-slate-800">{todo.groupTourRequestCode}</div>
                </div>
              )}
              {todo.bookingCode && (
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2">
                  <div className="font-black uppercase tracking-wider text-slate-500">Booking</div>
                  <div className="mt-0.5 font-black text-slate-800">{String(todo.bookingCode).slice(0, 18)}</div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4">
            <div className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-500">Nội dung công việc / Note</div>
            <pre className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-700" style={{ fontFamily: 'inherit' }}>{todo.description || '—'}</pre>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
            <div className="mb-3 text-[11px] font-black uppercase tracking-wider text-slate-500">Cập nhật trạng thái</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={submitting}
                onClick={() => setStatus('todo')}
                className={clsx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[12px] font-black uppercase transition',
                  todo.status === 'todo' ? 'border-slate-400 bg-slate-100 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                <CircleDashed size={15} className="shrink-0 text-slate-500" /> Chưa làm
              </button>
              <button
                disabled={submitting}
                onClick={() => setStatus('in_progress')}
                className={clsx(
                  'inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[12px] font-black uppercase transition',
                  todo.status === 'in_progress' ? 'border-blue-400 bg-blue-50 text-blue-900' : 'border-blue-100 bg-white text-blue-700 hover:bg-blue-50',
                )}
              >
                <Clock size={15} className="shrink-0 text-blue-500" /> Đang làm
              </button>
              <button
                disabled={submitting}
                onClick={() => setStatus('done')}
                className={clsx(
                  'col-span-2 inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[12px] font-black uppercase transition',
                  todo.status === 'done' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-emerald-100 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50',
                )}
              >
                <CheckCircle2 size={15} className="shrink-0 text-emerald-500" /> Đã hoàn thành (Check ✅)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
