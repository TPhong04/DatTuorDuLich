import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar, type CalendarProps } from '@/components/ui/Calendar'

export type DateInputVariant = 'customer' | 'admin' | 'staff'
export type DateInputSize = 'sm' | 'md' | 'lg'

export interface DateInputProps {
  value: string | null | undefined
  onChange: (isoDate: string | null) => void
  placeholder?: string
  variant?: DateInputVariant
  size?: DateInputSize
  invalid?: boolean
  maxDate?: Date
  minDate?: Date
  disabledFuture?: boolean
  disabledPast?: boolean
  clearable?: boolean
  disabled?: boolean
  id?: string
  name?: string
  className?: string
  readOnly?: boolean
  calendarProps?: Omit<CalendarProps, 'mode' | 'selected' | 'onSelect' | 'fromDate' | 'toDate'>
  formatDisplay?: (date: Date) => string
}

const sizeClasses: Record<DateInputSize, string> = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-3 text-sm',
  lg: 'h-11 px-4 text-sm',
}

const variantRingClasses: Record<DateInputVariant, string> = {
  customer: 'ring-orange-100 focus:border-orange-400 focus:ring-4',
  admin: 'ring-blue-100 focus:border-blue-400 focus:ring-4',
  staff: 'ring-emerald-100 focus:border-emerald-400 focus:ring-4',
}

export function DateInput({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  variant = 'customer',
  size = 'md',
  className,
  invalid,
  maxDate,
  minDate,
  disabledFuture,
  disabledPast,
  clearable = true,
  calendarProps,
  formatDisplay,
  disabled,
  id,
  name,
  readOnly,
}: DateInputProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const parsed = value ? parseISO(value) : undefined
  const display = parsed && !Number.isNaN(parsed.getTime())
    ? (formatDisplay ? formatDisplay(parsed) : format(parsed, 'dd/MM/yyyy'))
    : ''

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

  const today = new Date()
  const from = disabledPast ? today : minDate
  const to = disabledFuture ? today : maxDate
  const disabledArr = [
    ...(from ? [{ before: from }] : []),
    ...(to ? [{ after: to }] : []),
  ] as unknown as any[]

  return (
    <div ref={wrapperRef} className={cn('relative w-full', className)}>
      <div
        className={cn(
          'group flex w-full items-center gap-2 rounded-2xl border bg-white outline-none transition',
          sizeClasses[size],
          variantRingClasses[variant],
          disabled && 'cursor-not-allowed bg-slate-50 opacity-60',
          invalid ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200',
          open && (variant === 'customer' ? 'border-orange-400 ring-4 ring-orange-100 z-20'
            : variant === 'admin' ? 'border-blue-400 ring-4 ring-blue-100 z-20'
            : 'border-emerald-400 ring-4 ring-emerald-100 z-20'),
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-400 group-focus-within:text-orange-500 transition" />
        <button
          id={id}
          name={name}
          type="button"
          disabled={disabled || readOnly}
          onClick={() => !(disabled || readOnly) && setOpen((v) => !v)}
          className={cn(
            'flex-1 truncate text-left font-medium outline-none',
            display ? 'text-slate-800' : 'text-slate-400',
          )}
        >
          {display || placeholder}
        </button>
        {clearable && value && !disabled ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onChange(null)
            }}
            className={cn(
              'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition',
              'hover:bg-slate-100 hover:text-slate-600',
            )}
            aria-label="Xóa ngày"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="absolute left-0 z-50 mt-2 w-max min-w-[360px] origin-top-left overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.28)] ring-1 ring-black/5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start justify-between gap-6 px-7 pt-7">
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-500">
                Chọn ngày
              </div>
              <div className="mt-1 text-[28px] font-black leading-none tracking-tight text-slate-900">
                {display || 'Select Date'}
              </div>
              <div className="mt-2 text-[11px] font-semibold text-slate-400">
                {parsed && !Number.isNaN(parsed.getTime())
                  ? format(parsed, 'EEEE, d MMMM yyyy', { locale: (calendarProps as any)?.locale ?? undefined })
                  : 'Chọn một ngày trên lịch bên dưới'}
              </div>
            </div>
          </div>
          <Calendar
            mode="single"
            selected={parsed}
            required={false}
            disabled={disabledArr.length ? disabledArr : undefined}
            onSelect={(d) => {
              if (!d) {
                onChange(null)
              } else {
                const iso = format(d, 'yyyy-MM-dd')
                onChange(iso)
                setOpen(false)
              }
            }}
            {...calendarProps}
          />
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-5">
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded-2xl px-5 py-2.5 text-sm font-extrabold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Xóa
            </button>
            <button
              type="button"
              disabled={disabledFuture}
              onClick={() => {
                const iso = format(new Date(), 'yyyy-MM-dd')
                onChange(iso)
                setOpen(false)
              }}
              className={cn(
                'rounded-2xl px-5 py-2.5 text-sm font-extrabold transition',
                disabledFuture
                  ? 'cursor-not-allowed text-slate-300'
                  : 'bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-orange-500/25 hover:brightness-105 active:scale-[0.98]',
              )}
            >
              Hôm nay
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
