import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export default function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'card-hover relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-blue-50/40 to-orange-50/40 p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100 md:flex md:items-center md:justify-between',
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-gradient-to-br from-blue-400/20 to-orange-400/20 blur-2xl" />
      <div className="absolute inset-x-0 top-0 h-[3px] gradient-sweep-x bg-gradient-to-r from-indigo-600 via-orange-500 to-blue-700" />
      <div className="relative pt-1">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-9 w-1.5 rounded-full bg-gradient-to-b from-orange-500 via-indigo-500 to-blue-800 shadow-[0_0_12px_rgba(249,115,22,0.35)]" />
          </div>
          <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-800 via-blue-700 to-orange-600 bg-clip-text text-transparent md:text-2xl">{title}</h1>
        </div>
        {subtitle ? <div className="mt-2 pl-4 text-sm text-slate-600">{subtitle}</div> : null}
      </div>
      {right ? (
        <div className="mt-4 flex w-full shrink-0 items-center justify-end gap-2 md:mt-0 md:w-auto md:max-w-[45%]">
          {right}
        </div>
      ) : null}
    </div>
  )
}

