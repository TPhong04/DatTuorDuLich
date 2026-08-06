type LinePoint = { label: string; value: number }

type RevenueLineChartProps = {
  data: LinePoint[]
  height?: number
  currencySuffix?: string
  accentFrom?: string
  accentTo?: string
}

export function RevenueLineChart({
  data,
  height = 220,
  currencySuffix = ' khách',
  accentFrom = '#fbbf24',
  accentTo = '#fb923c',
}: RevenueLineChartProps) {
  const width = 560
  const padding = { top: 20, right: 20, bottom: 30, left: 40 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const max = Math.max(1, ...data.map((d) => d.value))
  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0
  const yFor = (v: number) => padding.top + chartH - (v / max) * chartH
  const xFor = (i: number) => padding.left + i * xStep
  const pathD = data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(2)} ${yFor(p.value).toFixed(2)}`).join(' ')
  const areaD =
    pathD +
    ` L ${xFor(data.length - 1).toFixed(2)} ${(padding.top + chartH).toFixed(2)}` +
    ` L ${xFor(0).toFixed(2)} ${(padding.top + chartH).toFixed(2)} Z`
  const yTicks = 4
  const gradId = `lg-gradient-${Math.random().toString(36).slice(2, 8)}`
  const lineId = `lg-line-${Math.random().toString(36).slice(2, 8)}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accentTo} stopOpacity="0.35" />
          <stop offset="100%" stopColor={accentFrom} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor={accentTo} />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const y = padding.top + (chartH / yTicks) * i
        const val = Math.round((max / yTicks) * (yTicks - i))
        return (
          <g key={i}>
            <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
            <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
              {val.toLocaleString('vi-VN')}
              {currencySuffix}
            </text>
          </g>
        )
      })}

      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke={`url(#${lineId})`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

      {data.map((p, i) => {
        const cx = xFor(i)
        const cy = yFor(p.value)
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={4} fill="white" stroke="#2563eb" strokeWidth="2" />
            <text x={cx} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">
              {p.label}
            </text>
            <title>{`${p.label}: ${p.value.toLocaleString('vi-VN')}${currencySuffix}`}</title>
          </g>
        )
      })}
    </svg>
  )
}

type DonutSlice = { label: string; value: number; color: string }

type DonutChartProps = {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  centerSub?: string
}

export function DonutChart({
  data,
  size = 220,
  thickness = 28,
  centerLabel,
  centerValue,
  centerSub,
}: DonutChartProps) {
  const radius = size / 2
  const inner = radius - thickness
  const total = Math.max(1, data.reduce((s, d) => s + d.value, 0))
  const cx = radius
  const cy = radius
  let acc = 0

  const polar = (angle: number, r: number) => {
    const rad = (angle - 90) * (Math.PI / 180)
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const arc = (start: number, end: number, outer: number, innerR: number) => {
    const s = polar(start, outer)
    const e = polar(end, outer)
    const si = polar(end, innerR)
    const ei = polar(start, innerR)
    const large = end - start > 180 ? 1 : 0
    return [
      `M ${s.x.toFixed(2)} ${s.y.toFixed(2)}`,
      `A ${outer} ${outer} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`,
      `L ${si.x.toFixed(2)} ${si.y.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${ei.x.toFixed(2)} ${ei.y.toFixed(2)}`,
      'Z',
    ].join(' ')
  }

  const slices = data.map((d, i) => {
    const start = (acc / total) * 360
    acc += d.value
    const end = (acc / total) * 360
    const safeEnd = end - start <= 0.0001 ? start + 0.0001 : end
    const percent = (d.value / total) * 100
    const path = arc(start, safeEnd, radius - 2, inner)
    return { id: i, path, percent, label: d.label, color: d.color, value: d.value }
  })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius - 2} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
        {slices.map((s) => (
          <path
            key={s.id}
            d={s.path}
            fill={s.color}
            stroke="white"
            strokeWidth="2"
          >
            <title>{`${s.label}: ${s.value.toLocaleString('vi-VN')} (${s.percent.toFixed(1)}%)`}</title>
          </path>
        ))}
        {centerValue ? (
          <g>
            <text x={cx} y={cy - (centerLabel ? 10 : 4)} textAnchor="middle" fontSize="20" fontWeight="800" fill="#0f172a">
              {centerValue}
            </text>
            {centerLabel ? (
              <text x={cx} y={cy + 10} textAnchor="middle" fontSize="11" fill="#64748b">
                {centerLabel}
              </text>
            ) : null}
            {centerSub ? (
              <text x={cx} y={cy + 24} textAnchor="middle" fontSize="9" fill="#94a3b8">
                {centerSub}
              </text>
            ) : null}
          </g>
        ) : null}
      </svg>
      <ul className="flex-1 space-y-2 min-w-0">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate font-medium text-slate-700">{s.label}</span>
            <span className="ml-auto shrink-0 font-extrabold text-slate-900">
              {s.percent.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
