import { register, Counter, Histogram } from 'prom-client'

const kPrefix = 'vnexplorer_'

export const httpRequestCount = new Counter({
  name: `${kPrefix}http_requests_total`,
  help: 'Number of HTTP requests total, partitioned by method route status',
  labelNames: ['method', 'route', 'status_code'] as const,
})

export const httpRequestDurationMs = new Histogram({
  name: `${kPrefix}http_request_duration_ms`,
  help: 'Histogram HTTP request duration milliseconds',
  labelNames: ['method', 'route', 'status_family'] as const,
  buckets: [5, 10, 25, 50, 100, 200, 400, 800, 1500, 3000, 6000, 12000],
})

export const paymentWebhookCount = new Counter({
  name: `${kPrefix}payments_webhook_calls_total`,
  help: 'Webhook payment provider calls',
  labelNames: ['provider', 'status'] as const,
})

export const bookingStateTransition = new Counter({
  name: `${kPrefix}booking_transitions_total`,
  help: 'Booking state transitions Won → Cancel etc.',
  labelNames: ['from_state', 'to_state'] as const,
})

export async function getMetricsContentType(): Promise<{ contentType: string; body: string }> {
  const contentType = register.contentType
  const body = await register.metrics()
  return { contentType, body }
}

export function clearMetricsForTestOnly() {
  register.clear()
  httpRequestCount.reset()
  httpRequestDurationMs.reset()
  paymentWebhookCount.reset()
  bookingStateTransition.reset()
}
