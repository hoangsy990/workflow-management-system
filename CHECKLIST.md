# WorkFlow Management System - Checklist triển khai

File này là nguồn theo dõi trạng thái chính của dự án. Sau mỗi lần sửa code, tài liệu, migration, seed, Docker hoặc UI, phải cập nhật file này trong cùng commit.

## Quy ước trạng thái

- [x] `DONE`: đã triển khai, đã kiểm tra, không còn việc bắt buộc ngay trong phạm vi hiện tại.
- [ ] `PARTIAL`: đã có một phần chạy được, còn thiếu chức năng/QA/test/tài liệu.
- [ ] `TODO`: chưa triển khai.
- [ ] `WAITING`: chờ môi trường, tài khoản, chứng chỉ, thiết bị hoặc quyết định triển khai.
- [ ] `BLOCKED`: đang bị chặn bởi lỗi hoặc thiếu điều kiện không thể tự xử lý.

## Cập nhật gần nhất

**Tiến độ hiện tại:** `DONE=130`, `PARTIAL=116`, `TODO=14`, `WAITING=0`, `BLOCKED=0`, `TOTAL=260`; hoàn thành nghiêm ngặt `50.0%`, tính trọng số partial `72.3%`.

| Ngày | Commit | Nội dung | Kiểm tra |
| --- | --- | --- | --- |
| 01/08/2026 | `REPORT-XLSX-EXPORT` | Bổ sung export Excel `.xlsx` cho báo cáo qua API `/reports/export.xlsx` bằng generator XLSX tối giản nội bộ, không thêm dependency để không tăng size Docker; UI có nút `Tải Excel`, smoke kiểm download và audit `report.export.xlsx`. Checklist export giữ PARTIAL vì PDF native chưa có. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, targeted report smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 42/42, `docker builder prune -af`; Docker images `1.124GB`, volumes `84.9MB`, build cache `0B`. |
| 01/08/2026 | `REPORT-CSV-EXPORT` | Bổ sung export CSV cho báo cáo qua API `/reports/export.csv`, áp scope quyền/filter server-side, ghi audit `report.export.csv` với metadata số dòng và filter; UI có nút `Tải CSV`, trạng thái loading/success/error và nút `In` với CSS print tối thiểu. Chuyển checklist `Export Excel/CSV/PDF/print theo quyền + audit` sang PARTIAL vì CSV/print/audit đã có, Excel/PDF native chưa có. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, targeted report smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 42/42, `docker builder prune -af`; Docker images `1.124GB`, volumes `84.52MB`, build cache `0B`. |
| 01/08/2026 | `REPORT-DRILLDOWN` | Bổ sung endpoint `/reports/drilldown` có pagination và scope quyền backend để xem chi tiết theo bucket chart; trang `Báo cáo` biến các dòng chart task/workflow thành nút drill-down, hiển thị bảng chi tiết và mở đúng công việc/hồ sơ. Chuyển checklist `Drill-down` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, targeted report smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 42/42, `docker builder prune -af`; Docker images `1.124GB`, volumes `84.19MB`, build cache `0B`. |
| 01/08/2026 | `REPORT-SERVER-FILTERS` | Bổ sung module API `/reports/summary` áp scope quyền backend cho công việc/hồ sơ quy trình, hỗ trợ lọc server-side theo phòng ban, trạng thái công việc, ưu tiên, trạng thái hồ sơ và khoảng ngày; thêm trang `Báo cáo` lazy-load với chart/tổng quan/bảng gần nhất từ DB thật. Chuyển checklist `Bộ lọc báo cáo` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, targeted report smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 42/42, `docker builder prune -af`; Docker images `1.124GB`, volumes `83.95MB`, build cache `0B`. |
| 01/08/2026 | `MOBILE-SWIPE-ACTIONS` | Bổ sung action rail dạng swipe cho mobile cards của `DataTable`, TaskList có nút nhanh `Mở`/`Bắt đầu`/`Tiếp tục` riêng trên mobile và ẩn cột thao tác khỏi card để không lặp nội dung. Chuyển checklist `Swipe actions` sang DONE. | `pnpm --filter @workflow/web lint`, `docker compose up -d --build web`, targeted mobile filter smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 41/41, `docker builder prune -af`; Docker images `1.124GB`, volumes `83.65MB`, build cache `0B`. |
| 01/08/2026 | `WORKFLOW-SETTINGS-PANEL` | Bổ sung seed và panel `Cấu hình quy trình` trong Settings cho auto activate template, SLA mặc định, đơn vị SLA, nhắc trước hạn, approval mode và completion rule mặc định; workflow builder đọc settings để áp cho bước đầu/bước mới và payload template. Chuyển checklist `Cấu hình quy trình` sang DONE, `Ngày làm việc/ngày nghỉ/SLA` sang PARTIAL. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, `pnpm docker:seed`, query PostgreSQL xác nhận `6` workflow settings, targeted workflow settings smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 41/41, `docker builder prune -af`; Docker images `1.124GB`, volumes `83.39MB`, build cache `0B`. |
| 01/08/2026 | `WORKFLOW-PREVIEW-DEVICES` | Bổ sung chế độ preview PC/Mobile trong workflow builder bằng segmented control có icon, class trạng thái desktop/mobile và khung preview mobile 390px để kiểm tra form/flow trên màn nhỏ trước khi lưu. Chuyển checklist `Preview PC/mobile` sang DONE. | `pnpm --filter @workflow/web lint`, `docker compose up -d --build web`, targeted builder smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 40/40, `docker builder prune -af`; Docker images `1.124GB`, volumes `83.14MB`, build cache `0B`. |
| 01/08/2026 | `WORKFLOW-BUILDER-PREVIEW` | Bổ sung preview quy trình ngay trong màn tạo mẫu: xem trước thông tin mẫu, biểu mẫu nhập liệu, default/validation/options, bước xử lý, resolver, rule hoàn thành, SLA và điều kiện chuyển bước trước khi lưu. Chuyển checklist `Preview quy trình` sang DONE. | `pnpm --filter @workflow/web lint`, `docker compose up -d --build web`, targeted builder smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 40/40, `docker builder prune -af`; Docker images `1.124GB`, volumes `82.84MB`, build cache `0B`. |
| 01/08/2026 | `WORKFLOW-PROGRESS-MAP` | Bổ sung sơ đồ theo dõi quy trình trong chi tiết hồ sơ: API detail trả thêm steps/transitions của phiên bản, UI gom runtime step/approvals để hiện bước đã xong, đang xử lý, cần chú ý, người đang chờ và nhánh chuyển tiếp/điều kiện. Chuyển checklist `Sơ đồ theo dõi quy trình` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, targeted workflow approve smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 40/40, `docker builder prune -af`; Docker images `1.124GB`, volumes `82.54MB`, build cache `0B`. |
| 01/08/2026 | `OPS-SETTINGS-PANELS` | Bổ sung seed mặc định và panel Cấu hình vận hành cho thông báo in-app/push/email, SMTP, bảo mật đăng nhập và backup; toàn bộ lưu vào `system_settings`, kế thừa audit metadata/redaction hiện có và có smoke test lưu UI rồi đọc lại API thật. Chuyển checklist `Cấu hình thông báo/email/bảo mật/backup` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, `pnpm docker:seed`, query PostgreSQL xác nhận `13` setting vận hành, targeted settings smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 40/40, `docker builder prune -af`; Docker images `1.124GB`, volumes `82.29MB`, build cache `0B`. |
| 01/08/2026 | `ORG-CHART-DEPARTMENTS` | Bổ sung panel `Sơ đồ tổ chức` trong trang Phòng ban, dựng tree/list từ dữ liệu thật `/departments`, `/users`, `/teams`, hiển thị cấp cha-con, quản lý, nhân sự, nhóm và số công việc; click node chọn đúng phòng ban để chỉnh sửa. Chuyển checklist `Sơ đồ tổ chức tree/org/list` sang DONE. | `pnpm --filter @workflow/web lint`, `docker compose up -d --build web`, targeted department smoke 1/1, `pnpm test`, `pnpm build`, `pnpm smoke:web` 39/39, `docker builder prune -af`; Docker images `1.124GB`, volumes `81.97MB`, build cache `0B`. |
| 01/08/2026 | `SEED-WORKFLOW-PARALLEL-STRESS` | Bổ sung seed idempotent workflow `STRESS_PARALLEL` có bước phê duyệt song song `PARALLEL`, rule `MIN_COUNT=2`, 3 người duyệt pending cùng lúc và hồ sơ mẫu `IN_PROGRESS`; kết hợp với seed >100 user, task tên dài/nhiều assignee/tag/comment/quá hạn và task cha-con trước đó để hoàn tất bộ seed stress UI. Chuyển checklist `Demo UI nâng cao >100 records, long names, nhiều comment/subtask/parallel workflow` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/api build`, `docker compose up -d --build api`, `pnpm docker:seed`, query PostgreSQL xác nhận `STRESS_PARALLEL` active `PARALLEL/MIN_COUNT=2` và hồ sơ có `3` pending approvals, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm smoke:web` 39/39, `docker builder prune -af`; Docker images `1.124GB`, volumes `81.75MB`, build cache `0B`. |
| 01/08/2026 | `DASHBOARD-CHART-FILTERS` | Bổ sung bộ lọc dashboard theo phòng ban/khoảng ngày chạy phía server trên API `/dashboard`, áp cùng scope quyền backend cho card/count/groupBy/task cần chú ý; UI có panel lọc, reset, biểu đồ thanh tỷ lệ cho thống kê trạng thái/phòng ban và smoke test lọc dashboard bằng dữ liệu thật. Chuyển checklist `Biểu đồ và bộ lọc` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build api web`, targeted dashboard smoke 1/1, `pnpm smoke:web` 39/39, `docker builder prune -af`; Docker images `1.124GB`, volumes `81.47MB`, build cache `0B`. |
| 01/08/2026 | `TASK-SETTINGS-PANEL` | Bổ sung panel `Cấu hình công việc` trong trang Cấu hình cho setting `task.redo.reset_progress`, dùng checkbox/tải/lưu riêng thay vì key-value thô; smoke redo-reset bật setting qua UI panel mới rồi restore bằng API. Chuyển checklist `Cấu hình công việc` sang DONE. | `pnpm --filter @workflow/web lint`, `pnpm build`, `pnpm test`, `docker compose up -d --build web`, `pnpm smoke:web` 39/39, `docker builder prune -af`; Docker images `1.124GB`, volumes `81.25MB`, build cache `0B`. |
| 01/08/2026 | `TASK-ADVANCED-FILTER-CHECKLIST` | Rà soát lại trạng thái checklist cho `Bộ lọc nâng cao`: backend `/tasks` và UI đã có keyword, code, status, creator, assignee, manager, department, priority, date range, overdue, category, tag, sort, reset và mobile filter sheet; smoke đã phủ filter server-side. Chuyển checklist stale `Bộ lọc nâng cao` sang DONE. | Đối chiếu `task.routes.ts`, `tasks.tsx`, smoke `lọc công việc phía server trên UI`; `pnpm smoke:web` 39/39 đã pass ở chunk trước cùng trạng thái code. |
| 01/08/2026 | `SEED-USER-STRESS` | Bổ sung seed idempotent 3 phòng ban nhiều cấp (`STRESS-L1/L2/L3`) và 105 user stress role employee, trong đó có user tên/chức danh rất dài, đặt `createdAt` năm 2020 để không chen lên đầu danh sách mặc định. Chuyển checklist `User tên dài, phòng ban nhiều cấp, >100 records` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm build`, `docker compose up -d --build api`, `pnpm docker:seed`, query PostgreSQL xác nhận `stress_users=105`, `longest_name=108`, `stress_departments=3`, `leaf_parent_ok=1`, `pnpm lint`, `pnpm test`, `pnpm smoke:web` 39/39, `docker builder prune -af`; Docker images `1.124GB`, volumes `81.09MB`, build cache `0B`. |
| 01/08/2026 | `SEED-TASK-STRESS` | Bổ sung seed idempotent cho task stress có tên dài, 4 assignee, 3 tag, trạng thái quá hạn, progress 20 và 8 comment/reply/mention để QA list/card/detail mobile và layout nội dung dài. Chuyển checklist `Task tên dài, nhiều assignee, nhiều tags, quá hạn, nhiều comment` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm build`, `docker compose up -d --build api`, `pnpm docker:seed`, query PostgreSQL xác nhận `assignees=4`, `tags=3`, `comments=8`, `overdue=t`, `pnpm lint`, `pnpm test`, `docker builder prune -af`; Docker images `1.124GB`, volumes `80.77MB`, build cache `0B`. |
| 01/08/2026 | `SEED-TASK-SUBTASKS` | Bổ sung seed idempotent cho dữ liệu demo task cha/con: một task cha bật tự tính tiến độ và hai task con có progress 50/100 để parent tự ra 75%. Chuyển checklist `Task con` trong seed stress sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm build`, `docker compose up -d --build api`, `pnpm docker:seed`, query PostgreSQL xác nhận parent progress `75` và `child_count=2`, `pnpm lint`, `pnpm test`, `docker builder prune -af`; Docker images `1.124GB`, volumes `80.74MB`, build cache `0B`. |
| 01/08/2026 | `UPLOAD-FILE-SETTINGS` | Chuyển cấu hình upload task/workflow sang đọc `system_settings` (`file.upload.max_mb`, `file.upload.allowed_mime_types`), thêm API `/upload-config`, seed default, cache invalidation khi lưu setting, panel `Tệp upload` trong trang Cấu hình và task upload UI dùng `accept`/validate từ API. Chuyển checklist `Cấu hình tệp` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, smoke web 39/39 gồm test cấu hình upload mới, `pnpm lint`, `pnpm test`, `pnpm build`, `docker builder prune -af`; Docker images `1.124GB`, volumes `80.69MB`, build cache `0B`. |
| 01/08/2026 | `AUTO-CODE-SETTINGS` | Chuyển generator mã task/workflow instance sang đọc `system_settings` (`auto_code.task.prefix`, `auto_code.task.padding`, `auto_code.workflow_instance.prefix`, `auto_code.workflow_instance.padding`), seed default, thêm panel `Mã tự động` ở trang Cấu hình và smoke test chỉnh prefix/padding rồi tạo task/hồ sơ thật. Chuyển checklist `Mã tự động` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `docker compose up -d --build api web`, targeted auto-code smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm smoke:web` 38/38, `docker builder prune -af`; Docker images `1.124GB`, volumes `80.5MB`, build cache `0B`. |
| 01/08/2026 | `TASK-CATALOG-MANAGEMENT` | Bổ sung quản lý danh mục/nhãn công việc: migration soft delete cho `task_categories`/`tags`, CRUD API có RBAC `task.update_any`, validation, audit log, cache invalidation frontend và trang `Danh mục` trong sidebar để tạo/sửa/xóa danh mục/nhãn. Chuyển checklist `Task categories/tags` sang DONE. | `pnpm --filter @workflow/api prisma:generate`, `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, `prisma migrate deploy`, targeted catalog smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build api web`, `pnpm smoke:web` 37/37, `docker builder prune -af`; Docker images `1.124GB`, volumes `80.24MB`, build cache `0B`. |
| 01/08/2026 | `MOBILE-FILTER-SHEET` | Chuyển bộ lọc công việc trên mobile thành bottom sheet có backdrop, nút đóng, nút áp dụng, khóa cuộn nền, đóng bằng Escape, `role=dialog` và bộ đếm filter đang bật; desktop vẫn giữ panel inline. Chuyển checklist `Mobile filter bottom sheet/fullscreen/drawer` sang DONE. | `pnpm --filter @workflow/web lint`, targeted mobile filter smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build api web`, `pnpm smoke:web` 36/36, `docker builder prune -af`; Docker images `1.124GB`, volumes `79.96MB`, build cache `0B`. |
| 01/08/2026 | `GLOBAL-HEADER-SEARCH` | Bổ sung API `/api/v1/search` dùng chung cho web/PC/mobile, tìm công việc và hồ sơ theo scope quyền backend, tìm người dùng khi có `user.read`; thêm ô tìm kiếm header responsive có debounce, dropdown nhóm Công việc/Hồ sơ/Người dùng và click mở đúng detail/page. Chuyển checklist `Header/account/notification/search` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, targeted global search smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build api web`, `pnpm smoke:web` 35/35, `docker builder prune -af`; Docker images `1.124GB`, volumes `79.56MB`, build cache `0B`. |
| 01/08/2026 | `OFFLINE-STATE-BANNER` | Bổ sung offline banner dùng chung trong app shell, hiển thị rõ trên desktop/mobile khi mất kết nối, dùng text + icon + `role=status` thay vì chỉ đổi màu sync pill; thêm smoke test bật/tắt offline mode của browser context. Chuyển checklist `Loading/empty/error/offline state` sang DONE. | `pnpm --filter @workflow/web lint`, targeted offline smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web`, `pnpm smoke:web` 34/34, `docker builder prune -af`; Docker images `1.124GB`, volumes `79.33MB`, build cache `0B`. |
| 01/08/2026 | `SETTINGS-AUDIT-METADATA` | Nâng audit log thay đổi cấu hình hệ thống: route `/system-settings` chạy trong transaction, ghi metadata key/operation/previousValue/nextValue/description trước-sau, tự redact value khi key nhạy cảm dạng password/token/secret/credential/api key và bổ sung smoke API kiểm metadata + không lộ secret trong log. Chuyển checklist `Audit config changes` sang DONE. | `pnpm --filter @workflow/api lint`, `pnpm --filter @workflow/web lint`, targeted settings audit smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build api web`, `pnpm smoke:web` 33/33, `docker builder prune -af`; Docker images `1.124GB`, volumes `79.01MB`, build cache `0B`. |
| 01/08/2026 | `MOBILE-BOTTOM-NAV-NOTIFICATIONS` | Bổ sung trang `Thông báo` riêng dùng API thật, hỗ trợ xem 50 thông báo gần nhất, đánh dấu đã đọc từng dòng/tất cả và mở đúng task/workflow từ link; đổi mobile bottom nav thành Tổng quan/Công việc/Tạo dạng FAB/Duyệt/Thông báo/Cá nhân, có unread badge và smoke test viewport mobile. Ổn định helper smoke mở hồ sơ workflow bằng heading detail để tránh strict-mode trùng table/mobile card. Chuyển checklist `Bottom navigation` sang DONE. | `pnpm --filter @workflow/web lint`, `pnpm --filter @workflow/web test`, targeted mobile bottom nav smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web`, targeted workflow return smoke 1/1, `pnpm smoke:web` 32/32, `docker builder prune -af`; Docker images `1.124GB`, volumes `78.79MB`, build cache `0B`. |
| 01/08/2026 | `SCREEN-READER-BASICS` | Bổ sung lớp accessibility cơ bản cho app shell: skip link tới nội dung chính, landmark/aria-label cho sidebar/nav/main/bottom nav, `aria-current` cho trang đang active, trạng thái kết nối dạng `role=status`, lỗi dạng `role=alert`, panel phiên đăng nhập dạng dialog và smoke test bằng role selectors. Chuyển checklist `Screen reader cơ bản` sang DONE. | `pnpm --filter @workflow/web lint`, `pnpm --filter @workflow/web test`, targeted accessibility smoke 1/1, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web`, targeted redo-reset smoke 1/1, `pnpm smoke:web` 31/31, `docker builder prune -af`; Docker images `1.124GB`, volumes `78.33MB`, build cache `0B`. |
| 01/08/2026 | `FRONTEND-LAZY-PAGES` | Chuyển các trang authenticated chính trong `App.tsx` sang `React.lazy`/`Suspense`, dùng skeleton loading chung làm fallback khi tải chunk để giảm tải bundle ban đầu mà vẫn giữ trải nghiệm loading nhất quán. Chuyển checklist `Lazy load tab` sang DONE. | `pnpm --filter @workflow/web lint`, `pnpm --filter @workflow/web test`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web`, `pnpm smoke:web` 30/30, `docker builder prune -af`; Docker images `1.124GB`, volumes `77.82MB`, build cache `0B`. |
| 01/08/2026 | `SKELETON-LOADING` | Nâng `LoadingBlock` dùng chung thành skeleton loading responsive có shimmer, `aria-busy`, nội dung screen-reader và layout card/list để các trang dashboard/task/workflow/admin/profile không chỉ hiện spinner rỗng khi tải dữ liệu. Chuyển checklist `Skeleton loading` sang DONE. | `pnpm --filter @workflow/web lint`, `pnpm --filter @workflow/web test`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web`, `pnpm smoke:web` 30/30, `docker builder prune -af`; Docker images `1.124GB`, volumes `77.65MB`, build cache `0B`. |
| 01/08/2026 | `REFERENCE-DATA-CACHE` | Thêm cache in-memory TTL ngắn cho dữ liệu nền frontend (`users`, `departments`, `teams`, `roles`, `permissions`, `taskCategories`, `tags`), tự clear khi đổi API URL, đổi/clear session hoặc mutate user/department/team/role; bổ sung test cache và invalidation. Chuyển checklist `Cache danh mục` sang DONE. | `pnpm --filter @workflow/web test`, `pnpm --filter @workflow/web lint`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web`, `pnpm smoke:web` 30/30, `docker builder prune -af`; Docker images `1.124GB`, volumes `77.36MB`, build cache `0B`. |
| 01/08/2026 | `DOCKER-SIZE-CLEANUP` | Dọn Docker build cache trên máy dev từ `14.22GB` xuống `0B`, tối ưu Dockerfile để image API chỉ mang dependency production của `@workflow/api`, giữ Prisma CLI trong dependency production cho migrate deploy, không gọi `pnpm` trong runtime, thêm `.dockerignore` cho cache/test artifacts, thêm script `pnpm docker:clean`/`pnpm docker:compact` và chỉnh Kanban lấy 100 task mới nhất theo `createdAt desc` đúng giới hạn API để không mất card mới khi DB tích lũy nhiều smoke data. Chuyển checklist `Docker resource cleanup command` sang DONE. | `pnpm install --lockfile-only`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, API/web health pass, targeted Kanban smoke 1/1, `pnpm smoke:web` 30/30, `docker builder prune -af`. Docker đang dùng: images `1.124GB`, volumes `77.05MB`, build cache `0B`, API writable `49.2kB`; file `docker_data.vhdx` còn `19.13GB` và cần `pnpm docker:compact` trong PowerShell Admin để compact vật lý. |
| 30/07/2026 | `PUBLIC-8099-ANDROID-APK` | Đổi Docker web public port sang `8099`, build web với API relative `/api/v1`, thêm nginx reverse proxy `/api/` tới API container để test từ xa không bị dính `localhost`, mở CORS cho Tauri mobile, thêm cấu hình API URL runtime ở màn đăng nhập và build lại APK Android arm64 unsigned trỏ mặc định `http://192.168.10.238:8099/api/v1`. Script Android nhận `-ApiUrl` và bật cleartext cho bản test HTTP. Trạng thái tổng chưa đổi vì Android vẫn cần QA thiết bị thật/signing/push production. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `curl http://localhost:8099/health`, `curl http://localhost:8099/api/v1/auth/me`, targeted login smoke 1/1, `pnpm smoke:web` 30/30, `scripts/build-android-arm64.ps1 -ApiUrl http://192.168.10.238:8099/api/v1`. |
| 30/07/2026 | `TASK-SEARCH-DEBOUNCE` | Bổ sung hook `useDebouncedValue` và áp cho ô tìm kiếm từ khóa/mã công việc trong TaskList để giảm gọi API khi gõ liên tục; select/date/filter khác vẫn phản hồi tức thời. Chuyển checklist `Debounce search` sang DONE. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task filter smoke 1/1, `pnpm smoke:web` 30/30. |
| 30/07/2026 | `PROFILE-RELATED-WORK` | Bổ sung dữ liệu liên quan trong hồ sơ cá nhân: API `/profile/related` gom công việc liên quan, hồ sơ tôi tạo và hồ sơ chờ tôi phê duyệt theo scope quyền backend; UI profile hiển thị metric + danh sách recent responsive; smoke test tạo task/workflow thật rồi assert API/UI đọc được dữ liệu. Chuyển `User profile đầy đủ` và `Thiết bị đăng nhập/hoạt động gần đây/task/workflow liên quan` sang DONE. | `pnpm lint`, `pnpm test`, `pnpm build` qua Docker build, `docker compose up -d --build`, targeted profile-related smoke 1/1, `pnpm smoke:web` 30/30. |
| 30/07/2026 | `PROFILE-AVATAR-UPLOAD` | Bổ sung upload avatar thật cho hồ sơ cá nhân: endpoint `/profile/avatar` validate JPG/PNG/WebP và dung lượng, lưu file bằng tên an toàn trong `UPLOAD_DIR/avatars`, DB lưu URL public `/api/v1/avatars/...`, endpoint serve avatar không lộ path nội bộ, UI profile có preview/chọn file/upload/success và smoke test kiểm avatarUrl trong DB. Trạng thái tổng chưa đổi vì profile vẫn còn thiếu tab task/workflow liên quan. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted profile/avatar smoke 1/1, `pnpm smoke:web` 30/30. |
| 30/07/2026 | `PROFILE-ACTIVITY-TIMELINE` | Bổ sung hoạt động gần đây trong hồ sơ cá nhân: API `/profile/activity` chỉ trả audit log của chính người dùng, phân trang server-side; UI profile hiển thị timeline action/entity/time và reload sau khi lưu hồ sơ. Smoke test cập nhật profile rồi assert `user.profile.update` xuất hiện trên timeline. Trạng thái tổng chưa đổi vì profile vẫn thiếu avatar upload và task/workflow liên quan. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted profile activity smoke 1/1, `pnpm smoke:web` 30/30. |
| 30/07/2026 | `PROFILE-PASSWORD-CHANGE` | Bổ sung đổi mật khẩu cá nhân: API `/profile/password` yêu cầu mật khẩu hiện tại, validate mật khẩu mới, hash bcrypt, reset failed login, thu hồi toàn bộ refresh sessions trong transaction và ghi audit `user.password.change`; UI profile có panel đổi mật khẩu và logout local sau khi đổi thành công. Smoke test tạo user tạm, đổi mật khẩu qua UI, kiểm refresh token cũ bị từ chối, mật khẩu cũ không login được và mật khẩu mới login được. Trạng thái tổng chưa đổi vì profile vẫn thiếu avatar upload, task/workflow liên quan và hoạt động gần đây. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted password smoke 1/1, `pnpm smoke:web` 30/30. |
| 30/07/2026 | `USER-PROFILE-SELF-SERVICE` | Bổ sung hồ sơ cá nhân tự phục vụ: API `/profile` xem/sửa thông tin cá nhân an toàn, chỉ cho cập nhật họ tên/số điện thoại/chức danh/avatar URL, ghi audit `user.profile.update`, frontend có trang Hồ sơ từ sidebar/account menu, hiển thị phòng ban/quản lý/nhóm/vai trò/timestamps và smoke test lưu DB thật. Chuyển checklist `User profile đầy đủ` từ TODO sang PARTIAL vì avatar upload, tab task/workflow liên quan và profile nâng cao còn thiếu. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted profile smoke 1/1, `pnpm smoke:web` 29/29. |
| 30/07/2026 | `AUTH-LOGOUT-ALL-SESSIONS` | Bổ sung đăng xuất tất cả thiết bị: route `/auth/logout-all` dùng service thu hồi toàn bộ refresh sessions trong transaction, ghi audit `auth.session.revoke_all`, UI có vùng xác nhận trong panel phiên đăng nhập và smoke test kiểm current refresh token bị từ chối sau logout-all. Đồng thời sửa Playwright login retry theo thông báo rate-limit và nới timeout test để tránh fail giả. Trạng thái tổng chưa đổi vì secure storage native/profile/import user vẫn chưa hoàn tất. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted auth session/logout-all smoke 1/1, `pnpm smoke:web` 28/28. |
| 30/07/2026 | `AUTH-SESSION-DEVICE-REVOKE` | Bổ sung quản lý phiên đăng nhập trong menu tài khoản: API liệt kê refresh sessions đang hoạt động, thu hồi từng phiên với audit log, frontend hiển thị thiết bị/IP/thời gian/user agent và smoke test xác nhận refresh token bị thu hồi không refresh lại được. Trạng thái tổng chưa đổi vì hồ sơ cá nhân đầy đủ, import user và secure storage native vẫn còn PARTIAL/TODO. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted auth session smoke 1/1, `pnpm smoke:web` 28/28. |
| 30/07/2026 | `SEED-WORKFLOW-NEEDS-INFO` | Bổ sung seed hồ sơ workflow trạng thái `NEEDS_INFO`: tạo payment instance bằng service thật rồi manager `REQUEST_INFO`, đồng thời thêm đoạn idempotent để DB dev hiện tại có thể chạy lại seed và nhận dữ liệu này. Chuyển checklist `Hồ sơ pending/approved/rejected/request info` sang DONE. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm docker:seed`, query DB status có `NEEDS_INFO`, `pnpm smoke:web` 27/27. |
| 30/07/2026 | `WORKFLOW-VERSION-COMPARE-UI` | Bổ sung UI so sánh phiên bản quy trình trên trang Mẫu quy trình: chọn hai phiên bản từ dữ liệu DB thật, gọi API compare, hiển thị thay đổi trường/bước/luồng chuyển và smoke test thao tác compare sau khi tạo template. Chuyển checklist `Compare versions` sang DONE. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted workflow builder/compare smoke 1/1, `pnpm smoke:web` 27/27. |
| 30/07/2026 | `WORKFLOW-CHOICE-FIELD-OPTIONS` | Bổ sung cấu hình lựa chọn thật cho workflow `SELECT/RADIO`: builder nhập options, dynamic form render dropdown/radio khi có options, backend validate giá trị phải thuộc danh sách và smoke test assert invalid option trả 400, submit hợp lệ vẫn áp default. Trạng thái tổng chưa đổi vì ATTACHMENT/TABLE/user/department select chuyên dụng còn PARTIAL. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted workflow builder smoke 1/1, `pnpm smoke:web` 27/27. |
| 30/07/2026 | `WORKFLOW-FIELD-DEFAULT-VALIDATION` | Nâng workflow form builder và backend validation: quản trị viên nhập được giá trị mặc định, min/max length cho text và min/max value cho số/tiền; API chỉ nhận rule có cấu trúc, tự áp default khi client bỏ trống field và validate rule khi tạo hồ sơ. Trạng thái tổng chưa đổi vì editable-by-step/visible-by-role còn PARTIAL. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted workflow builder smoke 1/1, `pnpm smoke:web` 27/27. |
| 30/07/2026 | `WORKFLOW-RETURN-SMOKE` | Bổ sung Playwright smoke riêng cho hành động trả bước hồ sơ PAYMENT: tạo hồ sơ số tiền lớn để đi qua bước quản lý rồi giám đốc trả về người xử lý trước, assert trạng thái hồ sơ, pending approver và lịch sử `RETURN` qua API thật. Không đổi số lượng DONE/PARTIAL/TODO vì chức năng trả bước đã DONE, chunk này tăng độ phủ kiểm thử. | `pnpm lint`, `pnpm test`, `pnpm build`, Docker API/web healthy, targeted return smoke 1/1, `pnpm smoke:web` 27/27. |
| 30/07/2026 | `DEADLINE-NOTIFICATION-SCHEDULER` | Bổ sung scheduler thông báo sắp hạn/quá hạn: API chạy scan khi start và mỗi giờ, endpoint quản trị `/notifications/run-deadline-scan`, dedupe notification, task due soon/overdue, workflow step due soon/overdue và tính `deadlineAt` khi start approval step; smoke test tạo dữ liệu thật rồi assert notification. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted deadline scheduler smoke 1/1, `pnpm smoke:web` 26/26. |
| 30/07/2026 | `ATTACHMENT-DOWNLOAD-AUDIT` | Bổ sung audit log khi tải tệp task/workflow: endpoint download ghi `task.attachment.download` và `workflow.attachment.download` với actor/entity/metadata an toàn trước khi stream file; smoke test download task assert activity log thật. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted download audit smoke 1/1, `pnpm smoke:web` 25/25. |
| 30/07/2026 | `TASK-COMMENT-NOTIFICATIONS` | Bổ sung notification `TASK_COMMENT_NEW` khi có bình luận mới: service gom creator/assigner/manager/assignees/followers/tác giả comment cha, loại người comment và người đã được mention để tránh trùng; smoke test comment/upload assert assignee nhận notification thật. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted comment notification smoke 1/1, `pnpm smoke:web` 25/25. |
| 30/07/2026 | `TASK-LIST-ROW-ACTIONS` | Bổ sung action nhanh trên danh sách công việc: DataTable mobile card hỗ trợ role button để tránh nested button, row task có nút Mở/Bắt đầu-Tiếp tục, loading/error/success, PATCH trạng thái thật và smoke test assert row/API chuyển `IN_PROGRESS`. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted row action smoke 1/1, `pnpm smoke:web` 25/25. |
| 30/07/2026 | `WORKFLOW-APPROVED-NOTIFICATION` | Bổ sung notification `WORKFLOW_APPROVED` khi hồ sơ hoàn tất duyệt: service enqueue cho người tạo hồ sơ với link/object thật và smoke test luồng duyệt PAYMENT assert notification của requester. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted approve notification smoke 1/1, `pnpm smoke:web` 24/24. |
| 30/07/2026 | `DASHBOARD-DEPARTMENT-STATS` | Bổ sung thống kê công việc theo phòng ban trên dashboard: backend map `departmentId` sang tên phòng ban, UI render widget riêng lấy dữ liệu thật và smoke test tạo task rồi assert phòng ban xuất hiện. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted dashboard department smoke 1/1, `pnpm smoke:web` 24/24. |
| 30/07/2026 | `WORKFLOW-ACTION-ATTACHMENTS` | Bổ sung tệp đính kèm khi xử lý hồ sơ phê duyệt: thêm bảng/migration `workflow_attachments`, route upload/download riêng, validate quyền pending approver, action nhận `attachmentIds`, gắn file vào `workflow_approvals`, UI chọn/tải file trong panel/lịch sử xử lý và smoke test duyệt PAYMENT kèm PDF. | `pnpm db:generate`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted workflow attachment smoke 1/1, `pnpm smoke:web` 23/23. |
| 30/07/2026 | `TASK-LIST-SORT-UI` | Bổ sung sort server-side cho danh sách công việc: backend allow-list `sortBy/sortOrder`, UI chọn field/chiều sort, reset trang khi đổi sort và smoke test tạo 2 task để assert thứ tự hạn tăng/giảm. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted sort smoke 1/1, `pnpm smoke:web` 23/23. |
| 30/07/2026 | `TASK-LIST-PAGINATION-UI` | Bổ sung phân trang UI cho danh sách công việc: query gửi `page/pageSize`, reset về trang 1 khi đổi search/filter/tab, thanh Trước/Sau + summary lấy từ API thật và smoke test tạo 11 task để kiểm trang 1/2. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted pagination smoke 1/1, targeted my-task smoke 1/1, `pnpm smoke:web` 22/22. |
| 30/07/2026 | `TASK-KANBAN-CONFIRM` | Thay browser confirm bằng panel xác nhận trong app cho Kanban khi chuyển sang Chờ đánh giá/Hoàn thành/Đã hủy, có loading/error/success, test id ổn định cho column/card và smoke test drop task sang Hoàn thành rồi xác nhận. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted kanban smoke 1/1, `pnpm smoke:web` 21/21. |
| 30/07/2026 | `TASK-CALENDAR-START-DUE` | Nâng lịch công việc từ danh sách nhóm theo hạn sang grid ngày responsive: API filter `from/to` theo cả `startDate` và `dueDate`, UI hiển thị marker Bắt đầu/Hạn riêng và click marker mở detail task. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted calendar smoke 1/1, `pnpm smoke:web` 20/20. |
| 30/07/2026 | `TASK-REDO-RESET-PROGRESS` | Áp cấu hình `task.redo.reset_progress` khi yêu cầu làm lại công việc: service đọc setting trong transaction, reset progress về 0 nếu bật, ghi progress log/audit metadata và smoke test UI bật setting, redo task, assert progress 0 rồi restore setting. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted redo reset smoke 1/1, `pnpm smoke:web` 19/19. |
| 30/07/2026 | `TASK-COMMENT-REPLIES` | Bổ sung trả lời bình luận trong chi tiết công việc: backend validate `parentCommentId` thuộc đúng task, UI hiển thị thread/replies, banner đang trả lời và smoke test kiểm tra `parentCommentId` qua API detail. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted comment reply smoke 1/1, `pnpm smoke:web` 18/18. |
| 30/07/2026 | `TASK-EVALUATION-ATTACHMENTS` | Bổ sung tệp xác nhận trong panel đánh giá công việc: validate file phía UI, upload trước khi gửi đánh giá, lưu `attachmentIds` vào `task_evaluations` và smoke test đối chiếu attachment qua API detail. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task evaluation smoke 1/1, `pnpm smoke:web` 18/18. |
| 30/07/2026 | `TASK-PARENT-AUTO-PROGRESS` | Bổ sung tự tính tiến độ công việc cha từ các công việc con khi bật `autoCalculateParentProgress`: cập nhật parent trong transaction, ghi progress log/audit, UI có toggle và detail hiển thị tổng tiến độ con; smoke test cập nhật child rồi assert parent progress/subTaskProgress. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task form smoke 1/1, `pnpm smoke:web` 18/18. |
| 30/07/2026 | `TASK-RELATIONS-UI` | Bổ sung chọn công việc cha và công việc liên quan trên form tạo task, có ô tìm task theo mã/tên, API detail trả `dependenciesFrom.targetTask`, detail UI hiển thị parent/subtasks/related và smoke test assert parent/related được lưu. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task form smoke 1/1, `pnpm smoke:web` 18/18. |
| 30/07/2026 | `TASK-ASSIGNER-FIELD` | Bổ sung trường Người giao việc trên form tạo task, lưu draft, gửi `assignerId` về API và smoke test tạo task UI kiểm tra assigner được lưu đúng cùng attachment. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task form attachment smoke 1/1, `pnpm smoke:web` 18/18. |
| 30/07/2026 | `TASK-CREATE-ATTACHMENTS` | Bổ sung tệp đính kèm ngay trên form tạo công việc: validate MIME/dung lượng dùng chung với chi tiết task, chọn nhiều file, hiển thị danh sách file đã chọn, upload file sau khi tạo task và smoke test tạo task UI kèm PDF. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task form attachment smoke 1/1, `pnpm smoke:web` 18/18. |
| 30/07/2026 | `WORKFLOW-MIN-RULE-UI` | Hoàn thiện UI cấu hình điều kiện hoàn thành bước phê duyệt song song: chọn `PARALLEL`, `ALL/ANY/MIN_COUNT/MIN_PERCENT`, nhập số lượng/tỷ lệ tối thiểu, validate phía UI và gửi `minCount/minPercent` vào API; smoke test assert cấu hình được lưu. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted workflow builder smoke 1/1, `pnpm smoke:web` 17/17. |
| 30/07/2026 | `TEAM-MANAGEMENT` | Bổ sung quản lý nhóm làm việc: API `GET/POST/PATCH /teams`, validate phòng ban/thành viên, audit log, seed nhóm mẫu, user create/edit nhận nhiều `teamIds`, UI quản lý nhóm trong trang cơ cấu tổ chức và smoke test tạo/cập nhật thành viên nhóm. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted team smoke 1/1, `pnpm smoke:web` 17/17. |
| 30/07/2026 | `WORKFLOW-TRANSFER-ACTION` | Bổ sung hành động chuyển xử lý hồ sơ phê duyệt: backend nhận `TRANSFER`, kiểm người nhận, chuyển pending approval trong transaction, tính approval được chuyển như người duyệt thay trong bước tuần tự, ghi changedData/audit/idempotency và UI chọn người nhận xử lý. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted transfer smoke 1/1, `pnpm smoke:web` 16/16. |
| 30/07/2026 | `TASK-ADVANCED-FILTERS` | Bổ sung panel lọc công việc nâng cao trên UI: mã, người tạo, người thực hiện, người quản lý, phòng ban, ưu tiên, danh mục, nhãn, khoảng hạn và quá hạn; tất cả nối query server-side. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 15/15. |
| 30/07/2026 | `MY-TASK-TABS` | Hoàn thiện trang Công việc của tôi với 7 tab bắt buộc, nối filter server-side theo assignee/assigner/manager/follower/review/overdue/done; bổ sung đủ cột list view và smoke test lọc tab. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 14/14. |
| 30/07/2026 | `TASK-EVALUATION-PANEL` | Thay prompt đánh giá task bằng panel trong app: chọn hoàn thành/làm lại, chấm 1-5 sao, nhập nhận xét/lý do, loading/error rõ ràng và smoke test quản lý xác nhận hoàn thành task. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 13/13. |
| 30/07/2026 | `WORKFLOW-CONDITION-BUILDER` | Bổ sung UI cấu hình điều kiện chuyển bước trong workflow builder: chọn field, operator, giá trị so sánh, gửi structured condition vào transition và smoke test kiểm tra condition được lưu qua API. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 12/12. |
| 29/07/2026 | `WORKFLOW-ACTION-PANEL` | Thay browser prompt/confirm khi duyệt/từ chối/yêu cầu bổ sung/trả bước bằng panel xác nhận trong app có textarea, validation ý kiến, loading chống bấm lặp, lỗi/thành công rõ ràng và cập nhật smoke test. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 12/12. |
| 29/07/2026 | `WORKFLOW-INSTANCE-DYNAMIC-FORM` | Nâng tạo hồ sơ quy trình từ nhập JSON sang form động theo field của template active; backend validate type cơ bản, detail hồ sơ hiển thị dữ liệu theo nhãn field, thêm smoke test tạo hồ sơ bằng UI form động. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 12/12. |
| 29/07/2026 | `WORKFLOW-BUILDER-DYNAMIC` | Nâng màn tạo mẫu quy trình từ form cứng sang builder động cơ bản: thêm/xóa field, chọn loại field, bắt buộc/placeholder/order, thêm/xóa bước duyệt, resolver, approval mode/rule/deadline và smoke test tạo template bằng UI builder. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 11/11. |
| 29/07/2026 | `ROLE-PERMISSION-PREVIEW` | Bổ sung preview phạm vi quyền theo permission code và cảnh báo cấu hình quyền trong trang Vai trò; thêm smoke test kiểm tra role permission preview. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 10/10. |
| 29/07/2026 | `DEPARTMENT-EDIT-UI` | Nâng quản lý phòng ban/cơ cấu tổ chức: thêm parent department, mô tả, quản lý, detail/edit panel, list phân cấp cha-con, backend guard chống vòng lặp phòng ban và smoke test cập nhật phòng ban. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 9/9. |
| 29/07/2026 | `USER-EDIT-UI` | Nâng trang Quản lý người dùng: thêm detail/edit panel, cập nhật họ tên/số điện thoại/chức danh/phòng ban/quản lý/trạng thái/vai trò qua `PATCH /users/:id`, thêm label trạng thái `LOCKED`, mở CORS cho `PATCH`, thêm smoke test UI cập nhật nhân viên và sửa `.gitignore` để track module source upload routes. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 8/8. |
| 29/07/2026 | `APP-SHELL-SPLIT` | Tách login, dashboard, app shell/navigation và shared status/date helpers khỏi `App.tsx`; `App.tsx` còn 134 dòng, chỉ giữ bootstrap session, theme/offline state và router nội bộ. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 7/7. |
| 29/07/2026 | `PAGE-MODULE-SPLIT` | Tách workflow/approval pages sang `apps/web/src/pages/workflows.tsx` và admin/log/settings pages sang `apps/web/src/pages/admin.tsx`; `App.tsx` chỉ còn login, shell, dashboard và router nội bộ. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 7/7. |
| 29/07/2026 | `TASK-PAGES-SPLIT` | Tách nhóm trang công việc thường (`TaskList`, `Kanban`, `CalendarPage`, `TaskForm`, `TaskDetail`, attachment list) khỏi `App.tsx` sang `apps/web/src/pages/tasks.tsx`; dọn helper task còn sót trong app shell. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, `pnpm smoke:web` 7/7. |
| 29/07/2026 | `CI-SMOKE` | Mở rộng Playwright smoke lên 7 kịch bản: login, task upload/download, cập nhật progress lên chờ đánh giá, approve/reject/request-info workflow và idempotency chống duyệt trùng; nâng GitHub Actions chạy verify + Docker smoke web. | `pnpm smoke:web` 7/7, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, Docker API/web healthy. |
| 29/07/2026 | `UI-SMOKE` | Thêm Playwright smoke test web cho login, task upload/download và duyệt hồ sơ PAYMENT tuần tự; thêm test id ổn định cho nav/table/action; sửa download filename qua CORS `Content-Disposition`. | `pnpm smoke:web`, `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, Docker API/web healthy. |
| 29/07/2026 | `MOBILE-BUILD` | Thiết lập môi trường Tauri mobile trên Windows, cài/nhận Android cmdline-tools + NDK, thêm Rust lib target cho Tauri mobile, sinh icon app, build Windows desktop installer và Android arm64 APK kiểm thử. | `pnpm lint`, `pnpm test`, `pnpm build`, `tauri android init --ci`, `pnpm android:build:arm64`, `pnpm --filter @workflow/web desktop:build`; iOS `WAITING` do Windows không hỗ trợ Tauri iOS build. |
| 29/07/2026 | `FRONTEND-SPLIT` | Tách UI primitives dùng chung (`LoadingBlock`, `ErrorBlock`, `DataTable`, `MultiCheck`) và hook `useAsyncData` khỏi `App.tsx` để bắt đầu hình thành component system frontend. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose build web`, restart Docker web, QA browser dashboard pass. |
| 29/07/2026 | `ROLE-MATRIX` | Nâng trang quản lý vai trò thành ma trận quyền cơ bản theo nhóm, có chọn nhóm/toàn bộ, sao chép quyền từ vai trò khác, khôi phục, cảnh báo thay đổi chưa lưu và xác nhận trước khi lưu. | `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose build web`, restart Docker web, QA browser trang Vai trò pass. |
| 29/07/2026 | `DOC-UPDATE` | Tạo checklist triển khai đầy đủ theo yêu cầu cập nhật, thêm quy tắc bắt buộc cập nhật checklist sau mỗi lần sửa, cập nhật README và ARCHITECTURE cho phạm vi UI/config/report/mobile mới. | Tài liệu only; kiểm tra `git diff --stat` và heading checklist. |
| 29/07/2026 | `a69101a` | Thêm tệp đính kèm trong bình luận công việc, tải xuống attachment, refresh token cho download, UI attachment trong chi tiết task. | `pnpm test`, `pnpm lint`, `pnpm build`, Docker API/web healthy, smoke upload/download pass. |
| 29/07/2026 | `a4b95f6` | Tự refresh access token ở frontend, sửa dashboard hiển thị quá hạn, thêm web client test. | `pnpm test`, `pnpm lint`, `pnpm build`, Docker healthy, QA workflow UI pass. |
| 29/07/2026 | `58de69a` | Sửa mobile navigation và Việt hóa trạng thái mẫu quy trình. | `pnpm lint`, `pnpm test`, `pnpm build`, QA browser pass. |
| 29/07/2026 | `145f9fa` | Sửa Docker runtime build, Prisma generate và seed command. | `docker compose build`, `docker compose up -d`, health check, login API pass. |
| 29/07/2026 | `ece9acd` | Khởi tạo hệ thống monorepo, API, web, DB, migration, seed, Docker, tài liệu ban đầu. | `pnpm lint`, `pnpm test`, `pnpm build`. |

## Tổng quan giai đoạn

| Giai đoạn | Trạng thái | Ghi chú |
| --- | --- | --- |
| Giai đoạn 1 - Nền tảng, đăng nhập, dashboard, công việc thường, RBAC cơ bản | `PARTIAL` | Chạy được bằng Docker, login/RBAC/API/task/dashboard đã có. Còn thiếu nhiều UI quản trị nâng cao, scope dữ liệu chi tiết, import/export và test UI rộng. |
| Giai đoạn 2 - Quy trình phê duyệt, form builder, workflow designer, version | `PARTIAL` | API template/version/step/transition/instance/approval đã có; UI builder còn đơn giản, chưa có canvas kéo thả/form builder đầy đủ. |
| Giai đoạn 3 - Cấu hình nâng cao, báo cáo, mobile, push notification, hiệu năng | `PARTIAL` | Có settings cơ bản, responsive/mobile web, notification inbox/device token table. Chưa có push adapter thật, báo cáo riêng, cấu hình nâng cao, mobile native QA. |

## 1. Yêu cầu thực hiện

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Kiểm tra repository trước khi sửa | `DONE` | Repo đã được rà soát trước khi khởi tạo và trước các lượt sửa tiếp theo bằng `git status`, `rg`, đọc file liên quan. |
| Chọn công nghệ phù hợp, modular monolith | `DONE` | Fastify + Prisma + PostgreSQL + React/Vite + Tauri shell. |
| Database PostgreSQL hoặc MySQL | `DONE` | PostgreSQL 16 qua Docker Compose. |
| Giao diện tiếng Việt | `PARTIAL` | Phần chính tiếng Việt. Cần tiếp tục rà toàn bộ text/lỗi/browser edge cases. |
| Responsive desktop/tablet/mobile | `PARTIAL` | Có sidebar desktop, bottom nav/mobile cards/menu mở rộng. Cần QA thêm nhiều viewport và refine detail mobile theo tab/section. |
| Múi giờ Asia/Ho_Chi_Minh, ngày dd/MM/yyyy | `DONE` | Backend dùng timezone cấu hình, frontend format `vi-VN` dd/MM/yyyy. |
| Không chỉ giao diện mẫu, có DB/API/business/RBAC/validation/migration/seed/docs | `PARTIAL` | Nền tảng có đủ và chạy được; còn nhiều nghiệp vụ nâng cao trong checklist chưa xong. |
| `ARCHITECTURE.md` trước khi code | `DONE` | Đã có. Cần cập nhật thêm các yêu cầu UI/config mới. |

## 2. Module chính và nền tảng

| Module | Trạng thái | Ghi chú |
| --- | --- | --- |
| Đăng nhập và quản lý tài khoản | `PARTIAL` | Login/refresh/logout/logout-all/users create/edit profile/roles/status, hồ sơ cá nhân tự phục vụ có avatar upload/đổi mật khẩu/timeline/task-workflow liên quan và panel phiên đăng nhập/thu hồi thiết bị. Chưa có import user và quản trị phiên của user khác. |
| Phòng ban và cơ cấu tổ chức | `PARTIAL` | Departments create/edit/detail, parent department, list phân cấp cha-con và quản lý nhóm làm việc có; backend chống vòng lặp parent và validate team member. Company/branch UI, sơ đồ tổ chức kéo thả chưa có. |
| Vai trò và phân quyền | `PARTIAL` | RBAC tables/API, ma trận quyền, preview phạm vi dữ liệu và cảnh báo cấu hình quyền cơ bản có. Chưa có data scope/field permissions có cấu hình riêng. |
| Thông báo | `PARTIAL` | Notification center/inbox/device token table và scheduler nhắc hạn có. Chưa có push adapter FCM/APNs/Desktop thật. |
| Bình luận và tệp đính kèm | `PARTIAL` | Comment, reply comment, mention list, upload/download attachment cho task và tệp xử lý workflow approval có. Lịch sử chỉnh sửa comment, xóa/khôi phục file và edit history còn thiếu. |
| Nhật ký hoạt động | `PARTIAL` | Audit log cho nhiều hành động chính và download tệp task/workflow có. Cần phủ thêm import/export/config/xóa hoặc khôi phục tệp. |
| Dashboard và báo cáo cơ bản | `PARTIAL` | Dashboard thật từ DB có, gồm card theo quyền, task cần chú ý, trạng thái, phòng ban, hồ sơ gần nhất và notification. Module báo cáo riêng, drill-down/export chưa có. |
| Cấu hình hệ thống | `PARTIAL` | Key/value settings có. Chưa có trung tâm cấu hình đầy đủ theo nhóm. |

## 3. Người dùng, phòng ban và RBAC

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| User fields: mã NV, họ tên, email, phone, password, avatar, title, department, manager, status, created, last login | `PARTIAL` | Schema/API có phần lớn; UI tạo/chỉnh user đã hỗ trợ phone/title/department/manager/status/roles và hiển thị created/last login; trang hồ sơ cá nhân cho tự sửa họ tên/phone/title, upload avatar, đổi mật khẩu, xem timeline và task/workflow liên quan; menu tài khoản có panel phiên đăng nhập/thu hồi thiết bị/logout-all. Import/export user và quản trị phiên user khác chưa có. |
| Company, branch, department, team, title, direct manager | `PARTIAL` | Schema có company/branch/team/departments; UI user/department/team đã có chỉnh trực tiếp, parent department và manager. Company/branch UI nâng cao chưa có. |
| Một người thuộc một phòng ban chính và nhiều nhóm | `DONE` | Schema `team_members`, API `/teams`, user create/edit `teamIds`, UI quản lý nhóm và smoke test tạo/cập nhật thành viên nhóm đã có. |
| Vai trò mặc định admin/manager/employee/watcher | `DONE` | Seed tạo các vai trò mặc định. |
| RBAC linh hoạt, không hard-code theo tên vai trò | `DONE` | Backend kiểm permission code; role name không hard-code policy chính. |
| Manager xem nhân viên trực thuộc | `PARTIAL` | Scope task theo direct report có. Cần mở rộng workflow/report/user profile. |
| Backend kiểm quyền, không chỉ ẩn nút | `DONE` | Route preHandler/policy/service kiểm quyền. |

## 4. Công việc thường

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Mã công việc tự sinh | `DONE` | Mặc định `TASK-YYYYMMDD-XXXX`, prefix/padding đọc từ `system_settings` và có UI cấu hình. |
| Form tạo task: title, mô tả, assigner, assignee, manager, follower, department, start/due, priority, category, tags, review | `DONE` | UI/API có. |
| Người giao việc | `DONE` | Backend có `assignerId`; UI form tạo task đã có select Người giao việc, lưu draft và smoke test assert API lưu đúng. |
| Tệp đính kèm khi tạo task | `DONE` | Form tạo task chọn nhiều file, validate MIME/dung lượng, upload sau khi tạo task và smoke test kiểm tra attachment trong detail API/UI. |
| Công việc cha/con | `DONE` | Schema/service chống vòng lặp có; UI tạo task chọn được công việc cha, detail hiển thị parent/subtasks, có toggle auto progress cha và smoke test. |
| Công việc liên quan/phụ thuộc | `DONE` | Schema/API `relatedTaskIds`, form tạo task chọn công việc liên quan, API detail trả related target và UI detail hiển thị; smoke test assert lưu đúng. |
| Lặp lại ngày/tuần/tháng | `PARTIAL` | Field/schema có; scheduler sinh task lặp chưa có UI/logic đầy đủ. |
| Custom fields | `PARTIAL` | JSON field có; UI cấu hình custom field chưa có. |
| Validation ngày bắt đầu <= hạn | `DONE` | Backend kiểm. |
| Audit log khi tạo/sửa task | `DONE` | Có audit log create/update/progress/evaluate/comment/attachment. |
| Trạng thái mặc định, quá hạn tính động | `DONE` | `displayStatus=OVERDUE` tính động ở list/dashboard/detail. |
| Cập nhật tiến độ 0-100, ghi chú, lịch sử | `DONE` | API/UI/history có. |
| 100% -> chờ đánh giá hoặc hoàn thành | `DONE` | Domain/service/test có. |
| Đánh giá hoàn thành/làm lại, rating, comment | `DONE` | API/UI có accept/redo, 1-5 sao, nhận xét/lý do và upload tệp xác nhận lưu vào `task_evaluations.attachmentIds`; smoke test kiểm tra attachment qua API detail. |
| Làm lại giữ/reset tiến độ theo cấu hình | `DONE` | Setting `task.redo.reset_progress` đã được service áp dụng trong transaction; khi bật sẽ reset progress về 0, ghi progress log/audit và smoke test UI pass. |
| Tiến độ task cha từ task con | `DONE` | Khi parent bật `autoCalculateParentProgress`, cập nhật progress child sẽ tự tính trung bình các child, cập nhật parent trong transaction và ghi progress log/audit. |
| Comment, mention, attachment | `PARTIAL` | Comment/mention IDs/attachment upload/reply comment có. `@` autocomplete văn bản và edit history còn thiếu. |
| List view | `DONE` | Có list/mobile cards với mã, tên, trạng thái, tiến độ, người thực hiện, người giao, phòng ban, ưu tiên, ngày bắt đầu, hạn hoàn thành và số ngày còn/quá hạn. |
| Kanban view, kéo thả | `DONE` | Kanban nhóm theo trạng thái, drop handler đổi trạng thái, trạng thái quan trọng có confirmation panel trong app, loading/error/success và smoke test pass. |
| Calendar view | `DONE` | Có grid lịch theo ngày, hiển thị riêng marker Bắt đầu/Hạn từ `startDate` và `dueDate`, bấm marker mở detail task; smoke test pass. |
| Công việc của tôi với đủ tabs | `DONE` | Có đủ 7 tab: Tôi thực hiện, Tôi giao, Tôi quản lý, Tôi theo dõi, Chờ tôi đánh giá, Đã quá hạn, Đã hoàn thành; filter phía server và smoke test. |
| Tìm kiếm/lọc server-side đầy đủ | `DONE` | UI có keyword, code, status, creator, assignee, manager, department, priority, due range, overdue, category và tag; tất cả nối query API server-side và có smoke test. |
| Phân trang server-side | `DONE` | API paginate có; danh sách công việc có điều khiển Trước/Sau, summary trang/tổng và reset trang khi đổi filter/search/tab. |

## 5. Quy trình phê duyệt

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Workflow template fields: code/name/description/category/version/manager/allowed initiators/status | `PARTIAL` | Code/name/category/manager/version/status có; allowed initiators chưa có UI/policy đầy đủ. |
| Form field types đầy đủ | `PARTIAL` | Schema enum có nhiều type; UI builder tạo template đã chọn được các loại field chính, SELECT/RADIO có options thật và new instance render dropdown/radio. ATTACHMENT/TABLE, user select và department select chuyên dụng còn cần UI/upload/query riêng theo form field. |
| Field config required/default/placeholder/validation/order/editable/visible roles | `PARTIAL` | UI builder/API đã có required/default/placeholder/options/validation min-max/order cơ bản và smoke test lưu rule thật. Editable-by-step, visible-by-role và validation nâng cao còn thiếu UI đầy đủ. |
| Step types start/handler/approval/review/notification/end | `DONE` | Enum/schema/API có. |
| Assignee resolver theo user/role/department/manager/head/form field/previous | `DONE` | Service resolver có. |
| Sequential approval | `DONE` | API/service/test/smoke pass. |
| Parallel approval all/any/min count/min percent | `DONE` | Service tạo pending approval song song, domain test phủ `MIN_COUNT/MIN_PERCENT`, UI builder chọn `PARALLEL` và đủ `ALL/ANY/MIN_COUNT/MIN_PERCENT`, smoke test assert cấu hình min count được lưu. |
| Approve/reject/request info/return | `DONE` | API/UI/smoke pass; UI có panel xác nhận trong app thay cho browser prompt. |
| Forward/chuyển xử lý | `DONE` | Có action `TRANSFER`, chọn người nhận xử lý trên UI, chuyển pending approval trong transaction, gửi notification, lưu changedData/audit/idempotency và smoke test admin duyệt sau chuyển. |
| Approval action lưu người, thời gian, action, comment, IP | `DONE` | WorkflowApproval có fields và service ghi; action attachment lưu qua `workflow_attachments`, liên kết approval và hiển thị trong lịch sử xử lý. |
| Lưu step trước/sau và dữ liệu thay đổi | `PARTIAL` | History approvals/steps có; metadata before/after chưa đầy đủ. |
| Điều kiện rẽ nhánh structured, không eval | `DONE` | Domain condition builder/test/smoke lớn tiền pass; workflow builder có UI điều kiện chuyển bước cơ bản. |
| Trạng thái hồ sơ đầy đủ | `PARTIAL` | Enum/status có; draft/submitted workflow chưa đủ UI/luồng. |
| Version workflow không sửa trực tiếp khi có instance | `PARTIAL` | Domain assert/test có cho status; UI tạo version mới/compare còn thiếu. |
| Compare versions | `DONE` | API compare có; UI trên trang Mẫu quy trình cho chọn hai phiên bản, hiển thị summary fields/steps/transitions và smoke test pass. |
| Deadline/SLA bước | `PARTIAL` | Schema deadline fields có, `deadlineAt` được tính khi start step và scheduler gửi sắp quá hạn/quá hạn. Tự động phê duyệt/escalation nâng cao chưa có. |

## 6. Thông báo

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Notification center trong app | `DONE` | Dashboard/notifications API có. |
| Task assigned/follower/comment/mention/pending review/redo | `DONE` | Assigned/follower/comment thường/mention/pending review/redo/sắp hạn/quá hạn đều enqueue notification DB thật; scheduler có dedupe và smoke test. |
| Workflow pending/approved/rejected/request info | `DONE` | Pending approval, approved, rejected, request info đều enqueue notification DB thật; smoke test duyệt PAYMENT assert `WORKFLOW_APPROVED` cho requester. |
| Step due soon/overdue notification | `DONE` | Scheduler quét `workflow_instance_steps.deadlineAt`, gửi `WORKFLOW_STEP_DUE_SOON/OVERDUE` cho pending approvers và smoke test assert notification. |
| Event-driven nội bộ để mở rộng email/Telegram/mobile | `PARTIAL` | `enqueueNotifications` và device tokens có. Adapter ngoài chưa có. |

## 7. Dashboard

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Cards theo quyền: active/pending/due soon/overdue/pending review/pending approvals/my instances | `DONE` | API/UI có dữ liệu thật. |
| Thống kê task theo trạng thái/phòng ban | `DONE` | Dashboard hiển thị widget trạng thái và phòng ban từ dữ liệu DB thật; backend trả tên phòng ban, smoke test tạo task rồi assert widget phòng ban. |
| Công việc cần chú ý | `DONE` | Có và đã sửa display overdue. |
| Yêu cầu phê duyệt gần nhất | `PARTIAL` | Recent instances có; dashboard theo vai trò chưa tách sâu. |
| Không hard-code demo số liệu | `DONE` | Số liệu lấy DB. |

## 8. Audit log và bảo mật

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Password hash an toàn | `DONE` | bcryptjs. |
| Chống SQL injection | `DONE` | Prisma query/transaction. |
| Chống XSS cơ bản | `PARTIAL` | React escaping + Helmet. Cần sanitize nếu có rich text. |
| CSRF | `DONE` | Không dùng cookie credential cho auth API hiện tại. |
| Backend validation | `DONE` | Zod. |
| Backend authorization | `DONE` | Auth guard + permission/policy. |
| Upload file: giới hạn type/size/safe filename/no internal path leak | `DONE` | API upload kiểm MIME/size/safe name/storageKey. |
| Rate limit login/API nhạy cảm | `DONE` | Fastify rate limit có `API_RATE_LIMIT_MAX` cấu hình theo môi trường; login route vẫn giới hạn riêng 5 lần/phút. |
| Lock/delay sau nhiều lần login sai | `DONE` | `failedLoginAttempts`, `lockedUntil`. |
| Không log secret | `PARTIAL` | Không chủ động log token/password; đổi mật khẩu chỉ audit action và số phiên thu hồi, không ghi password; audit cấu hình đã redact key nhạy cảm. Cần rà production logger/redaction toàn app. |
| Audit login/task/workflow/permission/config/download/delete file | `PARTIAL` | Login, task, workflow, permission/profile/session, download file task/workflow và config changes có audit metadata. Delete file/import/export chưa phủ hết. |

## 9. Giao diện trang bắt buộc

| Trang | Trạng thái | Ghi chú |
| --- | --- | --- |
| Đăng nhập | `DONE` | Có. |
| Dashboard | `DONE` | Có. |
| Công việc của tôi | `DONE` | Có đủ 7 tab theo yêu cầu và dùng filter server-side. |
| Danh sách toàn bộ công việc | `DONE` | Có. |
| Kanban công việc | `DONE` | Có board theo trạng thái, kéo/thả đổi trạng thái, xác nhận in-app cho trạng thái quan trọng và smoke test. |
| Lịch công việc | `DONE` | Có grid ngày responsive, marker Bắt đầu/Hạn và mở chi tiết task từ lịch. |
| Tạo công việc | `PARTIAL` | Có form chính yếu gồm assigner, parent/related, attachment và auto parent progress; còn thiếu repeat scheduler/custom fields UI nâng cao. |
| Chi tiết công việc | `PARTIAL` | Có overview/progress/comment/reply/attachments/history; thiếu tabs mobile và edit history comment. |
| Danh sách mẫu quy trình | `DONE` | Có. |
| Tạo/chỉnh sửa mẫu quy trình | `PARTIAL` | Tạo bằng builder động cơ bản có; chỉnh sửa/version UI chưa đủ. |
| Thiết kế biểu mẫu | `PARTIAL` | Builder động cơ bản có thêm/xóa field và chọn loại field; chưa kéo thả/section/tab/permission theo step. |
| Cấu hình bước phê duyệt | `PARTIAL` | Builder động cơ bản có thêm/xóa approval step, resolver, mode/rule/deadline; chưa có panel node/canvas đầy đủ. |
| Danh sách hồ sơ quy trình | `DONE` | Có. |
| Tạo hồ sơ | `PARTIAL` | UI đã render form động theo field của template active, validate inline và submit idempotency. Còn thiếu upload workflow chuyên dụng, field option động và draft/sửa bổ sung theo từng bước. |
| Chi tiết và lịch sử phê duyệt | `PARTIAL` | Có detail/history/action cơ bản; thiếu sơ đồ theo dõi. |
| Yêu cầu chờ tôi phê duyệt | `DONE` | Có filter pendingMine. |
| Quản lý người dùng | `PARTIAL` | Có list/create/detail/edit profile/roles/status cơ bản; người dùng tự sửa hồ sơ cá nhân, upload avatar, đổi mật khẩu, tự xem/thu hồi phiên đăng nhập và đăng xuất tất cả thiết bị trong menu tài khoản. Chưa có profile đầy đủ, import/export và quản trị phiên của user khác. |
| Quản lý phòng ban | `PARTIAL` | Có list phân cấp, create/detail/edit parent/manager/description và chống vòng lặp backend. Chưa có org chart kéo thả, branch/team UI. |
| Quản lý vai trò và quyền | `PARTIAL` | Có ma trận quyền theo nhóm, chọn nhóm/toàn bộ, copy role, reset, unsaved changes, preview phạm vi và cảnh báo cấu hình quyền cơ bản. Chưa có data scope/field permission có cấu hình riêng. |
| Nhật ký hoạt động | `DONE` | Có list. |
| Cấu hình hệ thống | `PARTIAL` | Key/value cơ bản. |

## 10. Database

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Các bảng tối thiểu theo yêu cầu | `DONE` | Schema Prisma có đủ nhóm chính. |
| `created_at`, `updated_at`, `created_by` khi cần | `PARTIAL` | Nhiều bảng có timestamps; created_by chưa phủ hết. |
| Soft delete phù hợp | `PARTIAL` | Có nhiều bảng; chưa phủ toàn bộ danh mục/config. |
| Optimistic locking | `PARTIAL` | `version` có ở task/workflow; chưa được yêu cầu trong mọi update UI. |
| Transaction cho chuyển bước/phê duyệt/tạo hồ sơ | `DONE` | Có. |
| Unique/index trường tìm kiếm | `PARTIAL` | Có index chính; cần tối ưu thêm khi dữ liệu lớn. |

## 11. API và xử lý nghiệp vụ

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| API v1 nhất quán | `DONE` | `/api/v1`. |
| Controller/service/data access/policy tách biệt | `PARTIAL` | Service tách; một số route còn query trực tiếp. |
| Transaction nghiệp vụ quan trọng | `DONE` | Task/workflow chính có. |
| Idempotent submit/approval | `DONE` | Idempotency key có, smoke pass. |
| Lỗi API cấu trúc thống nhất | `DONE` | `{ error: { code, message, details } }`. |
| Pagination/filter/sort server-side | `DONE` | Task list có pagination, filter và sort server-side bằng allow-list field; UI có search/filter/pagination/sort và smoke test dữ liệu thật. |
| Không N+1 | `PARTIAL` | Prisma include chính có; cần audit khi mở rộng report. |
| OpenAPI/Swagger | `DONE` | `/docs`. |
| Upload file an toàn | `DONE` | Có, gồm attachment task/workflow và avatar profile với MIME/size/safe filename/storage key. |
| Refresh token | `DONE` | Backend + frontend auto refresh, liệt kê phiên, thu hồi từng phiên, logout-all và đổi mật khẩu thu hồi sessions có audit. |
| Device token push registration | `DONE` | API/table có. |

## 12. Seed data

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Admin, manager, ít nhất 4 nhân viên, 2 phòng ban | `DONE` | Seed có. |
| Task nhiều trạng thái | `DONE` | Seed có. |
| Payment và leave workflows | `DONE` | Seed có. |
| Hồ sơ pending/approved/rejected/request info | `DONE` | Seed có pending, approved, rejected và request-info/`NEEDS_INFO`; request-info được tạo bằng service submit + action `REQUEST_INFO`, đã chạy lại `pnpm docker:seed` và query DB xác nhận. |
| Demo UI nâng cao >100 records, long names, nhiều comment/subtask/parallel workflow | `DONE` | Seed có 105 user stress, phòng ban nhiều cấp, task tên dài/nhiều assignee/tag/comment/quá hạn, task cha-con tự tính tiến độ và workflow song song `STRESS_PARALLEL` với 3 approval pending. |

## 13. Kiểm thử

| Nhóm test | Trạng thái | Ghi chú |
| --- | --- | --- |
| Task domain: tạo, quyền, progress, review, redo, overdue | `PARTIAL` | Domain tests có 5; smoke API/UI bổ sung progress, review, redo reset theo setting và overdue. Cần integration tests đầy đủ hơn. |
| Workflow: submit, sequential, parallel, reject, request info, branch, idempotency, version lock, transaction failure | `PARTIAL` | Domain tests có thêm validate form data + smoke API/UI nhiều luồng. Chưa có integration transaction failure tự động. |
| Permission scopes admin/manager/employee/approver | `PARTIAL` | Smoke có một số 403. Cần automated integration suite. |
| UI tests validation/navigation/responsive/dark/offline/upload | `PARTIAL` | Playwright smoke phủ login, accessibility landmark/ARIA cơ bản, mobile bottom nav viewport, mobile task filter bottom sheet, offline banner, global search mở task/workflow/user, dashboard department stats, deadline scheduler, user edit, department edit, team create/update, task catalog/tag management, auto-code settings, role preview, tạo workflow template bằng builder có default/options/validation rule, compare workflow versions, tạo workflow instance bằng form động, task upload/download/download audit/reply/comment notification, calendar start/due, kanban confirm, pagination/sort/row action, progress, evaluation attachment, redo reset, workflow action attachment, approved notification, approve/reject/request-info/return/transfer và idempotency. Chưa có suite đầy đủ cho validation, dark và responsive matrix. |
| Browser/device matrix Chrome/Edge/Android/iOS/Windows desktop | `PARTIAL` | Windows desktop build và Android arm64 APK build đã pass. Chưa QA cài/chạy trên thiết bị Android, chưa có Edge/iOS/macOS matrix. |

## 14. Triển khai

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| `.env.example` | `DONE` | Có. |
| Migration | `DONE` | Có `0001_init` và `0002_workflow_attachments`; Docker deploy đã tạo bảng `workflow_attachments`. |
| Seeder | `DONE` | Có. |
| Script khởi tạo | `DONE` | `init:dev`, Docker scripts. |
| Dockerfile + Docker Compose app/database | `DONE` | Build/run đã fix và QA. |
| Hướng dẫn Docker/dev/prod/backup | `DONE` | README có. Cần cập nhật checklist link và note Docker hiện đã chạy được. |
| Docker resource cleanup command | `DONE` | Thêm `pnpm docker:clean` để dọn build cache an toàn và `pnpm docker:compact` để compact `docker_data.vhdx` trên Windows PowerShell Admin; đã dọn cache local từ `14.22GB` xuống `0B` trước khi rebuild. |
| Health-check endpoint | `DONE` | `/health`. |
| CI pipeline lint/test/build | `DONE` | GitHub Actions có job `verify` chạy install/prisma generate/lint/typecheck/test/build và job `smoke-web` chạy Docker Compose seed + Playwright smoke. |

## 15. Cách làm việc và tiêu chí hoàn thành

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Thứ tự làm việc 1-14 theo yêu cầu | `PARTIAL` | Đã làm nhiều bước; tiếp tục theo checklist này. |
| Sau mỗi lần sửa cập nhật checklist | `DONE` | Bắt đầu từ file này; mọi commit sau phải cập nhật. |
| Không còn lỗi lint/type-check/test/build trước khi báo xong | `DONE` | Đang duy trì sau các commit gần nhất. |
| Báo cáo file tạo/chỉnh sửa sau mỗi lượt | `DONE` | Đã báo trong final; tiếp tục giữ. |

## 16. Đa nền tảng

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Một backend API/database dùng chung | `DONE` | Có. |
| Web responsive | `PARTIAL` | Có; cần polish sâu mobile. |
| Windows app chạy bằng Tauri | `PARTIAL` | Đã build `.exe`, MSI và NSIS setup. Chưa QA mở app desktop, auto-update, notification/deep link. |
| Android/iOS app build | `PARTIAL` | Android Tauri project đã init, Android arm64 unsigned APK đã build lại cho test qua API `8099` và có cấu hình API URL runtime ở login. iOS vẫn `WAITING` vì cần macOS/Xcode và signing assets. |
| Secure token storage native | `TODO` | Web dùng sessionStorage; native secure storage adapter chưa triển khai. |
| Push notification Android/iOS/PC | `PARTIAL` | Backend device token table/API có; adapter thật chưa. |
| Offline draft/retry network weak | `PARTIAL` | Task draft + online/offline state có; queue retry an toàn chưa đủ. |
| Camera/mobile file picker/compression/progress/cancel/retry | `PARTIAL` | Web file picker task có. Native camera/compression/progress/cancel chưa. |
| Build docs web/Windows/Android/iOS | `PARTIAL` | README có lệnh web port `8099`, Windows/Android arm64 workaround, tham số `-ApiUrl` cho APK test và iOS macOS note. Vẫn thiếu signing Android, Apple cert, push config phát hành thật. |

## 17. UI/UX tổng thể

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Nguyên tắc thiết kế admin hiện đại, nhất quán | `PARTIAL` | UI có sidebar/topbar/cards/forms; cần chuẩn hóa component library riêng. |
| Design system tokens/typography/spacing/components | `PARTIAL` | CSS variables/component classes có; đã tách UI primitives chung sang `components/common.tsx`. Chưa có tài liệu design system đầy đủ. |
| Màu trạng thái nhất quán | `PARTIAL` | Status labels/chips có; cần audit toàn app. |
| Bố cục PC/web: sidebar/header/main/breadcrumb | `DONE` | Có. |
| Header/account/notification/search | `DONE` | Header có account/profile/session device, topbar notification mở trang thông báo riêng có unread badge/đánh dấu đã đọc và global search debounce theo quyền backend cho task/workflow/user. |
| Loading/empty/error/offline state | `DONE` | Loading dùng skeleton chung, empty/error state có component và thông báo mất kết nối có offline banner rõ trên mọi viewport kèm smoke test. |

## 18. Dashboard nâng cao

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Dashboard cá nhân | `PARTIAL` | Có dashboard chung theo quyền; chưa phân layout riêng sâu. |
| Dashboard quản lý | `PARTIAL` | Scope dữ liệu có một phần; chưa layout quản lý riêng. |
| Dashboard quản trị | `PARTIAL` | Admin thấy toàn hệ thống; chưa widget quản trị riêng. |
| Biểu đồ và bộ lọc | `DONE` | Dashboard có filter server-side theo phòng ban/khoảng ngày và biểu đồ thanh tỷ lệ cho thống kê trạng thái/phòng ban từ DB thật. |

## 19. UI quản lý công việc nâng cao

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Danh sách công việc đầy đủ columns/action/filter/sort/pagination | `DONE` | Có list đủ cột chính, filter nâng cao, pagination UI, sort server-side và action nhanh Mở/Bắt đầu-Tiếp tục trên từng hàng; smoke test assert PATCH trạng thái thật. |
| Bộ lọc nâng cao | `DONE` | Task list có filter nâng cao keyword/code/status/creator/assignee/manager/department/priority/date range/overdue/category/tag, sort/reset, mobile bottom sheet và smoke server-side filter. |
| Tạo task chia nhóm/tệp/liên kết/cấu hình nâng cao | `PARTIAL` | Form nhóm cơ bản có. |
| Chi tiết task có khu vực chính/panel/thanh thao tác/timeline | `PARTIAL` | Có overview/progress/comment/file/history. Cần layout detail nâng cao/tabs. |
| Timeline task đầy đủ thay đổi trạng thái/người/hạn/progress | `PARTIAL` | Progress history có; status/user/due logs chưa đầy đủ UI. |
| Đánh giá task form chuẩn 1-5 sao/attachment | `DONE` | Panel đánh giá có accept/redo, 1-5 sao, nhận xét/lý do, tệp xác nhận, loading/error và smoke test upload attachment trong evaluation. |
| Kanban/lịch hoàn thiện | `PARTIAL` | Có cơ bản. |

## 20. Trình thiết kế quy trình trực quan

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Canvas kéo thả workflow | `TODO` | Chưa có. |
| Node start/form/task/approval/condition/parallel/notification/wait/create task/end | `PARTIAL` | Backend model step/transition có; UI node trực quan chưa. |
| Panel cấu hình node | `TODO` | Chưa có. |
| Cấu hình đường nối/condition builder | `PARTIAL` | Backend structured conditions có; UI builder cấu hình điều kiện chuyển sang bước kế tiếp cơ bản. Chưa có canvas đường nối kéo thả. |
| Kiểm tra quy trình/lỗi | `PARTIAL` | Backend validation cơ bản; UI checker chưa. |
| Preview quy trình | `DONE` | Builder có preview form và flow trước khi lưu: fields/default/validation/options, steps/resolver/rule/SLA/condition và end node, có smoke test UI. |
| Quản lý phiên bản visual | `PARTIAL` | Backend version có; UI chưa. |

## 21. Form builder kéo thả

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Layout trái/giữa/phải | `TODO` | Chưa có builder kéo thả. |
| Loại trường đầy đủ | `PARTIAL` | Backend enum có; UI builder chọn được các loại field chính. |
| Bố cục section/tab/grid/table | `TODO` | Chưa có UI builder. |
| Cấu hình field/validation/default/placeholder | `PARTIAL` | UI có required/placeholder/order cơ bản; validation/default nâng cao chưa có. |
| Điều kiện hiển thị/calculated field/repeating table | `TODO` | Chưa có. |
| Field permission theo step/role | `PARTIAL` | DB có; enforcement/UI chưa đầy đủ. |
| Preview PC/mobile | `DONE` | Workflow builder có segmented control PC/Mobile; mobile preview co về khung 390px, desktop giữ hai cột, có smoke test chuyển thiết bị trước khi lưu template. |

## 22. UI xử lý hồ sơ quy trình

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Danh sách hồ sơ | `DONE` | Có. |
| Khởi tạo hồ sơ bằng form động | `PARTIAL` | JSON/form đơn giản; cần render dynamic fields. |
| Chi tiết hồ sơ nội dung/panel quy trình/action bar | `PARTIAL` | Có detail/history/action cơ bản. |
| Hộp thoại duyệt/từ chối/yêu cầu bổ sung | `DONE` | Có panel xác nhận trong app với textarea ý kiến, validation, loading và thông báo kết quả. |
| Lịch sử phê duyệt | `DONE` | Có. |
| Sơ đồ theo dõi quy trình | `DONE` | Chi tiết hồ sơ có flow tracker từ dữ liệu thật `workflowVersion.steps/transitions` và runtime `steps/approvals`, hiển thị bước đã xong/đang xử lý/cần chú ý, người đang chờ, SLA và nhánh chuyển tiếp. |

## 23. Trung tâm cấu hình hệ thống

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Cấu hình chung | `PARTIAL` | Key/value settings có. |
| Mã tự động | `DONE` | Task và workflow instance code đọc prefix/padding từ `system_settings`, có seed default, UI panel Cấu hình và smoke test tạo dữ liệu thật theo cấu hình. |
| Cấu hình công việc | `DONE` | Setting redo reset được enforce trong service và có panel riêng `Cấu hình công việc` trong Settings để bật/tắt bằng checkbox, smoke redo-reset dùng UI panel này. |
| Cấu hình quy trình | `DONE` | Settings có panel riêng cho auto activate template, SLA/reminder/mode/rule mặc định; seed có default và workflow builder áp dụng vào bước đầu/bước mới, có smoke test UI/API. |
| Ngày làm việc/ngày nghỉ/SLA | `PARTIAL` | Có cấu hình SLA/reminder mặc định cho bước quy trình; chưa có lịch ngày làm việc/ngày nghỉ và logic bỏ cuối tuần/ngày lễ. |
| Cấu hình tệp | `DONE` | Upload task/workflow đọc size/MIME từ `system_settings`, có default seed, API `/upload-config`, UI task dùng cấu hình thật để validate/accept và trang Cấu hình có panel `Tệp upload` kèm smoke test. |
| Cấu hình thông báo/email/bảo mật/backup | `DONE` | Trang Cấu hình có panel vận hành cho in-app/push/email, SMTP, bảo mật đăng nhập và backup; seed mặc định lưu trong `system_settings`, có audit và smoke test UI/API. |

## 24. Danh mục và dữ liệu dùng chung

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Task categories/tags | `DONE` | Có seed/list, CRUD API có RBAC `task.update_any`, validation, audit log, soft delete và trang UI `Danh mục` để tạo/sửa/xóa category/tag kèm smoke test. |
| Danh mục tùy chỉnh có fields/status/scope/manager | `TODO` | Chưa có. |
| Dùng danh mục tùy chỉnh làm nguồn select trong form builder | `TODO` | Chưa có. |

## 25. Người dùng và tổ chức nâng cao

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Sơ đồ tổ chức tree/org/list | `DONE` | Trang Phòng ban có panel sơ đồ tổ chức dạng tree/list responsive, lấy dữ liệu thật từ department/user/team và click node để chọn phòng ban. |
| Kéo chuyển phòng ban | `TODO` | Chưa có. |
| User profile đầy đủ | `DONE` | Hồ sơ cá nhân đã có tự xem/sửa họ tên, phone, chức danh, upload avatar, đổi mật khẩu, xem phòng ban/quản lý/nhóm/vai trò/timestamps, timeline hoạt động gần đây và task/workflow liên quan từ DB thật. |
| Thiết bị đăng nhập/hoạt động gần đây/task/workflow liên quan | `DONE` | Menu tài khoản có danh sách phiên đăng nhập, thu hồi từng thiết bị và đăng xuất tất cả; profile có timeline hoạt động gần đây, công việc liên quan, hồ sơ tôi tạo và hồ sơ chờ tôi phê duyệt. |
| Import user Excel/CSV với preview/transaction/errors | `TODO` | Chưa có. |

## 26. Ma trận vai trò và phân quyền

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Quyền chức năng dạng ma trận | `PARTIAL` | Đã có ma trận theo nhóm quyền/từng permission code, preview scope và warning rule cơ bản. Chưa có ma trận module x action nâng cao và rule kế thừa/phụ thuộc quyền bắt buộc. |
| Chọn toàn hàng/cột, copy role, reset, unsaved changes | `DONE` | Có chọn toàn bộ, chọn theo nhóm, sao chép quyền từ vai trò khác, khôi phục và cảnh báo thay đổi chưa lưu; QA browser pass. |
| Phạm vi dữ liệu theo quyền | `PARTIAL` | Một số scope hard-coded theo permissions; chưa model cấu hình scope. |
| Quyền theo trường | `TODO` | Chưa có. |
| Preview quyền | `PARTIAL` | Có preview phạm vi task/workflow/system/audit theo permission code trong trang Vai trò. Chưa có giả lập theo từng user/dữ liệu cụ thể. |
| Cảnh báo xung đột quyền | `PARTIAL` | Có cảnh báo cơ bản khi manage thiếu read hoặc quyền liên quan chưa đủ. Chưa có rule engine đầy đủ/phụ thuộc quyền bắt buộc. |

## 27. Báo cáo và phân tích

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Báo cáo công việc | `PARTIAL` | Dashboard counts/groupBy trạng thái và phòng ban có. Module report riêng, drill-down/export chưa. |
| Báo cáo quy trình | `PARTIAL` | Recent/count cơ bản. Module report riêng chưa. |
| Bộ lọc báo cáo | `DONE` | Trang `Báo cáo` gọi API `/reports/summary` và lọc server-side theo phòng ban, trạng thái công việc, ưu tiên, trạng thái hồ sơ và khoảng ngày trong phạm vi quyền backend. |
| Drill-down | `DONE` | Report charts mở bảng chi tiết qua API `/reports/drilldown` có pagination, áp đúng filter hiện tại và scope quyền backend; smoke test kiểm drill-down từ chart ưu tiên về task thật. |
| Export Excel/CSV/PDF/print theo quyền + audit | `PARTIAL` | Đã có export CSV và Excel `.xlsx` qua API `/reports/export.*` theo filter/scope quyền, audit `report.export.csv`/`report.export.xlsx`, UI tải CSV/Excel và in bằng print stylesheet; chưa có PDF native. |
| Dashboard tùy chỉnh | `TODO` | Chưa có. |

## 28. Mobile

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Bottom navigation | `DONE` | Mobile bottom nav ưu tiên Tổng quan/Công việc/Tạo dạng FAB/Duyệt/Thông báo/Cá nhân, có unread badge, `aria-current` và smoke test viewport mobile. |
| Mobile cards cho list | `DONE` | DataTable chuyển card trên mobile. |
| Mobile filter bottom sheet/fullscreen/drawer | `DONE` | TaskList dùng bottom sheet trên viewport nhỏ, có backdrop, nút đóng/áp dụng, khóa cuộn nền, Escape, `role=dialog` và smoke test lọc bằng API thật. |
| Detail mobile chia section/tab | `PARTIAL` | Có section tuần tự; chưa tabs/section navigation chuyên biệt. |
| Approval mobile thao tác một tay, nút cách xa, confirm/reason | `PARTIAL` | Có confirm/prompt; cần UI mobile riêng. |
| Swipe actions | `DONE` | Mobile task cards có action rail dạng swipe với nút `Mở`/`Bắt đầu`/`Tiếp tục`; smoke test viewport mobile kiểm action rail và mở đúng chi tiết công việc. |
| Camera/file preview/compress/progress/cancel/retry | `PARTIAL` | File picker/upload có; camera/compress/progress/cancel/retry chưa. |

## 29. Trợ năng và khả năng sử dụng

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Keyboard navigation/focus/tab order | `PARTIAL` | Native buttons/forms có; cần audit focus states/tab order. |
| Tooltip icon | `PARTIAL` | `title` có ở nhiều icon; tooltip custom chưa. |
| Form labels đầy đủ | `PARTIAL` | Phần lớn có label. Cần audit dynamic forms. |
| Không phụ thuộc hoàn toàn màu sắc | `PARTIAL` | Có text labels/status. Cần audit charts/status. |
| Screen reader cơ bản | `DONE` | App shell có skip link, landmark labels, `aria-current`, trạng thái kết nối `role=status`, lỗi `role=alert`, dialog phiên đăng nhập và smoke test bằng role selectors. |
| Không vỡ chữ dài, zoom/system text | `PARTIAL` | CSS responsive có; cần QA stress long text. |

## 30. Hiệu năng giao diện

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Không tải toàn bộ dữ liệu lớn | `PARTIAL` | API pagination có; task list dùng pageSize 10 và pagination UI. Một số UI khác vẫn dùng pageSize 100. |
| Debounce search | `DONE` | TaskList debounce từ khóa và mã công việc 350ms bằng hook dùng chung `useDebouncedValue`; smoke filter/pagination/sort vẫn pass. |
| Lazy load tab | `DONE` | Các trang authenticated chính được code splitting bằng `React.lazy`/`Suspense`, fallback về skeleton loading chung khi tải chunk. |
| Cache danh mục | `DONE` | Frontend có cache in-memory TTL ngắn cho dữ liệu nền dùng lại ở form/filter/admin; tự invalidation khi đổi API URL/session hoặc mutate user/department/team/role, có unit test. |
| Upload/import/export không treo UI, progress task dài | `PARTIAL` | Loading/busy có; upload progress/cancel chưa. |
| Skeleton loading | `DONE` | `LoadingBlock` dùng chung đã chuyển thành skeleton card/list responsive có shimmer và accessibility state, áp dụng cho dashboard/task/workflow/admin/profile qua component chung. |
| Workflow designer 100 nodes mượt | `TODO` | Chưa có designer. |

## 31. Kiểm thử UI và trải nghiệm

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Form validation/navigation/permission display | `PARTIAL` | Một số QA browser thủ công; chưa automated. |
| Create task/progress/approval/reject/upload duplicate action | `PARTIAL` | Playwright smoke đã phủ login, profile self-service/avatar/password change/activity timeline/task-workflow related, session device revoke/logout-all, dashboard department stats, deadline scheduler, user edit, department edit, team create/update, role permission preview, tạo task qua UI kèm assigner/parent/related/attachment, auto progress parent từ child, tạo task qua API, mở detail UI, upload/download attachment/download audit, reply comment/comment notification, calendar start/due, kanban confirm, pagination/sort/row action, cập nhật progress, đánh giá hoàn thành task kèm tệp xác nhận, yêu cầu làm lại reset progress theo setting, workflow action attachment, approved notification, approve/reject/request-info/return/transfer workflow và idempotency key. Còn thiếu double-click UI cụ thể và responsive/offline action tests. |
| Form builder/workflow designer/draft/dark/responsive/offline | `PARTIAL` | Draft/dark/offline cơ bản; smoke có tạo template bằng builder động, default/options/validation rule và tạo hồ sơ bằng form động. Canvas designer, responsive/offline matrix và builder nâng cao chưa có. |
| Chrome/Edge/Android/iOS/Windows desktop matrix | `PARTIAL` | Chrome/browser web đã QA nhiều lần, Windows installer và Android arm64 APK build pass. Chưa QA Edge, thiết bị Android thật/emulator, iOS/macOS. |

## 32. Dữ liệu demo UI

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Task tên dài, nhiều assignee, nhiều tags, quá hạn, nhiều comment | `DONE` | Seed idempotent tạo task stress có tiêu đề dài, 4 người thực hiện, 3 nhãn, hạn đã qua, progress 20 và 8 comment/reply/mention để QA layout. |
| Task con | `DONE` | Seed idempotent tạo task cha `Demo task cha: Chuẩn bị họp giao ban` và hai task con 50/100%, parent bật auto progress nên tự ra 75%. |
| Workflow form dài/bảng nhiều dòng/nhiều nhánh/parallel | `PARTIAL` | Branch có ở backend và builder điều kiện cơ bản; form dài/parallel seed chưa. |
| User tên dài, phòng ban nhiều cấp, >100 records | `DONE` | Seed idempotent có 3 phòng ban nhiều cấp `STRESS-L1/L2/L3` và 105 user stress cũ ngày, gồm một user tên/chức danh rất dài để QA bảng/thẻ mobile/menu chọn nhân sự. |

## 33. Quy trình phát triển UI

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Design system/layout/component library | `PARTIAL` | Đã có common components, hook chung, page modules `tasks/workflows/admin`, layout shell/navigation và shared status/date helpers. Còn thiếu docs component library và UI primitives nâng cao như modal/sheet/skeleton/file picker chuẩn. |
| Wireframe màn chính | `PARTIAL` | Implemented screens đóng vai trò prototype; chưa có wireframe doc. |
| Prototype workflow designer/form builder | `TODO` | Chưa có. |
| Kiểm tra responsive trước khi hoàn thiện module | `PARTIAL` | Đã QA một số mobile, cần matrix. |
| Không thiết kế màn riêng lẻ thiếu component chung | `PARTIAL` | UI primitives/hook chung, layout shell, navigation, shared formatters và page modules đã tách khỏi `App.tsx`; còn cần gom thêm form/table/modal patterns thành component dùng lại sâu hơn. |

## 34. Tiêu chí hoàn thành UI, cấu hình và trình thiết kế

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Design system rõ ràng/UI nhất quán/light-dark/responsive/card mobile/loading-empty-error-offline | `PARTIAL` | Có nền tảng, cần tài liệu và audit. |
| Workflow designer kéo thả, node, mũi tên, panel, condition, validate, draft, publish version | `PARTIAL` | Chưa có canvas designer; đã có builder condition cơ bản cho transition tuần tự. |
| Form builder kéo thả, section/tab/condition/field permission/preview PC-mobile | `PARTIAL` | Có builder động cơ bản cho field/step khi tạo template. Chưa có kéo thả, section/tab, condition, field permission và preview PC/mobile. |
| Configuration center, auto code, working days/SLA | `PARTIAL` | Settings cơ bản; center nâng cao chưa. |
| Permission matrix, data scope, dashboard role-based | `PARTIAL` | Ma trận quyền, preview quyền/cảnh báo cơ bản và dashboard theo quyền đã có; data scope nâng cao/field permission chưa có cấu hình riêng. |
| Reports, drill-down, export theo quyền | `TODO` | Chưa có. |
| Audit config changes | `DONE` | `/system-settings` ghi audit trong transaction kèm metadata trước/sau và redact value cho key nhạy cảm; smoke API xác nhận không lộ secret trong log. |
| Không còn responsive/lint/type-check/test/build errors | `PARTIAL` | Chunk skeleton loading đã pass `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build web` và `pnpm smoke:web` 30/30. Responsive vẫn cần QA sâu trên thiết bị thật/Edge/iOS. |

## Việc ưu tiên tiếp theo

1. `DONE` Cập nhật `ARCHITECTURE.md` theo các mục UI/config/report mới từ yêu cầu 17-34.
2. `DONE` Cập nhật README link checklist và note trạng thái Docker hiện đã chạy được.
3. `DONE` Tách frontend component system cơ bản khỏi `App.tsx`: common UI primitives và `useAsyncData` đã tách; page-level components sẽ tách theo từng module sau.
4. `PARTIAL` Hoàn thiện quản trị user/department/role permission theo hướng ma trận cơ bản: role permission matrix đã có, user/department advanced và scope quyền còn thiếu.
5. `DONE` Thêm Playwright/UI smoke tests cho login, task detail upload/download và workflow approval tuần tự; còn mở rộng thêm progress/reject/responsive/offline ở các lượt sau.
6. `DONE` Mở rộng Playwright smoke cho progress, reject, request-info và idempotency key chống duyệt trùng.
7. `DONE` Nâng GitHub Actions CI để chạy verify và Docker web smoke.
8. `DONE` Tách tiếp page-level components theo module `tasks`, `workflows`, `admin`: đã có `apps/web/src/pages/tasks.tsx`, `apps/web/src/pages/workflows.tsx`, `apps/web/src/pages/admin.tsx`.
9. `PARTIAL` Hoàn thiện user/department advanced UI và data scope/field permission: user detail/edit và department detail/edit phân cấp đã có; data scope và field permission còn thiếu.
10. `DONE` Tách tiếp layout/auth/dashboard/shared labels khỏi `App.tsx`: đã có `components/layout.tsx`, `pages/auth.tsx`, `pages/dashboard.tsx`, `navigation.ts`, `lib/format.ts`.
11. `TODO` Mở rộng user/department advanced UI, data scope/field permission, rồi bắt đầu workflow designer/form builder trực quan.
