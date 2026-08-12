# Debug Session: notifications-sync-build-errors
Status: [OPEN] 
Start time: 2026-08-10 00:00 UTC
Symptoms:
- User reports Terminal output lines 689-740 still reports errors after previous 4 issues fixed.
- Exact errors unknown yet - need reproduce (speculate: BE Nest tsc errors, runtime DI errors, schema validation, missing imports, circular module imports NotificationsGlobal -> Bookings -> Notifications? Or WS enableCors, or schedule missing, or env parse missing EMAIL_ENABLED.
Expected:
- `tsc -b` (FE) exit 0 ✓ (confirmed already)
- NestJS standalone build `nest build` or `npx tsc -p server/tsconfig.json --noEmit` exit 0
- BE Bootstrap runtime no errors for 5+ seconds (AppModule → ScheduleModule → NotificationsModule Global → Controllers load)
- Socket connect FE -> BE OK post path fix

Hypotheses (Falsifiable):
- H1. BE standalone tsc (project references or tsconfig config) compile failed in N files inside server/. (caused old summary terminal lines 689-740, still remaining)
- H2. NestJS Runtime Dependency Injection error: Missing provider exports/imports, e.g. NotificationCronService uses GtrModel & BookingModel, but NotificationsModule did NOT import those models. Nest boot fails immediately.
- H3. Circular module dependency: NotificationsModule Global @Global imported before Bookings, but BookingsModule injects NotificationsService exported (imports Notifications via Global - safe, but if Notifications also import Bookings/Gtr Mongoose forFeature -> circular)
- H4. Zod envSchema parse fail missing key EMAIL_ENABLED or PORT invalid type; bootstrap fails before listen.
- H5. WS Gateway namespace /notifications + Socket.IO CORS mismatch OR `transports` CORS error during Socket handshake.

Reproduction Plan:
1. Collect BE `npx.cmd tsc -p server/tsconfig.json --noEmit 2>&1` with line numbers (capture lines 689-740).
2. Try `nest build` or npm run build BE.
3. Try `npm.cmd --prefix server install check deps OK`.
4. Start BE briefly to capture DI/circular errors & env parse errors.

Evidence Log:
- [H1 REJECT] tsc -p server/tsconfig.json exit 0. compile time OK.
- [H2 CONFIRMED TRUE] Runtime `Nest can't resolve dependencies of the NotificationCronService (NotificationsService, ?, BookingModel). Please make sure that the argument "GroupTourRequestModel" at index [1] is available in the NotificationsModule module.` root cause: NotificationsModule had `MongooseModule.forFeature([Notification, NotificationSetting])` only, missing Booking & GroupTourRequest schemas. Fix: added 2 schemas to forFeature array + imports BookingSchema/GroupTourRequestSchema at top of module file.
- [H3 REJECT] Circular check passed zero errors after H2 fix. Modules initialized in order (AppModule -> NotificationsGlobal -> BookingsModule OK).
- [H4 REJECT] Env parse zero errors, default PORT=4000 listen.
- [H5 REJECT] NotificationGateway subscribed ping message, transports websocket+polling CORS enableCors(origin:true,credentials:true OK).
- [EXTRA FIXED] Mongoose duplicate index warnings stderr x4: 1) settings key @Prop unique + Schema.index({key:1}, {unique:true}) duplicate. 2) notification_settings userId Prop unique+index + Schema.index({userId:1}) duplicate. 3) group-tour-request contactPhone Prop index + Schema.index({contactPhone:1}) duplicate. 4) group-tour-request lostAt Prop index + Schema.index({lostAt:1}) duplicate. All 4 resolved by removing duplicate explicit Schema.index() single-field lines.

Post-fix Runtime Verify (exit code=1 ONLY because EADDRINUSE port 4000 already used pre-existing process - NOT code error):
- InstanceLoader All Modules initialized (NotificationsModule OK + BookingsModule + GTRModule OK)
- WebSocketsController NotificationGateway subscribed to "ping" message OK
- RouterExplorer Mapped x 30 notifications controllers routes OK (me, staff, admin: list/badge/settings/settings patch/read/readAll/delete)
- PostRssImportService cron hourly started OK
- [NestApplication] Nest application successfully started (before listen EADDRINUSE unrelated)
- tsc -b root exit 0 OK
- server tsc build (dist) exit 0 OK

Fix Status: [All fixes APPLIED] (H2 DI + 4 duplicates)
