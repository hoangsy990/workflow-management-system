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

Web chạy tại `http://localhost:8080`, API tại `http://localhost:4000`.

Nếu Docker Desktop đã mở nhưng terminal báo `docker` không tồn tại, hãy kiểm tra Docker CLI đã được thêm vào PATH. Trên Windows, thư mục thường gặp là:

```powershell
C:\Users\<user>\AppData\Local\Programs\DockerDesktop\resources\bin
C:\Program Files\Docker\Docker\resources\bin
```

Sau khi sửa PATH, mở lại terminal rồi chạy `docker --version`.

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

`pnpm smoke:web` chạy Playwright trên web `http://localhost:8080` và API `http://localhost:4000/api/v1`, vì vậy hãy chạy `docker compose up -d --build` trước. Docker Compose đã được kiểm tra với API, web và PostgreSQL. Trạng thái hiện tại được ghi lại trong [`CHECKLIST.md`](CHECKLIST.md).
