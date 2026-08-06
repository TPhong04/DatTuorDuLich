import { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export default function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: string
  subtitle?: string
  right?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100 md:flex md:items-center md:justify-between',
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-800 via-orange-500 to-blue-800" />
      <div className="relative pt-1">
        <div className="flex items-center gap-3">
          <div className="h-9 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-blue-800" />
          <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">{title}</h1>
        </div>
        {subtitle ? <p className="mt-2 pl-4 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {right ? (
        <div className="mt-4 flex w-full shrink-0 items-center justify-end gap-2 md:mt-0 md:w-auto md:max-w-[45%]">
          {right}
        </div>
      ) : null}
    </div>
  )
}

