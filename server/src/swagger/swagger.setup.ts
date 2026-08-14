import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { INestApplication } from '@nestjs/common'

export function isSwaggerUiEnabled(): boolean {
  const v = String(process.env.SWAGGER_ENABLED ?? process.env.NODE_ENV === 'development' ? '1' : '0').trim().toLowerCase()
  return v !== '0' && v !== 'false' && v !== 'no' && v !== 'off'
}

export function setupOpenApiAndSwagger(app: INestApplication & NestExpressApplication) {
  const enabled = isSwaggerUiEnabled()
  if (!enabled) return { enabled: false as const }

  const cfg = new DocumentBuilder()
    .setTitle('VietNam Explorer OpenAPI 3.1')
    .setDescription(
      'Hệ thống đặt tour Việt Nam Explorer - Bước 10 Swagger + Postman QA. Endpoints Booking, Tour Catalog, Auth 2FA TOTP, Notification, Payment Bank Transfer.',
    )
    .setContact('Engineering Team', 'https://vnexplorer.vn/engineering', 'engineering@vnexplorer.vn')
    .setLicense('VNExplorer Internal', 'https://vnexplorer.vn/licenses/internal')
    .setVersion('1.0.0-buoi15-step10')
    .setTermsOfService('https://vnexplorer.vn/terms')
    .addServer(
      String(process.env.SWAGGER_SERVER_URL ?? 'http://127.0.0.1:4000/api'),
      String(process.env.SWAGGER_SERVER_DESC ?? 'Dev local Nest 4000'),
    )
    .addTag('Auth', 'Xác thực 2 bước: đăng nhập step1 email password → step2 TOTP Google Authenticator')
    .addTag('Tours Public', 'Catalog tour công khai: danh sách published, tour detail, departure')
    .addTag('Bookings', 'Tạo đặt tour cho khách vãng lai (public) / customer đã đăng nhập')
    .addTag('My Bookings', 'Tài khoản khách hàng: xem đơn, hủy đơn, thanh toán bank transfer')
    .addTag('Admin/Staff Bookings', 'Nhân viên / Admin: cập nhật trạng thái WON tour group, hủy đơn, giao việc')
    .addTag('Notifications', 'Thông báo cho user: booking trạng thái, thanh toán, tin tức khuyến mãi')
    .addTag('Monitoring (Bước 7)', 'Health probes Kubernetes, Prometheus metrics')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
        description: 'JWT access token nhận từ POST /auth/login hoặc /auth/2fa/login-step2. Định dạng: Bearer <accessToken>',
      },
      'bearerJwt',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-XSRF-TOKEN',
        description:
          'CSRF double submit (Bước 6) cho mọi method non-GET: gọi GET /api/auth/csrf-token → lấy cookie x-xsrf-token + X-XSRF-TOKEN header trùng value.',
      },
      'xsrfToken',
    )
    .build()

  const doc = SwaggerModule.createDocument(app, cfg, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey: string, methodKey: string) =>
      `${controllerKey.replace(/Controller$/, '')}_${methodKey}`,
    ignoreGlobalPrefix: false,
  })

  SwaggerModule.setup('/api/swagger-ui', app, doc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VNExplorer Swagger UI',
    customfavIcon: '/uploads/favicon.png',
    swaggerOptions: {
      persistAuthorization: true,
      filter: true,
      tryItOutEnabled: process.env.NODE_ENV !== 'production',
      displayRequestDuration: true,
      showRequestHeaders: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
    },
  })

  ;(app as any).use(
    '/api/reference',
    apiReference({
      spec: { content: doc as any },
      theme: 'alternate',
      defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
      darkMode: true,
      hideSchemas: false,
      servers: cfg.servers?.map((s) => ({ url: s.url, description: s.description ?? '' })) ?? [],
      metadata: {
        title: 'VNExplorer Scalar API Reference',
        description: 'OpenAPI 3.1 Scalar docs cho QA team viết Postman collection 200 assertions.',
        ogTitle: 'VNExplorer OpenAPI Reference',
        ogImage: String(process.env.SWAGGER_OG_IMG ?? 'https://vnexplorer.vn/og/reference.png'),
      },
    }) as any,
  )

  return { enabled: true as const, paths: ['/api/swagger-ui', '/api/reference', '/api/swagger-ui/json'] }
}
