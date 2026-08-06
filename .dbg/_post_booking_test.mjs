import http from 'node:http'

const payload = JSON.stringify({
  departureId: '1',
  adultCount: 1,
  childCount: 0,
  infantCount: 0,
  contact: { name: 'Nguyễn Văn A', phone: '0900123456', email: null, address: 'Hà Nội' },
  passengers: [
    { fullName: 'Nguyễn Văn An', type: 'NL', birthDate: null, gender: 'male', idCard: null, notes: null }
  ],
  notes: null,
  surcharges: [],
  paymentMethod: 'hold',
  agreeTerms: true
})

const req = http.request({
  hostname: '127.0.0.1',
  port: 4000,
  path: '/api/tours/tour-du-lich-ha-noi-phu-quoc-4n3d/bookings',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  },
  timeout: 30000
}, (res) => {
  let data = ''
  res.on('data', (c) => { data += c.toString() })
  res.on('end', () => {
    const out = {
      status: res.statusCode,
      headers_ct: res.headers['content-type'] || null,
      body_text: data.slice(0, 3500)
    }
    try { out.body_json = JSON.parse(data) } catch (_) { out.body_json = null }
    console.log('RESULT', JSON.stringify(out, null, 2))
    process.exit(0)
  })
})
req.on('error', (e) => {
  console.error('ERR', e.message)
  process.exit(1)
})
req.on('timeout', () => { req.destroy(); console.error('TIMEOUT'); process.exit(2) })
req.write(payload)
req.end()
