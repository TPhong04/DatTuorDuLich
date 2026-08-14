import React, { forwardRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { vi } from 'date-fns/locale/vi'
import { cn } from '@/lib/utils'
import type { UI, SelectionState, DayFlag, Animation } from 'react-day-picker'

type ClassNameMap = Partial<Record<UI | SelectionState | DayFlag | Animation | string, string>>

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function IconLeft() {
  return <ChevronLeft className="h-4 w-4 text-slate-500" />
}
function IconRight() {
  return <ChevronRight className="h-4 w-4 text-slate-500" />
}

function CustomSelectBase(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & {
    options?: Array<{ value: string | number; label: React.ReactNode }>
    className?: string
    children?: React.ReactNode
    name?: string
  },
  ref: React.ForwardedRef<HTMLSelectElement>,
) {
  const { children, className, name, options, value, onChange, ...rest } = props
  return (
    <select
      ref={ref}
      name={name}
      value={value ?? ''}
      onChange={onChange}
      className={cn(
        'h-10 min-w-[120px] rounded-2xl border-0 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none transition cursor-pointer hover:bg-slate-100 appearance-none',
        className,
      )}
      {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
    >
      {children ??
        options?.map((opt) => (
          <option key={String(opt.value)} value={opt.value}>
            {opt.label}
          </option>
        ))}
    </select>
  )
}

const CustomSelect = forwardRef<HTMLSelectElement, any>(CustomSelectBase as any)

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'dropdown',
  fixedWeeks = true,
  ...props
}: CalendarProps) {
  const _anyProps = props as any
  const selected = _anyProps.selected

  const pickedDay: Date | undefined = (() => {
    if (!selected) return undefined
    if (selected instanceof Date) return selected
    if (Array.isArray(selected)) return undefined
    const range = selected as { from?: Date; to?: Date }
    if (range.from) return range.from
    return undefined
  })()

  const mappedClassNames: ClassNameMap = {
    months: 'flex flex-col sm:flex-row gap-6 pt-10',
    month: 'space-y-4',
    month_caption: 'flex items-center justify-between gap-3 mb-1',
    caption_label: 'hidden',
    dropdowns: 'flex items-center gap-3 flex-1',
    nav: 'hidden',
    button_next: 'hidden',
    button_previous: 'hidden',
    month_grid: 'w-full border-collapse space-y-1',
    weekdays: 'flex gap-1',
    weekday:
      'text-[12px] font-extrabold uppercase tracking-wider text-slate-400 flex-1 flex items-center justify-center py-2.5',
    week: 'mt-1 flex w-full gap-1',
    day: cn(
      'flex-1 flex items-center justify-center text-center text-sm p-0 relative',
      'focus-within:relative focus-within:z-20',
    ),
    day_button: cn(
      'h-12 w-full flex items-center justify-center rounded-none text-[15px] font-semibold text-slate-700 transition cursor-pointer relative bg-transparent border-0 outline-none',
      'hover:text-orange-600',
    ),
    today: 'text-slate-700',
    outside: 'text-slate-300 opacity-60',
    disabled: 'text-slate-300 opacity-40 line-through cursor-not-allowed hover:bg-transparent',
    selected: cn(
      '!bg-transparent !text-amber-500 !font-black',
      'after:absolute after:left-1/2 after:bottom-2 after:-translate-x-1/2',
      'after:h-[3px] after:w-10 after:rounded-full after:bg-gradient-to-r after:from-amber-400 after:to-amber-500',
    ),
    range_start: 'range-start',
    range_end: 'range-end',
    range_middle:
      'bg-gradient-to-r from-amber-50 to-orange-50 text-orange-800 rounded-none !text-orange-700',
    focused: '',
    hidden: 'invisible',
    ...(classNames as ClassNameMap),
  }

  return (
    <div className="relative">
      <div className="pointer-events-none absolute right-5 top-5 z-10 flex flex-col items-center">
        <div className="relative">
          <div className="absolute -top-1.5 left-3 h-2 w-2 rounded-full bg-red-400" />
          <div className="absolute -top-1.5 right-3 h-2 w-2 rounded-full bg-red-400" />
          <div className="flex h-[86px] w-[86px] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500 text-white shadow-xl shadow-orange-500/30">
            <CalendarIcon className="h-6 w-6 opacity-30" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-black leading-none text-white">
            <div className="text-[46px] tracking-tight drop-shadow-sm">
              {String((pickedDay ?? new Date()).getDate()).padStart(2, '0')}
            </div>
          </div>
        </div>
      </div>

      <DayPicker
        {...({
          locale: vi,
          weekStartsOn: 0,
          fixedWeeks,
          showOutsideDays,
          captionLayout,
          startMonth: new Date(1940, 0, 1),
          endMonth: new Date(2100, 11, 31),
          className: cn('p-6 select-none', className),
          components: {
            Chevron: (({ className }: any) => (
              <ChevronRight
                className={cn(
                  'h-4 w-4 text-slate-500 rotate-180',
                  className,
                )}
              />
            )) as any,
            Select: CustomSelect as any,
          } as any,
          classNames: mappedClassNames as any,
          selected,
          ...(props as any),
        } as any)}
      />
    </div>
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }
