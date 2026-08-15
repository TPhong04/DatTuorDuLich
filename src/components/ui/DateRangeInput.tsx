import { useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Calendar, type CalendarProps } from '@/components/ui/Calendar'

export type DateRangeInputVariant = 'customer' | 'admin' | 'staff'
export type DateRangeInputSize = 'sm' | 'md' | 'lg'

export interface DateRangeInputProps {
  from: string | null | undefined
  to: string | null | undefined
  onChange: (next: { from: string | null; to: string | null }) => void
  placeholder?: string
  placeholderTo?: string
  variant?: DateRangeInputVariant
  size?: DateRangeInputSize
  invalidFrom?: boolean
  invalidTo?: boolean
  maxDate?: Date
  minDate?: Date
  disabledFuture?: boolean
  disabledPast?: boolean
  clearable?: boolean
  disabled?: boolean
  className?: string
  numberOfMonths?: number
  calendarProps?: Omit<CalendarProps, 'mode' | 'selected' | 'onSelect' | 'fromDate' | 'toDate'>
  formatDisplay?: (date: Date) => string
}

const sizeClasses: Record<DateRangeInputSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-11 px-4 text-sm',
}

const variantRingClasses: Record<DateRangeInputVariant, string> = {
  customer: 'ring-orange-100 focus-within:border-orange-400 focus-within:ring-4',
  admin: 'ring-blue-100 focus-within:border-blue-400 focus-within:ring-4',
  staff: 'ring-emerald-100 focus-within:border-emerald-400 focus-within:ring-4',
}

export function DateRangeInput({
  from,
  to,
  onChange,
  placeholder = 'Từ ngày',
  placeholderTo = 'Đến ngày',
  variant = 'customer',
  size = 'md',
  className,
  invalidFrom,
  invalidTo,
  maxDate,
  minDate,
  disabledFuture,
  disabledPast,
  clearable = true,
  numberOfMonths,
  calendarProps,
  formatDisplay,
  disabled,
}: DateRangeInputProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const fromDate = disabledPast ? today : minDate
  const toDate = disabledFuture ? today : maxDate
  const disabledArr = [
    ...(fromDate ? [{ before: fromDate }] : []),
    ...(toDate ? [{ after: toDate }] : []),
  ] as unknown as any[]

  const selected: DateRange | undefined = useMemo(() => {
    const f = from ? parseISO(from) : undefined
    const t = to ? parseISO(to) : undefined
    if (f && Number.isNaN(f.getTime())) return undefined
    if (t && Number.isNaN(t.getTime())) return { from: f, to: undefined }
    if (!f && !t) return undefined
    return { from: f, to: t }
  }, [from, to])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(e.target as Node)) return
      setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick)
      document.addEventListener('keydown', onEsc)
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function fmt(d: Date | undefined) {
    if (!d || Number.isNaN(d.getTime())) return ''
    return formatDisplay ? formatDisplay(d) : format(d, 'dd/MM/yyyy')
  }

  const hasValue = !!from || !!to
  const fromDisplay = from && !Number.isNaN(parseISO(from).getTime()) ? fmt(parseISO(from)) : ''
  const toDisplay = to && !Number.isNaN(parseISO(to).getTime()) ? fmt(parseISO(to)) : ''
  const combinedLabel = (fromDisplay && toDisplay) ? `${fromDisplay}  →  ${toDisplay}` : 'Select Range'

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'flex w-full items-stretch rounded-2xl border bg-white outline-none transition',
          variantRingClasses[variant],
          disabled && 'cursor-not-allowed bg-slate-50 opacity-60',
          open && (variant === 'customer' ? 'border-orange-400 ring-4 ring-orange-100 z-20'
            : variant === 'admin' ? 'border-blue-400 ring-4 ring-blue-100 z-20'
            : 'border-emerald-400 ring-4 ring-emerald-100 z-20'),
        )}
      >
        <div className="flex flex-1 items-center gap-2 border-r border-slate-100">
          <div className={cn('pl-3 shrink-0 flex items-center', sizeClasses[size], 'py-0 px-0 pl-3 pr-0')}>
            <CalendarDays className="h-4 w-4 text-slate-400 group-focus-within:text-orange-500 transition" />
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setOpen((v) => !v)}
            className={cn(
              'flex-1 truncate text-left font-medium outline-none transition',
              sizeClasses[size],
              fromDisplay ? 'text-slate-800' : 'text-slate-400',
              invalidFrom ? 'text-red-600' : '',
            )}
          >
            {fromDisplay || placeholder}
          </button>
        </div>
        <div className="flex flex-1 items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setOpen((v) => !v)}
            className={cn(
              'flex-1 truncate text-left font-medium outline-none transition',
              sizeClasses[size],
              toDisplay ? 'text-slate-800' : 'text-slate-400',
              invalidTo ? 'text-red-600' : '',
            )}
          >
            {toDisplay || placeholderTo}
          </button>
          {clearable && hasValue && !disabled ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onChange({ from: null, to: null })
              }}
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition mr-2',
                'hover:bg-slate-100 hover:text-slate-600',
              )}
              aria-label="Xóa khoảng"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-max min-w-[720px] origin-top-right overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.28)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start justify-between gap-6 px-7 pt-7">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                Khoảng thời gian
              </div>
              <div className="mt-1 text-[26px] font-black leading-none tracking-tight text-slate-900">
                {combinedLabel}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-400">
                {fromDisplay && toDisplay
                  ? 'Chọn lại khoảng ngày nếu cần'
                  : 'Chọn khoảng Từ ngày → Đến ngày trên lịch bên dưới'}
              </div>
            </div>
          </div>
          <Calendar
            {...({
              mode: 'range',
              selected,
              disabled: disabledArr.length ? disabledArr : undefined,
              numberOfMonths: numberOfMonths ?? 2,
              onSelect: (range: any) => {
                onChange({
                  from: range?.from ? format(range.from, 'yyyy-MM-dd') : null,
                  to: range?.to ? format(range.to, 'yyyy-MM-dd') : range?.from ? format(range.from, 'yyyy-MM-dd') : null,
                })
                if (range?.from && range?.to) {
                  setTimeout(() => setOpen(false), 120)
                }
              },
              ...(calendarProps as any),
            } as any)}
          />
          <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-6 py-5">
            <button
              type="button"
              onClick={() => onChange({ from: null, to: null })}
              className="rounded-2xl px-5 py-2.5 text-sm font-extrabold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Xóa
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={disabledFuture}
                onClick={() => {
                  const iso = format(new Date(), 'yyyy-MM-dd')
                  onChange({ from: iso, to: iso })
                  setOpen(false)
                }}
                className={cn(
                  'rounded-2xl px-5 py-2.5 text-sm font-extrabold transition',
                  disabledFuture
                    ? 'cursor-not-allowed text-slate-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                )}
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/25 hover:brightness-105 active:scale-[0.98]"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
