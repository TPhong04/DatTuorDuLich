import http from 'node:http'

const payload = JSON.stringify({
  departureId: '1',
  adultCount: 2,
  childCount: 1,
  infantCount: 0,
  contact: { name: 'Trần Thị Bình', phone: '0918222333', email: 'binh.tt@example.com', address: '123 Lê Lợi, Q.1, TP.HCM' },
  passengers: [
    { fullName: 'Trần Văn Nam', type: 'NL', birthDate: '1990-05-15', gender: 'male', idCard: '001090123456', notes: null },
    { fullName: 'Nguyễn Thị Hoa', type: 'NL', birthDate: '1992-08-22', gender: 'female', idCard: '012388123456', notes: null },
    { fullName: 'Trần Ngọc Bảo', type: 'TE', birthDate: '2018-02-10', gender: 'male', idCard: null, notes: 'Trẻ em 8 tuổi cần ghế an toàn' }
  ],
  notes: 'Đoàn gia đình 3 người, cần phòng giường đôi + giường đơn. Cho đặt chỗ gần cửa sổ nếu có.',
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
    let json = null
    try { json = JSON.parse(data) } catch (_) {}
    const out = {
      status: res.statusCode,
      ok: res.statusCode && res.statusCode >= 200 && res.statusCode < 300,
      code: json?.code || null,
      subtotal: json?.subtotalAmount ?? null,
      total: json?.totalAmount ?? null,
      pax: { a: json?.adultCount ?? null, c: json?.childCount ?? null, i: json?.infantCount ?? null },
      contactEmail: json?.contact?.email !== undefined ? (json.contact.email || null) : 'MISSING',
      passengersN: Array.isArray(json?.passengers) ? json.passengers.length : null,
      createdAt: json?.createdAt || null,
      holdsUntil: json?.holdsUntil || null
    }
    console.log('MULTIPAX_RESULT', JSON.stringify(out, null, 2))
    if (json && json.code) {
      const expected = 2 * (json.priceAdultSnapshot || 0) + 1 * (json.priceChildSnapshot || 0)
      console.log('EXPECTED_SUBTOTAL_MATCH', expected === json.subtotalAmount, { expected, actual: json.subtotalAmount })
    }
    process.exit(0)
  })
})
req.on('error', (e) => { console.error('ERR', e.message); process.exit(1) })
req.on('timeout', () => { req.destroy(); console.error('TIMEOUT'); process.exit(2) })
req.write(payload)
req.end()
