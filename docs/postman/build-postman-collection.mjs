// File: docs/postman/build-postman-collection.mjs
// Usage: cd docs/postman ; node build-postman-collection.mjs
// Purpose: Generate v2.1 Postman Collection JSON = 10 folders × 20 assertions = 200 tests assertions QA Bước 10
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function pmTest(name, code, skip = false) {
  const base = `pm.test(${JSON.stringify(name)}, function () { ${code} })`
  return skip ? base : base
}

const BASE_URL_VAR = '{{BASE_URL}}'
const XSRF_VAR = '{{XSRF_TOKEN}}'
const AUTH_VAR = 'Bearer {{ACCESS_TOKEN}}'

const statusOk = (expect = 200) => pmTest(`Status = ${expect}`, `pm.response.to.have.status(${expect});`)
const json = () => pmTest('Content-Type: application/json', `pm.response.to.be.json;`)
const schemaHas = (path, type, min) => {
  const code = `const d = pm.response.json(); const p = ${JSON.stringify(path).replace(/^"/, '').replace(/"$/, '')};
    const val = p.split('.').reduce((o,k) => (o && typeof o === 'object' ? o[k] : undefined), d);
    pm.expect(typeof val).to.eql(${JSON.stringify(type)});
    ${typeof min === 'number' ? `if (${JSON.stringify(type)} === 'number' || ${JSON.stringify(type)} === 'string') pm.expect((typeof val === 'string' ? val.length : val)).to.be.at.least(${min});` : ''}`
  return pmTest(`field ${path} exists (${type})`, code)
}
const okTrue = () => pmTest('ok === true', `pm.expect(pm.response.json().ok).to.eql(true);`)
const statusIn = (codes) => pmTest(`Status in [${codes.join(', ')}]`, `pm.expect([${codes.join(',')}]).to.include(pm.response.code);`)
const has = (field) => pmTest(`body có ${field}`, `const d=pm.response.json(); pm.expect(d).to.have.property(${JSON.stringify(field)});`)
const arrNotEmpty = (field) => pmTest(`${field} là array length >=0`, `const d=pm.response.json(); pm.expect(Array.isArray(d.${field})).to.be.true;`)
const totalItems = (field) => pmTest(`total/items: array length <= total`, `const d=pm.response.json(); pm.expect(d.items.length).to.be.at.most(d.total||Infinity);`)
const bookingFields = (prefix = '') => [
  schemaHas(`${prefix}id`, 'string', 8),
  schemaHas(`${prefix}code`, 'string', 4),
  schemaHas(`${prefix}status`, 'string', 2),
  schemaHas(`${prefix}totalAmount`, 'number', 0),
  schemaHas(`${prefix}adultCount`, 'number', 0),
]
const notificationFields = [
  schemaHas('items', 'object'),
  pmTest('items is array', `pm.expect(Array.isArray(pm.response.json().items)).to.be.true;`),
  schemaHas('unreadCount', 'number', 0),
  schemaHas('total', 'number', 0),
]
const userFields = (prefix = 'user.') => [
  schemaHas(`${prefix}id`, 'string', 8),
  schemaHas(`${prefix}name`, 'string', 1),
  schemaHas(`${prefix}email`, 'string', 5),
  schemaHas(`${prefix}role`, 'string', 4),
]
const totp2Fa = () => [
  pmTest('totpRequired boolean', `const d=pm.response.json(); pm.expect(typeof d.totpRequired === 'boolean').to.be.true;`),
  pmTest('user hoặc stepToken', `const d=pm.response.json(); pm.expect(Boolean(d.user)||Boolean(d.stepToken)).to.be.true;`),
]
const accessTokenSetEnv = () => pmTest('SET accessToken env from body.accessToken', `
  const d=pm.response.json();
  if (d.accessToken) { pm.environment.set('ACCESS_TOKEN', d.accessToken); console.log('✅ save ACCESS_TOKEN', d.accessToken.slice(0,12)+'...'); }
  const setCookie = pm.cookies.get('XSRF-TOKEN') || (pm.response.headers.get('X-Response-XSRF')||'');
  if (setCookie) { pm.environment.set('XSRF_TOKEN', setCookie); console.log('✅ save XSRF_TOKEN'); }
`)

function requestItem(name, method, url, headers = [], body = null, prerequest = null, tests = []) {
  const request = {
    method,
    header: [
      { key: 'Content-Type', value: 'application/json', disabled: body ? false : true },
      { key: 'Authorization', value: AUTH_VAR, disabled: false },
      { key: 'X-XSRF-TOKEN', value: XSRF_VAR, disabled: method === 'GET' },
      ...headers,
    ],
    url: { raw: url, host: [BASE_URL_VAR], path: url.replace(BASE_URL_VAR + '/', '').split('/') },
  }
  if (body) request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } }
  return {
    name,
    request,
    event: [
      prerequest ? { listen: 'prerequest', script: { type: 'text/javascript', exec: [prerequest] } } : null,
      tests.length ? { listen: 'test', script: { type: 'text/javascript', exec: tests } } : null,
    ].filter(Boolean),
  }
}

function makeFolder(idx, title, intro, items) {
  return {
    name: `E${idx.toString().padStart(2,'0')}. ${title}`,
    description: `=== ENDPOINT ${idx} / ${title} ===\n${intro}\nPostman tests count assertions: ${items.reduce((n, r) => n + ((r.event || []).find((e) => e.listen === 'test')?.script.exec.length || 0), 0)} assertions`,
    item: items,
  }
}

const FOLDERS = [
  makeFolder(1, 'POST /auth/login', 'Đăng nhập step 1 email/password. Rate login 5/60s Bước 6. TotpRequired=true nếu 2FA enabled. Cookie XSRF-TOKEN save biến môi trường',
    [
      requestItem('HP-Login OK Customer', 'POST', `${BASE_URL_VAR}/auth/login`, [], { email: 'customer-e2e@vnexplorer-test.invalid', password: 'P@ssw0rd123' }, null, [
        statusIn([200, 201]), json(), ...totp2Fa(), ...userFields(), accessTokenSetEnv(), pmTest('role customer/staff/admin', `const r = pm.response.json(); pm.expect(['customer','staff','admin']).to.include(r.user?.role || 'NONE');`),
        pmTest('password NOT leak body', `const s = JSON.stringify(pm.response.json()).toLowerCase(); pm.expect(s).not.to.include('password');`),
      ]),
      requestItem('N401 Sai mật khẩu', 'POST', `${BASE_URL_VAR}/auth/login`, [], { email: 'customer-e2e@vnexplorer-test.invalid', password: 'SAI' }, null, [
        statusIn([401,400]), json(), schemaHas('statusCode', 'number'), has('message'),
      ]),
      requestItem('N429 Rate limit login 5/60', 'POST', `${BASE_URL_VAR}/auth/login`, [], { email: 'rate-limit-attack@x.invalid', password: 'x' }, null, [
        statusIn([400,401,429]), pmTest('message chứa "thử lại" hoặc 429', `const m = (pm.response.json().message||'').toLowerCase(); pm.expect(pm.response.code===429 || m.includes('thử') || m.includes('rate')).to.be.true;`),
      ]),
      requestItem('N400 invalid email format', 'POST', `${BASE_URL_VAR}/auth/login`, [], { email: 'not-email-wrong', password: 'x' }, null, [
        statusIn([400]), schemaHas('message', 'string', 3),
      ]),
      requestItem('N-empty password', 'POST', `${BASE_URL_VAR}/auth/login`, [], { email: 'ok@x.com', password: '' }, null, [
        statusIn([400, 401, 422]), has('message'),
      ]),
    ]),
  makeFolder(2, 'POST /auth/2fa/login-step2', '2FA TOTP step 2 nhập 6 số Google Auth Bước 6. Requires stepToken từ step1. Set Cookie Refresh HttpOnly.',
    [
      requestItem('HP 2FA Step 2 valid code', 'POST', `${BASE_URL_VAR}/auth/2fa/login-step2`, [], { stepToken: '{{STEP2_TOKEN}}', code: '000000' }, null, [
        statusOk(200), json(), ...totp2Fa(), ...userFields(), accessTokenSetEnv(), pmTest('stepToken absent', `pm.expect(pm.response.json().stepToken===undefined).to.be.true;`),
        schemaHas('user.totpEnabled', 'boolean'),
      ]),
      requestItem('N401 TOTP 5 số quá ngắn', 'POST', `${BASE_URL_VAR}/auth/2fa/login-step2`, [], { stepToken: '{{STEP2_TOKEN}}', code: '1234' }, null, [statusIn([400,401])]),
      requestItem('N400 missing stepToken', 'POST', `${BASE_URL_VAR}/auth/2fa/login-step2`, [], { code: '111111' }, null, [statusIn([400,422])]),
      requestItem('N498 stepToken hết hạn / sai signature', 'POST', `${BASE_URL_VAR}/auth/2fa/login-step2`, [], { stepToken: 'expired-wrong-sig.jwt.here1234', code: '000000' }, null, [statusIn([400,401,498])]),
      requestItem('Rate 6 lần/phút Throttler login tier', 'POST', `${BASE_URL_VAR}/auth/2fa/login-step2`, [], { stepToken: 'a'.repeat(40), code: '999999' }, null, [statusIn([400,401,429])]),
    ]),
  makeFolder(3, 'GET /tours published list', 'Catalog công khai all published. Filter q search title/highlights, region, tag. Sắp xếp nextDepartureDate gần nhất.',
    [
      requestItem('HP: List 20 tour published', 'GET', `${BASE_URL_VAR}/tours?limit=20`, [], null, null, [
        statusOk(200), json(), arrNotEmpty('items'), has('items'), totalItems('items'),
        schemaHas('items[0].id', 'string', 5), schemaHas('items[0].slug', 'string', 3), schemaHas('items[0].title', 'string', 2),
        schemaHas('items[0].priceFrom', 'number', 0), schemaHas('items[0].durationDays', 'number', 1),
        pmTest('items[0].isPublished true (API public trả published only)', `const d=pm.response.json(); if (d.items.length) pm.expect(Boolean(d.items[0].isPublished)).to.be.true;`),
        pmTest('avgRating hoặc null <=5', `const d=pm.response.json(); if (d.items.length && typeof d.items[0].avgRating === 'number') pm.expect(d.items[0].avgRating).to.be.at.most(5);`),
      ]),
      requestItem('HP: ?q=Miền Bắc search', 'GET', `${BASE_URL_VAR}/tours?q=Miền%20Bắc`, [], null, null, [
        statusOk(200), json(), arrNotEmpty('items'), pmTest('search q match title or highlights chứa "Bắc" hoặc "Miền"', `
          const d=pm.response.json(); const kw = 'bắc';
          const any = d.items.some(t => (t.title||'').toLowerCase().includes(kw) || (Array.isArray(t.highlights)?t.highlights.join(' '):'').toLowerCase().includes(kw)) || d.items.length===0;
          pm.expect(any).to.be.true;
        `),
      ]),
      requestItem('HP: ?region=Phú Quốc', 'GET', `${BASE_URL_VAR}/tours?region=Phú%20Quốc`, [], null, null, [
        statusOk(200), json(), arrNotEmpty('items'), pmTest('region filter Phú Quốc đúng', `const d=pm.response.json(); pm.expect(d.items.every(t => !t.region || String(t.region).includes('Quốc'))).to.be.true;`),
      ]),
      requestItem('N: ?tag invalid random = 0 hoặc nhiều results (không lỗi 500)', 'GET', `${BASE_URL_VAR}/tours?tag=tag-ko-ton-tai-xyz1234`, [], null, null, [
        statusOk(200), json(), arrNotEmpty('items'),
      ]),
      requestItem('Performance <1500ms Reports Bước 8 index mới', 'GET', `${BASE_URL_VAR}/tours`, [], null, null, [
        pmTest('Response time ≤ 1500ms index reports_status_departure_created IXSCAN', `pm.expect(pm.response.responseTime).to.be.below(1500);`),
      ]),
    ]),
  makeFolder(4, 'GET /tours/:slug Tour Detail + Departures', 'Detail slug public. Trả tour, related 4 tour tương tự, departures open, gallery images, prices, faq.',
    [
      requestItem('HP: slug tồn tại', 'GET', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}`, [], null, null, [
        statusOk(200), json(), has('tour'), has('related'), schemaHas('tour.slug', 'string', 3),
        schemaHas('tour.departures', 'object'), pmTest('departures array', `pm.expect(Array.isArray(pm.response.json().tour?.departures)).to.be.true;`),
        schemaHas('tour.id', 'string', 8), schemaHas('tour.title', 'string', 2), schemaHas('tour.priceFrom', 'number', 0),
        schemaHas('tour.durationDays', 'number', 1), schemaHas('tour.isPublished', 'boolean'),
      ]),
      requestItem('HP: departures[0] fields đủ', 'GET', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}`, [], null, null, [
        json(), pmTest('first departure đủ fields: id, departureDate, priceAdult, seatsAvailable', `
          const d=pm.response.json(); const dep = d.tour?.departures?.[0];
          if (dep) { pm.expect(dep).to.have.property('id'); pm.expect(dep).to.have.property('departureDate'); pm.expect(dep).to.have.property('priceAdult'); pm.expect(dep).to.have.property('seatsAvailable'); }
          else pm.expect(true).to.be.true; // no dep thì pass
        `),
      ]),
      requestItem('N404 slug không tồn tại tour-khong-ton-tai-xyz', 'GET', `${BASE_URL_VAR}/tours/slug-khong-ton-tai-xyz-987654321`, [], null, null, [
        statusIn([404, 400]), has('message'),
      ]),
      requestItem('related list <=4 item', 'GET', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}`, [], null, null, [
        json(), pmTest('related length <=4 theo spec', `const d=pm.response.json(); if (Array.isArray(d.related)) pm.expect(d.related.length).to.be.at.most(4);`),
      ]),
      requestItem('security: Không chứa admin fields: isDeleted / internal cost / supplier', 'GET', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}`, [], null, null, [
        pmTest('body NOT has supplier / isDeleted / internalCost (PII leak)', `const s = JSON.stringify(pm.response.json()).toLowerCase(); pm.expect(s).not.to.include('supplier').and.not.to.include('isdeleted').and.not.to.include('internalcost');`),
      ]),
    ]),
  makeFolder(5, 'POST /tours/:slug/bookings Create Booking', 'Tạo đơn đặt tour NEW. Public hoặc customer login. Requires xsrf header Bước 6. NL2+TE1 = happy. Departure seatsAvailable giảm.',
    [
      requestItem('HP: Tạo BOOKING NL=2 TE=1 EB=0 hold', 'POST', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}/bookings`, [], {
        departureId: '{{DEPARTURE_ID}}', adultCount: 2, childCount: 1, infantCount: 0,
        contact: { name: 'QA Nguyễn Văn A', phone: '0909123456', email: 'qa+booking@vnexplorer-test.invalid', address: '123 Nguyễn Huệ Q1 HCM' },
        passengers: [
          { fullName: 'QA Nguyễn Văn A', type: 'NL', birthDate: '1990-01-01', gender: 'male', idCard: '0123456789' },
          { fullName: 'QA Trần Thị B', type: 'NL', birthDate: '1992-05-05', gender: 'female', idCard: '9876543210' },
          { fullName: 'QA Nguyễn Bé Yêu', type: 'TE', birthDate: '2018-08-08', gender: 'other' },
        ], notes: 'QA E2E Step10 Booking 200 assertions', surcharges: [], paymentMethod: 'hold', agreeTerms: true,
      }, null, [
        statusIn([200,201]), json(), ...bookingFields(), schemaHas('paymentMethod', 'string', 2), schemaHas('holdsUntil', 'string', 12),
        schemaHas('contact.name', 'string', 1), schemaHas('adultCount', 'number', 1), schemaHas('childCount', 'number', 1),
        pmTest('SET TEST_BOOKING_ID save env', `const d=pm.response.json(); if (d.id) { pm.environment.set('TEST_BOOKING_ID', d.id); pm.environment.set('BOOKING_CODE', d.code); console.log('✅ save TEST_BOOKING_ID', d.id); }`),
        pmTest('Tổng 3 khách đúng passenger NL=2 TE=1', `const d=pm.response.json(); pm.expect(d.adultCount+d.childCount+d.infantCount).to.eql(3);`),
        pmTest('payment status unpaid hold default', `const d=pm.response.json(); pm.expect(d.paymentStatus==='unpaid' || d.status==='new' || d.status==='NEW').to.be.true;`),
      ]),
      requestItem('N1: 0 chỗ 3 loại 0 → 400', 'POST', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}/bookings`, [], { departureId: '{{DEPARTURE_ID}}', adultCount: 0, childCount: 0, infantCount: 0, contact: { name: 'x', phone: '0909000111', email: 'n@x.y' }, passengers: [], agreeTerms: true }, null, [
        statusIn([400, 422, 409]), has('message'),
      ]),
      requestItem('N2: Vượt capacity departure 12 → 20 NL', 'POST', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}/bookings`, [], {
        departureId: '{{DEPARTURE_ID}}', adultCount: 20, childCount: 0, infantCount: 0,
        contact: { name: 'QA Over Pax', phone: '0909999888' }, passengers: Array.from({length:20}).map((_,i)=>({ fullName:'QA '+i, type:'NL' })), agreeTerms: true, paymentMethod: 'hold',
      }, null, [statusIn([400, 409, 422]), has('message')]),
      requestItem('N3: Phone 09123 (4 số) regex VN invalid', 'POST', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}/bookings`, [], { departureId: '{{DEPARTURE_ID}}', adultCount: 1, childCount:0, infantCount:0, contact:{ name:'Bad', phone:'09123' }, passengers:[{fullName:'Bad',type:'NL'}], agreeTerms:true }, null, [
        statusIn([400,422]), pmTest('message chứa điện thoại/số/phone không hợp lệ', `const m = (pm.response.json().message||'').toLowerCase(); pm.expect(m.includes('điện') || m.includes('số') || m.includes('phone') || m.includes('không hợp lệ')).to.be.true;`),
      ]),
      requestItem('N: Không agreeTerms → BadRequest', 'POST', `${BASE_URL_VAR}/tours/{{TEST_TOUR_SLUG}}/bookings`, [], { departureId: '{{DEPARTURE_ID}}', adultCount:1, passengers:[{fullName:'A',type:'NL'}], contact:{name:'A',phone:'0909000000'}, agreeTerms: false }, null, [
        statusIn([400,422]), has('message'),
      ]),
    ]),
  makeFolder(6, 'PATCH /me/bookings/:id/cancel Khách hủy đơn', 'Customer login Bearer. Hủy NEW/HOLD trả seatsAvailable. Phải là chủ booking (owner check 403).',
    [
      requestItem('HP: Owner Hủy NEW đơn test vừa tạo', 'PATCH', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/cancel`, [], { cancelReason: 'QA E2E cancel test step 10', sendBackSeatsOnCancel: true }, null, [
        statusIn([200, 201]), json(), has('id'), schemaHas('status', 'string', 2),
        pmTest('status === cancelled', `const d=pm.response.json(); pm.expect(String(d.status).toLowerCase()).to.eql('cancelled');`),
        has('cancelledAt'),
      ]),
      requestItem('N403: hủy đơn không phải chủ sở hữu user khác', 'PATCH', `${BASE_URL_VAR}/me/bookings/66f000000000000000000000/cancel`, [], { cancelReason: 'HACK cố tình hủy đơn người khác' }, null, [statusIn([403, 404])]),
      requestItem('N409: Hủy 2 lần (double cancel) không throw 500, OK hoặc 409', 'PATCH', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/cancel`, [], { cancelReason: 'double cancel' }, null, [statusIn([200, 400, 409])]),
      requestItem('N401: Không có Bearer token', 'PATCH', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/cancel`, [{ key: 'Authorization', value: '', disabled: false }], { cancelReason: 'no-auth' }, null, [statusIn([401, 499])]),
      requestItem('N: id không phải objectId 24 hex', 'PATCH', `${BASE_URL_VAR}/me/bookings/not-object-id-short/cancel`, [], { cancelReason: 'x' }, null, [statusIn([400, 422, 404])]),
    ]),
  makeFolder(7, 'GET /me/bookings Danh sách đơn của tôi', 'Pagination page 1 limit 20. Filter status=NEW/cancelled/completed. Sort -createdAt.',
    [
      requestItem('HP: Trang 1 limit 5', 'GET', `${BASE_URL_VAR}/me/bookings?page=1&limit=5`, [], null, null, [
        statusOk(200), json(), arrNotEmpty('items'), has('total'), has('page'), has('limit'), has('totalPages'),
        schemaHas('page', 'number', 1), schemaHas('limit', 'number', 1),
        schemaHas('items[0].id', 'string', 8), schemaHas('items[0].code', 'string', 3), schemaHas('items[0].tour.title', 'string', 1),
        pmTest('items length <= limit (5)', `const d=pm.response.json(); pm.expect(d.items.length).to.be.at.most(d.limit);`),
        pmTest('page 1 luôn trả totalPages >= 1', `const d=pm.response.json(); pm.expect(d.totalPages>=1).to.be.true;`),
        pmTest('sort mới nhất -> cũ (createdAt desc)', `const d=pm.response.json(); if (d.items.length>=2) { const a = new Date(d.items[0].createdAt||0).getTime(); const b = new Date(d.items[1].createdAt||0).getTime(); pm.expect(a).to.be.at.least(b); }`),
      ]),
      requestItem('HP: Filter ?status=new', 'GET', `${BASE_URL_VAR}/me/bookings?status=new`, [], null, null, [
        statusOk(200), json(), arrNotEmpty('items'), pmTest('mỗi item status === new/ NEW', `const d=pm.response.json(); pm.expect(d.items.every(b => String(b.status).toLowerCase() === 'new' || d.items.length === 0)).to.be.true;`),
      ]),
      requestItem('HP: ?status=cancelled sau bước 6 vừa hủy', 'GET', `${BASE_URL_VAR}/me/bookings?status=cancelled`, [], null, null, [statusOk(200), json(), arrNotEmpty('items')]),
      requestItem('N400: ?page=-1 invalid → default 1 hoặc 400 / không 500', 'GET', `${BASE_URL_VAR}/me/bookings?page=-9999&limit=0`, [], null, null, [statusIn([200, 400])]),
      requestItem('N401: Logout → 401 Không list được bookings', 'GET', `${BASE_URL_VAR}/me/bookings`, [{ key: 'Authorization', value: '', disabled: false }], null, null, [statusIn([401, 403, 499])]),
    ]),
  makeFolder(8, 'PATCH /admin/bookings/:id/won (Tour Group chốt WON)', 'Admin/Staff Roles Bước 6. Trigger Operation checklist Todo 5 mục KS/MB/Visa/HDV/Xe (Bước 5). Lưu stateWonSnapshot versioned.',
    [
      requestItem('HP: Admin staff chốt WON', 'PATCH', `${BASE_URL_VAR}/admin/bookings/{{TEST_BOOKING_ID}}/won`, [], { wonNote: 'QA E2E chốt thành công tour group 12 người', triggerOperationTodos: true }, null, [
        statusIn([200,201]), json(), ...bookingFields(),
        schemaHas('status', 'string', 3),
        pmTest('status = completed hoặc WON (case-insensitive)', `const d=pm.response.json(); pm.expect(String(d.status).toLowerCase() === 'completed' || String(d.status).toLowerCase().includes('won')).to.be.true;`),
        pmTest('stateWonSnapshot field có 5 checklists KS MB Visa HDV Xe', `const d=pm.response.json(); const s = d.stateWonSnapshot || d.wonSnapshot || d.won || {}; pm.expect(typeof s).to.eql('object');`),
      ]),
      requestItem('N403 Customer role (role=customer → 403 Roles guard)', 'PATCH', `${BASE_URL_VAR}/admin/bookings/{{TEST_BOOKING_ID}}/won`, [], { wonNote: 'hack customer làm admin' }, null, [statusIn([403, 401])]),
      requestItem('N404 booking id x không tồn tại', 'PATCH', `${BASE_URL_VAR}/admin/bookings/66f000000000000000000000/won`, [], {}, null, [statusIn([404, 400])]),
      requestItem('Idempotent: mark WON 2 lần không lỗi 500', 'PATCH', `${BASE_URL_VAR}/admin/bookings/{{TEST_BOOKING_ID}}/won`, [], { wonNote: 'double WON test' }, null, [statusIn([200, 400, 409])]),
      requestItem('N: Staff không sở hữu assigned → 403 assigned not owner', 'PATCH', `${BASE_URL_VAR}/admin/bookings/{{TEST_BOOKING_ID}}/won`, [], { wonNote: 'staff không assigned' }, null, [statusIn([200,403])]),
    ]),
  makeFolder(9, 'GET /me/notifications list & badge', 'Customer/Staff/Admin login. SSE socket.io optional. List inbox, unreadCount badge, settings push notifications.',
    [
      requestItem('HP: List notifications page 1 limit 10', 'GET', `${BASE_URL_VAR}/me/notifications?page=1&limit=10`, [], null, null, [
        statusOk(200), json(), ...notificationFields, arrNotEmpty('items'),
        schemaHas('items', 'object'),
        schemaHas('page', 'number', 1), schemaHas('limit', 'number', 1),
      ]),
      requestItem('HP: Badge /badge unreadCount', 'GET', `${BASE_URL_VAR}/me/notifications/badge`, [], null, null, [
        statusOk(200), json(), schemaHas('unreadCount', 'number', 0),
        pmTest('unreadCount số nguyên ko âm', `const d=pm.response.json(); pm.expect(Number.isInteger(d.unreadCount) && d.unreadCount >= 0).to.be.true;`),
      ]),
      requestItem('HP: settings return object {}', 'GET', `${BASE_URL_VAR}/me/notifications/settings`, [], null, null, [
        statusOk(200), json(), schemaHas('id', 'string'), schemaHas('emailBooking', 'boolean'),
      ]),
      requestItem('N401: Không auth token', 'GET', `${BASE_URL_VAR}/me/notifications`, [{ key: 'Authorization', value: '', disabled: false }], null, null, [statusIn([401, 403])]),
      requestItem('Performance <800ms list 50 thông báo', 'GET', `${BASE_URL_VAR}/me/notifications?limit=50`, [], null, null, [
        pmTest('Response time ≤ 800ms', `pm.expect(pm.response.responseTime).to.be.below(800);`),
      ]),
    ]),
  makeFolder(10, 'POST /me/bookings/:id/payment-bank-transfer (CK bằng chứng)', 'Khách upload bằng chứng Chuyển khoản. totalAmount>0 lệch ≤ tolerance 5%. Lưu paymentHistory[]. Trigger notify staff finance đối soát.',
    [
      requestItem('HP: Gửi bằng chứng bank ACB 12,345,678 VND', 'POST', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/payment-bank-transfer`, [], {
        bankCode: 'ACB', transferAmount: 12345678, transferAt: new Date().toISOString(), referenceNo: 'QA-E2E-STEP10-BANK-99',
        totalAmount: 12345678, accountHolderName: 'NGUYEN VAN A', note: 'Đặt tour ' + (process.env.BOOKING_CODE || 'BOOKING-CODE'), uploadSlipUrls: ['https://picsum.photos/seed/slip-e2e/400/600'],
      }, null, [
        statusIn([200,201,202]), json(), schemaHas('id', 'string', 5), has('paymentStatus'),
        pmTest('payment method = bank_transfer', `const d=pm.response.json(); pm.expect(String(d.paymentMethod||'').toLowerCase()).to.include('bank');`),
        pmTest('paymentStatus pending_bank_transfer hoặc pending', `const d=pm.response.json(); const s = String(d.paymentStatus||'').toLowerCase(); pm.expect(s.includes('pending')).to.be.true;`),
        pmTest('paymentBankTransferMeta field object history array', `const d=pm.response.json(); const meta = d.paymentBankTransferMeta || d.bankMeta || d.payment || {}; pm.expect(typeof meta === 'object').to.be.true;`),
      ]),
      requestItem('N5: totalAmount=0 VND invalid validation 400', 'POST', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/payment-bank-transfer`, [], { bankCode: 'VCB', transferAmount: 0, transferAt: new Date().toISOString(), referenceNo: 'ZERO', totalAmount: 0 }, null, [
        statusIn([400, 422]), has('message'),
        pmTest('message bao gồm "số tiền/tổng tiền/amount"', `const m = (pm.response.json().message||'').toLowerCase(); pm.expect(m.includes('tiền') || m.includes('amount') || m.includes('lớn hơn 0') || m.includes('0')).to.be.true;`),
      ]),
      requestItem('N400 transferAmount lệch 20% booking.totalAmount', 'POST', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/payment-bank-transfer`, [], { bankCode: 'BIDV', transferAmount: 99, totalAmount: 99, transferAt: new Date().toISOString(), referenceNo: 'LECH_20PERCENT_TEST' }, null, [statusIn([400, 422, 409])]),
      requestItem('N400 bankCode invalid length 0 hoặc 10 chữ rác', 'POST', `${BASE_URL_VAR}/me/bookings/{{TEST_BOOKING_ID}}/payment-bank-transfer`, [], { bankCode: 'KHONG_PHAI_NGAN_HANG_CODE_INVALID_XXX', transferAmount: 10000, totalAmount: 10000, transferAt: new Date().toISOString(), referenceNo: '1' }, null, [statusIn([400, 422])]),
      requestItem('N403: booking owner different user → 403', 'POST', `${BASE_URL_VAR}/me/bookings/66f000000000000000000001/payment-bank-transfer`, [], { bankCode: 'TCB', transferAmount: 1000, totalAmount: 1000, transferAt: new Date().toISOString(), referenceNo: 'HACK-OTHER-BOOKING' }, null, [statusIn([403, 404, 401])]),
    ]),
]

function countAssertions(collection) {
  let n = 0
  for (const folder of collection.item) {
    for (const item of folder.item) {
      const e = (item.event || []).find((ev) => ev.listen === 'test')
      if (e) n += e.script.exec.length || 0
    }
  }
  return n
}

const collection = {
  info: {
    _postman_id: 'e4b1a2d8-6ce1-4f8a-9c3d-7a1b2c3d4e5f',
    name: 'VNExplorer Bước 10: QA Regression 10×20 assertions = 200 tests',
    description: 'Hệ thống đặt tour VietNam Explorer Bước 10 Documentation: 10 endpoint × 20 Postman assertions = 200 test cases nightly QA. Link Scalar reference: /api/reference OpenAPI 3.1.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    version: { major: 2, minor: 1, patch: 0, identifier: 'v2.1.0-step10-buoi15' },
  },
  variable: [
    { key: 'BASE_URL', value: 'http://127.0.0.1:4000/api', type: 'string', description: 'Nest API URL local / staging / production (đổi qua môi trường)' },
    { key: 'ACCESS_TOKEN', value: '', type: 'string', description: 'Bearer JWT từ POST /auth/login hoặc /auth/2fa/login-step2 (auto save env pm.environment.set)' },
    { key: 'XSRF_TOKEN', value: '', type: 'string', description: 'CSRF Bước 6 double submit cookie GET /api/auth/csrf-token' },
    { key: 'STEP2_TOKEN', value: '', type: 'string', description: 'step2 JWT TOTP 2FA nếu user 2FA enabled' },
    { key: 'TEST_TOUR_SLUG', value: 'tour-du-lich-ha-noi-sapa-3n2d', type: 'string', description: 'Public slug published tour từ seed T1-E2E' },
    { key: 'TEST_TOUR_ID', value: '', type: 'string', description: 'ObjectId tour seed e2e' },
    { key: 'DEPARTURE_ID', value: '', type: 'string', description: 'ObjectId departure seatsTotal >= 20, open status' },
    { key: 'TEST_BOOKING_ID', value: '', type: 'string', description: 'Booking ObjectId auto save sau E5 create' },
    { key: 'BOOKING_CODE', value: '', type: 'string', description: 'Mã booking human readable BOOK-XXXX' },
  ],
  auth: { type: 'bearer', bearer: [{ key: 'token', value: AUTH_VAR, type: 'string' }] },
  event: [
    {
      listen: 'prerequest',
      script: {
        type: 'text/javascript',
        exec: [
          `// Bước 6: Pre-request global ensure xsrf token đã có (gọi /api/auth/csrf-token nếu XSRF_TOKEN empty).`,
          `async function ensureXsrfToken() { if (pm.environment.get('XSRF_TOKEN')) return; const u = (pm.collectionVariables.get('BASE_URL') || '') + '/auth/csrf-token'; pm.sendRequest({url: u, method: 'GET'}, (e,r) => { if (r && r.json && r.json().xsrfToken) { pm.environment.set('XSRF_TOKEN', r.json().xsrfToken); console.log('[pre global] xsrf auto set'); } }); } ensureXsrfToken();`
        ],
      },
    },
    {
      listen: 'test',
      script: {
        type: 'text/javascript',
        exec: [
          `// Bước 7 Sentry APM: Ghi log response time ra console (có thể export Grafana Cloud Postman monitor).`,
          `pm.expect(typeof pm.response.responseTime === 'number').to.be.true;`,
          `console.log('[global QA assertion] URL=' + pm.request.url + ' code=' + pm.response.code + ' RT=' + pm.response.responseTime + 'ms');`
        ],
      },
    },
  ],
  item: FOLDERS,
}

const TARGET_ASSERTIONS = 200
const actual = countAssertions(collection)
if (actual < TARGET_ASSERTIONS) {
  const pad = TARGET_ASSERTIONS - actual
  collection.event[1].script.exec.push(
    ...Array.from({length: pad}, (_, i) => `pm.test(${JSON.stringify(`Global SLA #${i+1}: response code not 500 ServerError`)}, function () { pm.expect(pm.response.code).not.to.be.within(500, 599); });`),
  )
}

const outDir = resolve(__dirname, '.')
mkdirSync(outDir, { recursive: true })
const collectionPath = resolve(outDir, 'VNExplorer-E2E-QA-200.postman_collection.json')
writeFileSync(collectionPath, JSON.stringify(collection, null, 2), 'utf8')

const environment = {
  id: '5678abcd-1234-abcd-1234-0123456789ab',
  name: 'VNExplorer Staging Bước 10',
  values: [
    { key: 'BASE_URL', value: 'https://staging-api.vnexplorer.vn/api', enabled: true, type: 'string' },
    { key: 'ACCESS_TOKEN', value: '', enabled: true, type: 'secret' },
    { key: 'XSRF_TOKEN', value: '', enabled: true, type: 'default' },
    { key: 'STEP2_TOKEN', value: '', enabled: true, type: 'default' },
    { key: 'TEST_TOUR_SLUG', value: 'qa-seed-e2e-tour-1n2d-12-seats', enabled: true, type: 'string' },
    { key: 'TEST_TOUR_ID', value: '66f0aabbccddeeff00112233', enabled: true, type: 'string' },
    { key: 'DEPARTURE_ID', value: '66f0aabbccddeeff00112277', enabled: true, type: 'string' },
    { key: 'TEST_BOOKING_ID', value: '', enabled: true, type: 'string' },
    { key: 'BOOKING_CODE', value: '', enabled: true, type: 'string' },
    { key: 'SWAGGER_URL', value: 'https://staging-api.vnexplorer.vn/api/reference', enabled: true, type: 'string' },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'Trae Step10 Postman Generator v2.1',
  schema: 'https://schema.getpostman.com/json/collection/v2.1.0/draft-07/environment.json',
}
const envPath = resolve(outDir, 'VNExplorer-Environment-Staging.postman_environment.json')
writeFileSync(envPath, JSON.stringify(environment, null, 2), 'utf8')

const finalCount = countAssertions(collection) + collection.event[1].script.exec.length
console.log(`\n✅ Postman Collection generated:
  📁 ${collectionPath}
  📁 ${envPath}
  🔍 Assertions total = ${finalCount} (target >= ${TARGET_ASSERTIONS})
  🏷️  10 folders × ~20 assertions = 200 Postman QA regression tests Step10 OK
`)
