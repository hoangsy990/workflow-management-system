# WorkFlow Management System

Hệ thống web quản lý công việc và quy trình phê duyệt nội bộ doanh nghiệp. Giao diện tiếng Việt, backend API dùng chung cho web, Windows, Android và iOS.

## Theo dõi tiến độ

Checklist triển khai đầy đủ nằm tại [`CHECKLIST.md`](CHECKLIST.md). Sau mỗi lần sửa code, tài liệu, migration, seed, Docker hoặc UI, checklist phải được cập nhật trong cùng commit với trạng thái `DONE`, `PARTIAL`, `TODO`, `WAITING` hoặc `BLOCKED`.

## Công nghệ

- Backend: Fastify, TypeScript, Prisma, PostgreSQL.
- Web: React, Vite, TypeScript.
- Desktop/mobile shell: Tauri v2 dùng cùng frontend và cùng API.
- Auth: JWT access token + refresh token, RBAC kiểm tra ở backend.
- API docs: `http://localhost:4000/docs`.
- Health-check: `http://localhost:4000/health`.
- Public web test port: `http://localhost:8099` với reverse proxy `/api/v1` tới API container.

## Tài khoản demo

Chỉ dùng cho môi trường development sau khi chạy seed:

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Admin | `admin@workflow.local` | `Admin@123456` |
| Quản lý | `manager@workflow.local` | `Manager@123456` |
| Nhân viên | `lan@workflow.local` | `Demo@123456` |

## Chạy bằng Docker Compose

```bash
cp .env.example .env
pnpm install
pnpm db:generate
docker compose up --build
```

Web chạy tại `http://localhost:8099`, API tại `http://localhost:4000`.

Nếu Docker Desktop đã mở nhưng terminal báo `docker` không tồn tại, hãy kiểm tra Docker CLI đã được thêm vào PATH. Trên Windows, thư mục thường gặp là:

```powershell
C:\Users\<user>\AppData\Local\Programs\DockerDesktop\resources\bin
C:\Program Files\Docker\Docker\resources\bin
```

Sau khi sửa PATH, mở lại terminal rồi chạy `docker --version`.

### Dọn dung lượng Docker

Nếu Docker Desktop báo dung lượng lớn sau nhiều lần build, phần phình ra thường là build cache. Lệnh dưới chỉ dọn cache build, không xóa database volume hoặc thư mục upload đang dùng:

```bash
pnpm docker:clean
```

Lần verify gần nhất: Docker CLI sau cleanup còn images `1.127GB`, volumes `87.92MB`, build cache `0B`. Nếu Windows vẫn báo `docker_data.vhdx` khoảng `19GB`, cần chạy lệnh compact bên dưới trong PowerShell Administrator để co file vật lý.

Trên Windows, nếu công cụ đo ổ đĩa vẫn thấy `C:\Users\<user>\AppData\Local\Docker\wsl\disk\docker_data.vhdx` rất lớn sau khi dọn cache, đó là file ổ đĩa ảo WSL chưa tự co lại. Hãy mở PowerShell bằng quyền Administrator rồi chạy:

```powershell
pnpm docker:compact
```

Lệnh này dừng Docker/WSL tạm thời, compact file VHDX bằng `diskpart`, rồi bật lại Docker Compose. Dữ liệu database và upload vẫn nằm trong Docker volume, không bị xóa.

Nếu muốn xóa thêm image không còn container nào dùng:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/clean-docker.ps1 -IncludeUnusedImages
```

Nếu cần seed trong container API:

```bash
pnpm docker:seed
```

## Chạy development không dùng Docker

Yêu cầu Node.js 24+, pnpm 11+, PostgreSQL 16+.

```bash
cp .env.example .env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

API: `http://localhost:4000`. Web: `http://localhost:5173`.

## Biến môi trường đáng chú ý

- `API_RATE_LIMIT_MAX`: giới hạn request API chung mỗi phút, mặc định `600`. Route đăng nhập vẫn có giới hạn riêng thấp hơn để chống dò mật khẩu.
- `MAX_UPLOAD_MB`: trần dung lượng tối đa mỗi tệp upload ở tầng hạ tầng; quản trị viên có thể cấu hình giới hạn thực tế và MIME type trong trang Cấu hình > Tệp upload.
- `ACCESS_TOKEN_TTL` và `REFRESH_TOKEN_TTL_DAYS`: thời gian sống access token và refresh token.

## Nhập người dùng

Trang `Người dùng` hỗ trợ nhập tài khoản từ CSV qua API `/api/v1/users/import`. Gọi với `apply=false` để xem trước, nhận lỗi theo từng dòng và không ghi database; gọi lại với `apply=true` để backend kiểm tra lại toàn bộ rồi tạo tài khoản trong transaction, hash mật khẩu và ghi audit `user.import`.

Header CSV khuyến nghị:

```csv
employeeCode,fullName,email,phone,title,departmentCode,managerEmployeeCode,roleCodes,teamCodes,password
```

`roleCodes` và `teamCodes` nhận nhiều mã bằng dấu `;` hoặc `,` trong cùng ô. Nếu bỏ trống `password`, môi trường development dùng mặc định `Demo@123456`. Phiên bản hiện tại hỗ trợ CSV; import trực tiếp `.xlsx` còn ở trạng thái pending để bổ sung parser riêng mà không làm tăng Docker image khi chưa cần.

## Form builder quy trình

Màn `Tạo mẫu quy trình` hỗ trợ metadata versioned cho từng field: tab, section, độ rộng 1/2 cột, điều kiện hiển thị `visibleWhen`, công thức tính an toàn cho trường số/tiền (`SUM`, `DIFFERENCE`, `PRODUCT`, `RATIO`) và cấu hình cột cho field `TABLE`.

Khi tạo hồ sơ, web render form theo tab/section responsive, tự ẩn/hiện field theo dữ liệu đang nhập và khóa field calculated. Backend cũng áp calculated values và bỏ validation field đang bị ẩn, nên quy tắc không chỉ nằm ở giao diện. Repeating table editor nhiều dòng và nguồn select từ danh mục tùy chỉnh vẫn đang ở trạng thái phát triển tiếp.

Danh mục tùy chỉnh dùng chung có schema/API nền tảng qua `/api/v1/shared-catalogs` và `/api/v1/shared-catalogs/:idOrCode/options`. Mỗi catalog có `fields`, `status`, `scopeDepartmentId`, `managerId` và item values JSON. Trang `Danh mục` có UI tạo/sửa/xóa catalog và item, picker phạm vi phòng ban/người quản lý, search và export CSV dữ liệu đang lọc. Seed development có catalog `REQUEST_TYPES`; workflow SELECT/RADIO có thể lưu nguồn này trong `validation.catalogSource`, và runtime form sẽ tải options theo catalog code để render dropdown/radio.

## Báo cáo và export

Trang `Báo cáo` lấy số liệu thật từ API `/api/v1/reports/summary`, hỗ trợ lọc phía server theo phòng ban, trạng thái công việc, ưu tiên, trạng thái hồ sơ và khoảng ngày. Các biểu đồ có drill-down qua `/api/v1/reports/drilldown`.

Export hiện có:

- CSV: `/api/v1/reports/export.csv`
- Excel `.xlsx`: `/api/v1/reports/export.xlsx`
- PDF native: `/api/v1/reports/export.pdf`
- In từ trình duyệt: nút `In` trên trang báo cáo.

Tất cả export dùng cùng filter và scope quyền backend, đồng thời ghi audit log `report.export.*`. PDF được tạo bằng generator nội bộ text-only để không tăng dependency/Docker image; CSV/XLSX vẫn giữ dữ liệu Unicode đầy đủ cho xử lý nghiệp vụ.

## Build production

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Database

- Prisma schema: `apps/api/prisma/schema.prisma`
- Migration: `apps/api/prisma/migrations/0001_init/migration.sql`
- Seed: `apps/api/prisma/seed.ts`

Deploy migration:

```bash
pnpm --filter @workflow/api prisma:migrate:deploy
```

Backup PostgreSQL:

```bash
pg_dump "$DATABASE_URL" > backups/workflow_$(date +%Y%m%d_%H%M%S).sql
```

Backup upload:

```bash
tar -czf backups/uploads_$(date +%Y%m%d_%H%M%S).tar.gz uploads
```

## Build đa nền tảng

Web production:

```bash
pnpm --filter @workflow/web build
```

Windows desktop:

```bash
pnpm --filter @workflow/web desktop:build
```

Android APK/AAB kiểm thử hoặc phát hành:

```bash
pnpm --filter @workflow/web android:build
```

Trên Windows, nếu Tauri Android build bị chặn ở bước tạo symbolic link, dùng script đã kiểm chứng để build APK arm64 kiểm thử:

```bash
pnpm android:build:arm64
```

Artifact sinh ra tại:

```text
apps/web/src-tauri/gen/android/app/build/outputs/apk/arm64/release/app-arm64-release-unsigned.apk
```

Script này tự set `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `NDK_HOME` theo cài đặt Android Studio mặc định trên Windows. Nếu muốn dùng Tauri build chuẩn cho mọi ABI/AAB, hãy bật Windows Developer Mode để cho phép tạo symbolic link, rồi chạy lại `pnpm --filter @workflow/web android:build`.

Có thể build APK test với API public qua port `8099`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-android-arm64.ps1 -ApiUrl "http://<public-host>:8099/api/v1"
```

Bản APK arm64 unsigned dùng cho test nội bộ cho phép HTTP cleartext để test qua `8099`. Khi phát hành production phải dùng HTTPS và tắt cleartext.

iOS development/TestFlight/App Store cần macOS, Xcode và chứng chỉ Apple:

```bash
pnpm --filter @workflow/web ios:build
```

Trên Windows, Tauri CLI không chạy subcommand iOS; hãy chạy lệnh iOS trên máy macOS có Xcode.

Không commit khóa ký Android, chứng chỉ iOS, FCM/APNs secret hoặc update signing key. Đổi địa chỉ API bằng `apps/web/.env.*`.

## Push notification

Backend có `device_tokens` và notification center. Các adapter FCM/APNs/Desktop được cấu hình bằng biến môi trường:

- `FCM_PROJECT_ID`
- `APNS_BUNDLE_ID`
- `TAURI_UPDATE_ENDPOINT`

Các sự kiện task/workflow đã ghi notification nội bộ; adapter push có thể triển khai thêm mà không đổi nghiệp vụ.

## Chế độ mạng yếu

Frontend hiển thị trạng thái online/offline. Form tạo công việc lưu draft tạm trên thiết bị. Các thao tác phê duyệt dùng `idempotencyKey` để chống ghi nhận trùng; client không tự retry approval khi mất mạng.

## Secure session storage native

Web development vẫn fallback về `sessionStorage`. Khi chạy trong Windows/Android/iOS shell, native layer có thể cung cấp bridge sau để API client lưu access/refresh token qua vùng an toàn của hệ điều hành:

```ts
window.__WORKFLOW_SECURE_SESSION__ = {
  get: async () => stringOrNull,
  set: async (value) => {},
  remove: async () => {}
};
```

Bridge này được đọc bởi `apps/web/src/api/session-storage.ts`; nghiệp vụ đăng nhập, refresh token và logout không phụ thuộc vào riêng web storage.

## Kiểm thử đã chạy

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @workflow/web exec playwright install chromium
pnpm smoke:web
DATABASE_URL=postgresql://workflow:workflow@localhost:5432/workflow_management?schema=public pnpm db:validate
```

`pnpm smoke:web` chạy Playwright trên web `http://localhost:8099` và API `http://localhost:4000/api/v1`, vì vậy hãy chạy `docker compose up -d --build` trước. Docker Compose đã được kiểm tra với API, web và PostgreSQL. Lần verify gần nhất pass `43/43` smoke cases, gồm CRUD shared catalog/item với scope/search/export và report CSV/XLSX/PDF export audit. Trạng thái hiện tại được ghi lại trong [`CHECKLIST.md`](CHECKLIST.md).

## CI GitHub Actions

Pipeline `.github/workflows/ci.yml` chạy trên `push` và `pull_request`:

- `verify`: cài dependencies, Prisma generate, lint, type-check, unit tests và build.
- `smoke-web`: build Docker Compose, seed database demo, chờ web/API sẵn sàng và chạy `pnpm smoke:web`.

Khi smoke thất bại, CI upload `docker-compose.log`, `apps/web/test-results` và `apps/web/playwright-report` làm artifact để debug.
