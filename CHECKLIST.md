# WorkFlow Management System - Checklist triển khai

File này là nguồn theo dõi trạng thái chính của dự án. Sau mỗi lần sửa code, tài liệu, migration, seed, Docker hoặc UI, phải cập nhật file này trong cùng commit.

## Quy ước trạng thái

- [x] `DONE`: đã triển khai, đã kiểm tra, không còn việc bắt buộc ngay trong phạm vi hiện tại.
- [ ] `PARTIAL`: đã có một phần chạy được, còn thiếu chức năng/QA/test/tài liệu.
- [ ] `TODO`: chưa triển khai.
- [ ] `WAITING`: chờ môi trường, tài khoản, chứng chỉ, thiết bị hoặc quyết định triển khai.
- [ ] `BLOCKED`: đang bị chặn bởi lỗi hoặc thiếu điều kiện không thể tự xử lý.

## Cập nhật gần nhất

**Tiến độ hiện tại:** `DONE=81`, `PARTIAL=140`, `TODO=39`, `WAITING=0`, `BLOCKED=0`, `TOTAL=260`; hoàn thành nghiêm ngặt `31.2%`, tính trọng số partial `58.1%`.

| Ngày | Commit | Nội dung | Kiểm tra |
| --- | --- | --- | --- |
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
| Đăng nhập và quản lý tài khoản | `PARTIAL` | Login/refresh/logout/users create/edit profile/roles/status có. Chưa có trang hồ sơ cá nhân đầy đủ, thiết bị đăng nhập UI, import user. |
| Phòng ban và cơ cấu tổ chức | `PARTIAL` | Departments create/edit/detail, parent department, list phân cấp cha-con và quản lý nhóm làm việc có; backend chống vòng lặp parent và validate team member. Company/branch UI, sơ đồ tổ chức kéo thả chưa có. |
| Vai trò và phân quyền | `PARTIAL` | RBAC tables/API, ma trận quyền, preview phạm vi dữ liệu và cảnh báo cấu hình quyền cơ bản có. Chưa có data scope/field permissions có cấu hình riêng. |
| Thông báo | `PARTIAL` | Notification center/inbox/device token table có. Chưa có push adapter FCM/APNs/Desktop thật và lịch nhắc hạn. |
| Bình luận và tệp đính kèm | `PARTIAL` | Comment, mention list, upload/download attachment cho task có. Reply comment, lịch sử chỉnh sửa comment, attachment cho workflow approval còn thiếu. |
| Nhật ký hoạt động | `PARTIAL` | Audit log cho nhiều hành động chính có. Cần phủ thêm import/export/config/download/xóa tệp. |
| Dashboard và báo cáo cơ bản | `PARTIAL` | Dashboard thật từ DB có. Module báo cáo riêng, drill-down/export chưa có. |
| Cấu hình hệ thống | `PARTIAL` | Key/value settings có. Chưa có trung tâm cấu hình đầy đủ theo nhóm. |

## 3. Người dùng, phòng ban và RBAC

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| User fields: mã NV, họ tên, email, phone, password, avatar, title, department, manager, status, created, last login | `PARTIAL` | Schema/API có phần lớn; UI tạo/chỉnh user đã hỗ trợ phone/title/department/manager/status/roles và hiển thị created/last login. Avatar/profile/devices chưa hoàn thiện. |
| Company, branch, department, team, title, direct manager | `PARTIAL` | Schema có company/branch/team/departments; UI user/department/team đã có chỉnh trực tiếp, parent department và manager. Company/branch UI nâng cao chưa có. |
| Một người thuộc một phòng ban chính và nhiều nhóm | `DONE` | Schema `team_members`, API `/teams`, user create/edit `teamIds`, UI quản lý nhóm và smoke test tạo/cập nhật thành viên nhóm đã có. |
| Vai trò mặc định admin/manager/employee/watcher | `DONE` | Seed tạo các vai trò mặc định. |
| RBAC linh hoạt, không hard-code theo tên vai trò | `DONE` | Backend kiểm permission code; role name không hard-code policy chính. |
| Manager xem nhân viên trực thuộc | `PARTIAL` | Scope task theo direct report có. Cần mở rộng workflow/report/user profile. |
| Backend kiểm quyền, không chỉ ẩn nút | `DONE` | Route preHandler/policy/service kiểm quyền. |

## 4. Công việc thường

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Mã công việc tự sinh | `DONE` | `TASK-YYYYMMDD-XXXX`. |
| Form tạo task: title, mô tả, assigner, assignee, manager, follower, department, start/due, priority, category, tags, review | `DONE` | UI/API có. |
| Người giao việc | `DONE` | Backend có `assignerId`; UI form tạo task đã có select Người giao việc, lưu draft và smoke test assert API lưu đúng. |
| Tệp đính kèm khi tạo task | `DONE` | Form tạo task chọn nhiều file, validate MIME/dung lượng, upload sau khi tạo task và smoke test kiểm tra attachment trong detail API/UI. |
| Công việc cha/con | `PARTIAL` | Schema/service chống vòng lặp có; UI tạo parent/subtask còn thiếu. |
| Công việc liên quan/phụ thuộc | `PARTIAL` | Schema/API create relatedTaskIds có; UI chưa có. |
| Lặp lại ngày/tuần/tháng | `PARTIAL` | Field/schema có; scheduler sinh task lặp chưa có UI/logic đầy đủ. |
| Custom fields | `PARTIAL` | JSON field có; UI cấu hình custom field chưa có. |
| Validation ngày bắt đầu <= hạn | `DONE` | Backend kiểm. |
| Audit log khi tạo/sửa task | `DONE` | Có audit log create/update/progress/evaluate/comment/attachment. |
| Trạng thái mặc định, quá hạn tính động | `DONE` | `displayStatus=OVERDUE` tính động ở list/dashboard/detail. |
| Cập nhật tiến độ 0-100, ghi chú, lịch sử | `DONE` | API/UI/history có. |
| 100% -> chờ đánh giá hoặc hoàn thành | `DONE` | Domain/service/test có. |
| Đánh giá hoàn thành/làm lại, rating, comment | `PARTIAL` | API có rating/comment; UI đã có panel đánh giá với accept/redo, 1-5 sao và nhận xét/lý do. Attachment xác nhận riêng cho evaluation còn thiếu. |
| Làm lại giữ/reset tiến độ theo cấu hình | `PARTIAL` | Setting seed có nhưng service hiện giữ tiến độ, chưa áp config reset. |
| Tiến độ task cha từ task con | `PARTIAL` | Schema flag/subTaskProgress có; auto recalc chưa đầy đủ. |
| Comment, mention, attachment | `PARTIAL` | Comment/mention IDs/attachment upload có. Reply, `@` autocomplete văn bản, edit history còn thiếu. |
| List view | `DONE` | Có list/mobile cards với mã, tên, trạng thái, tiến độ, người thực hiện, người giao, phòng ban, ưu tiên, ngày bắt đầu, hạn hoàn thành và số ngày còn/quá hạn. |
| Kanban view, kéo thả | `PARTIAL` | Có drag/drop status cơ bản. Cần policy UX/confirm đầy đủ và QA desktop. |
| Calendar view | `PARTIAL` | Có nhóm theo dueDate; chưa hiển thị theo start + due dạng calendar chuẩn. |
| Công việc của tôi với đủ tabs | `DONE` | Có đủ 7 tab: Tôi thực hiện, Tôi giao, Tôi quản lý, Tôi theo dõi, Chờ tôi đánh giá, Đã quá hạn, Đã hoàn thành; filter phía server và smoke test. |
| Tìm kiếm/lọc server-side đầy đủ | `DONE` | UI có keyword, code, status, creator, assignee, manager, department, priority, due range, overdue, category và tag; tất cả nối query API server-side và có smoke test. |
| Phân trang server-side | `DONE` | API paginate có. UI chưa có điều khiển trang đầy đủ. |

## 5. Quy trình phê duyệt

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Workflow template fields: code/name/description/category/version/manager/allowed initiators/status | `PARTIAL` | Code/name/category/manager/version/status có; allowed initiators chưa có UI/policy đầy đủ. |
| Form field types đầy đủ | `PARTIAL` | Schema enum có nhiều type; UI builder tạo template đã chọn được các loại field chính. New instance vẫn nhập JSON, chưa render form động đầy đủ. |
| Field config required/default/placeholder/validation/order/editable/visible roles | `PARTIAL` | UI builder đã có required/placeholder/order cơ bản. Default/validation/editable/visible roles còn thiếu UI đầy đủ. |
| Step types start/handler/approval/review/notification/end | `DONE` | Enum/schema/API có. |
| Assignee resolver theo user/role/department/manager/head/form field/previous | `DONE` | Service resolver có. |
| Sequential approval | `DONE` | API/service/test/smoke pass. |
| Parallel approval all/any/min count/min percent | `DONE` | Service tạo pending approval song song, domain test phủ `MIN_COUNT/MIN_PERCENT`, UI builder chọn `PARALLEL` và đủ `ALL/ANY/MIN_COUNT/MIN_PERCENT`, smoke test assert cấu hình min count được lưu. |
| Approve/reject/request info/return | `DONE` | API/UI/smoke pass; UI có panel xác nhận trong app thay cho browser prompt. |
| Forward/chuyển xử lý | `DONE` | Có action `TRANSFER`, chọn người nhận xử lý trên UI, chuyển pending approval trong transaction, gửi notification, lưu changedData/audit/idempotency và smoke test admin duyệt sau chuyển. |
| Approval action lưu người, thời gian, action, comment, IP | `DONE` | WorkflowApproval có fields và service ghi. |
| Lưu step trước/sau và dữ liệu thay đổi | `PARTIAL` | History approvals/steps có; metadata before/after chưa đầy đủ. |
| Điều kiện rẽ nhánh structured, không eval | `DONE` | Domain condition builder/test/smoke lớn tiền pass; workflow builder có UI điều kiện chuyển bước cơ bản. |
| Trạng thái hồ sơ đầy đủ | `PARTIAL` | Enum/status có; draft/submitted workflow chưa đủ UI/luồng. |
| Version workflow không sửa trực tiếp khi có instance | `PARTIAL` | Domain assert/test có cho status; UI tạo version mới/compare còn thiếu. |
| Compare versions | `PARTIAL` | API compare có; UI chưa có. |
| Deadline/SLA bước | `PARTIAL` | Schema có deadline fields; notify quá hạn scheduler chưa có. |

## 6. Thông báo

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Notification center trong app | `DONE` | Dashboard/notifications API có. |
| Task assigned/follower/comment/mention/pending review/redo | `PARTIAL` | Assigned/follower/mention/pending review/redo có; comment thường/sắp hạn/quá hạn scheduler chưa đủ. |
| Workflow pending/approved/rejected/request info | `PARTIAL` | Pending/rejected/request info có; approved notification cần rà thêm. |
| Step due soon/overdue notification | `TODO` | Chưa có scheduler. |
| Event-driven nội bộ để mở rộng email/Telegram/mobile | `PARTIAL` | `enqueueNotifications` và device tokens có. Adapter ngoài chưa có. |

## 7. Dashboard

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Cards theo quyền: active/pending/due soon/overdue/pending review/pending approvals/my instances | `DONE` | API/UI có dữ liệu thật. |
| Thống kê task theo trạng thái/phòng ban | `PARTIAL` | Status có UI. Department group API có nhưng UI chưa hiển thị rõ. |
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
| Không log secret | `PARTIAL` | Không chủ động log token/password; cần rà production logger/redaction. |
| Audit login/task/workflow/permission/config/download/delete file | `PARTIAL` | Nhiều hành động có. Download/delete file/config/import/export chưa phủ hết. |

## 9. Giao diện trang bắt buộc

| Trang | Trạng thái | Ghi chú |
| --- | --- | --- |
| Đăng nhập | `DONE` | Có. |
| Dashboard | `DONE` | Có. |
| Công việc của tôi | `DONE` | Có đủ 7 tab theo yêu cầu và dùng filter server-side. |
| Danh sách toàn bộ công việc | `DONE` | Có. |
| Kanban công việc | `PARTIAL` | Có cơ bản. |
| Lịch công việc | `PARTIAL` | Có dạng danh sách theo ngày. |
| Tạo công việc | `PARTIAL` | Có chính yếu, thiếu parent/related/repeat/custom/upload ngay lúc tạo. |
| Chi tiết công việc | `PARTIAL` | Có overview/progress/comment/attachments/history; thiếu tabs mobile/reply/edit history. |
| Danh sách mẫu quy trình | `DONE` | Có. |
| Tạo/chỉnh sửa mẫu quy trình | `PARTIAL` | Tạo bằng builder động cơ bản có; chỉnh sửa/version UI chưa đủ. |
| Thiết kế biểu mẫu | `PARTIAL` | Builder động cơ bản có thêm/xóa field và chọn loại field; chưa kéo thả/section/tab/permission theo step. |
| Cấu hình bước phê duyệt | `PARTIAL` | Builder động cơ bản có thêm/xóa approval step, resolver, mode/rule/deadline; chưa có panel node/canvas đầy đủ. |
| Danh sách hồ sơ quy trình | `DONE` | Có. |
| Tạo hồ sơ | `PARTIAL` | UI đã render form động theo field của template active, validate inline và submit idempotency. Còn thiếu upload workflow chuyên dụng, field option động và draft/sửa bổ sung theo từng bước. |
| Chi tiết và lịch sử phê duyệt | `PARTIAL` | Có detail/history/action cơ bản; thiếu sơ đồ theo dõi. |
| Yêu cầu chờ tôi phê duyệt | `DONE` | Có filter pendingMine. |
| Quản lý người dùng | `PARTIAL` | Có list/create/detail/edit profile/roles/status cơ bản. Chưa có profile đầy đủ, avatar, thiết bị đăng nhập, import/export. |
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
| Pagination/filter/sort server-side | `PARTIAL` | Pagination/filter có; sort tùy chọn UI/API chưa đầy đủ. |
| Không N+1 | `PARTIAL` | Prisma include chính có; cần audit khi mở rộng report. |
| OpenAPI/Swagger | `DONE` | `/docs`. |
| Upload file an toàn | `DONE` | Có. |
| Refresh token | `DONE` | Backend + frontend auto refresh. |
| Device token push registration | `DONE` | API/table có. |

## 12. Seed data

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Admin, manager, ít nhất 4 nhân viên, 2 phòng ban | `DONE` | Seed có. |
| Task nhiều trạng thái | `DONE` | Seed có. |
| Payment và leave workflows | `DONE` | Seed có. |
| Hồ sơ pending/approved/rejected/request info | `PARTIAL` | Seed có pending/approved/rejected. Request info có từ smoke runtime, chưa seed chuẩn. |
| Demo UI nâng cao >100 records, long names, nhiều comment/subtask/parallel workflow | `TODO` | Chưa có bộ seed stress UI. |

## 13. Kiểm thử

| Nhóm test | Trạng thái | Ghi chú |
| --- | --- | --- |
| Task domain: tạo, quyền, progress, review, redo, overdue | `PARTIAL` | Domain tests có 5; smoke API bổ sung. Cần integration tests đầy đủ hơn. |
| Workflow: submit, sequential, parallel, reject, request info, branch, idempotency, version lock, transaction failure | `PARTIAL` | Domain tests có thêm validate form data + smoke API/UI nhiều luồng. Chưa có integration transaction failure tự động. |
| Permission scopes admin/manager/employee/approver | `PARTIAL` | Smoke có một số 403. Cần automated integration suite. |
| UI tests validation/navigation/responsive/dark/offline/upload | `PARTIAL` | Playwright smoke phủ login, user edit, department edit, role preview, tạo workflow template bằng builder, tạo workflow instance bằng form động, task upload/download, progress, approve/reject/request-info và idempotency. Chưa có suite đầy đủ cho validation, dark, offline và responsive matrix. |
| Browser/device matrix Chrome/Edge/Android/iOS/Windows desktop | `PARTIAL` | Windows desktop build và Android arm64 APK build đã pass. Chưa QA cài/chạy trên thiết bị Android, chưa có Edge/iOS/macOS matrix. |

## 14. Triển khai

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| `.env.example` | `DONE` | Có. |
| Migration | `DONE` | Có `0001_init`. |
| Seeder | `DONE` | Có. |
| Script khởi tạo | `DONE` | `init:dev`, Docker scripts. |
| Dockerfile + Docker Compose app/database | `DONE` | Build/run đã fix và QA. |
| Hướng dẫn Docker/dev/prod/backup | `DONE` | README có. Cần cập nhật checklist link và note Docker hiện đã chạy được. |
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
| Android/iOS app build | `PARTIAL` | Android Tauri project đã init, Android arm64 unsigned APK đã build. iOS vẫn `WAITING` vì cần macOS/Xcode và signing assets. |
| Secure token storage native | `TODO` | Web dùng sessionStorage; native secure storage adapter chưa triển khai. |
| Push notification Android/iOS/PC | `PARTIAL` | Backend device token table/API có; adapter thật chưa. |
| Offline draft/retry network weak | `PARTIAL` | Task draft + online/offline state có; queue retry an toàn chưa đủ. |
| Camera/mobile file picker/compression/progress/cancel/retry | `PARTIAL` | Web file picker task có. Native camera/compression/progress/cancel chưa. |
| Build docs web/Windows/Android/iOS | `PARTIAL` | README có lệnh web/Windows/Android arm64 workaround/iOS macOS note. Vẫn thiếu signing Android, Apple cert, push config phát hành thật. |

## 17. UI/UX tổng thể

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Nguyên tắc thiết kế admin hiện đại, nhất quán | `PARTIAL` | UI có sidebar/topbar/cards/forms; cần chuẩn hóa component library riêng. |
| Design system tokens/typography/spacing/components | `PARTIAL` | CSS variables/component classes có; đã tách UI primitives chung sang `components/common.tsx`. Chưa có tài liệu design system đầy đủ. |
| Màu trạng thái nhất quán | `PARTIAL` | Status labels/chips có; cần audit toàn app. |
| Bố cục PC/web: sidebar/header/main/breadcrumb | `DONE` | Có. |
| Header/account/notification/search | `PARTIAL` | Account/notification có; global search chưa. |
| Loading/empty/error/offline state | `PARTIAL` | Có state cơ bản; skeleton chưa. |

## 18. Dashboard nâng cao

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Dashboard cá nhân | `PARTIAL` | Có dashboard chung theo quyền; chưa phân layout riêng sâu. |
| Dashboard quản lý | `PARTIAL` | Scope dữ liệu có một phần; chưa layout quản lý riêng. |
| Dashboard quản trị | `PARTIAL` | Admin thấy toàn hệ thống; chưa widget quản trị riêng. |
| Biểu đồ và bộ lọc | `TODO` | Chưa có biểu đồ/bộ lọc dashboard nâng cao. |

## 19. UI quản lý công việc nâng cao

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Danh sách công việc đầy đủ columns/action/filter/sort/pagination | `PARTIAL` | Có list cơ bản. Còn thiếu nhiều cột/action/pagination UI. |
| Bộ lọc nâng cao | `TODO` | Backend có nhiều filter; UI filter nâng cao chưa. |
| Tạo task chia nhóm/tệp/liên kết/cấu hình nâng cao | `PARTIAL` | Form nhóm cơ bản có. |
| Chi tiết task có khu vực chính/panel/thanh thao tác/timeline | `PARTIAL` | Có overview/progress/comment/file/history. Cần layout detail nâng cao/tabs. |
| Timeline task đầy đủ thay đổi trạng thái/người/hạn/progress | `PARTIAL` | Progress history có; status/user/due logs chưa đầy đủ UI. |
| Đánh giá task form chuẩn 1-5 sao/attachment | `PARTIAL` | Có panel đánh giá 1-5 sao và nhận xét/lý do; attachment xác nhận trong evaluation chưa có. |
| Kanban/lịch hoàn thiện | `PARTIAL` | Có cơ bản. |

## 20. Trình thiết kế quy trình trực quan

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Canvas kéo thả workflow | `TODO` | Chưa có. |
| Node start/form/task/approval/condition/parallel/notification/wait/create task/end | `PARTIAL` | Backend model step/transition có; UI node trực quan chưa. |
| Panel cấu hình node | `TODO` | Chưa có. |
| Cấu hình đường nối/condition builder | `PARTIAL` | Backend structured conditions có; UI builder cấu hình điều kiện chuyển sang bước kế tiếp cơ bản. Chưa có canvas đường nối kéo thả. |
| Kiểm tra quy trình/lỗi | `PARTIAL` | Backend validation cơ bản; UI checker chưa. |
| Preview quy trình | `TODO` | Chưa có. |
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
| Preview PC/mobile | `TODO` | Chưa có. |

## 22. UI xử lý hồ sơ quy trình

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Danh sách hồ sơ | `DONE` | Có. |
| Khởi tạo hồ sơ bằng form động | `PARTIAL` | JSON/form đơn giản; cần render dynamic fields. |
| Chi tiết hồ sơ nội dung/panel quy trình/action bar | `PARTIAL` | Có detail/history/action cơ bản. |
| Hộp thoại duyệt/từ chối/yêu cầu bổ sung | `DONE` | Có panel xác nhận trong app với textarea ý kiến, validation, loading và thông báo kết quả. |
| Lịch sử phê duyệt | `DONE` | Có. |
| Sơ đồ theo dõi quy trình | `TODO` | Chưa có. |

## 23. Trung tâm cấu hình hệ thống

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Cấu hình chung | `PARTIAL` | Key/value settings có. |
| Mã tự động | `TODO` | Hard-coded generator hiện tại, chưa UI/config. |
| Cấu hình công việc | `PARTIAL` | Có seed setting redo reset nhưng chưa enforce đầy đủ/UI nhóm. |
| Cấu hình quy trình | `TODO` | Chưa có UI nhóm. |
| Ngày làm việc/ngày nghỉ/SLA | `TODO` | Chưa có. |
| Cấu hình tệp | `PARTIAL` | Backend env size/type hard-coded; chưa UI. |
| Cấu hình thông báo/email/bảo mật/backup | `TODO` | Chưa có trung tâm cấu hình đầy đủ. |

## 24. Danh mục và dữ liệu dùng chung

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Task categories/tags | `PARTIAL` | Seed/list dùng được; UI quản lý riêng chưa. |
| Danh mục tùy chỉnh có fields/status/scope/manager | `TODO` | Chưa có. |
| Dùng danh mục tùy chỉnh làm nguồn select trong form builder | `TODO` | Chưa có. |

## 25. Người dùng và tổ chức nâng cao

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Sơ đồ tổ chức tree/org/list | `TODO` | Chưa có. |
| Kéo chuyển phòng ban | `TODO` | Chưa có. |
| User profile đầy đủ | `TODO` | Chưa có trang hồ sơ riêng. |
| Thiết bị đăng nhập/hoạt động gần đây/task/workflow liên quan | `PARTIAL` | Backend refresh tokens/audit/task/workflow có; UI profile chưa. |
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
| Báo cáo công việc | `PARTIAL` | Dashboard counts/groupBy cơ bản. Module report riêng chưa. |
| Báo cáo quy trình | `PARTIAL` | Recent/count cơ bản. Module report riêng chưa. |
| Bộ lọc báo cáo | `TODO` | Chưa có. |
| Drill-down | `TODO` | Chưa có. |
| Export Excel/CSV/PDF/print theo quyền + audit | `TODO` | Chưa có. |
| Dashboard tùy chỉnh | `TODO` | Chưa có. |

## 28. Mobile

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Bottom navigation | `PARTIAL` | Có bottom nav 5 mục + menu mở rộng. Chưa đúng đề xuất Tổng quan/Công việc/Phê duyệt/Thông báo/Cá nhân với FAB. |
| Mobile cards cho list | `DONE` | DataTable chuyển card trên mobile. |
| Mobile filter bottom sheet/fullscreen/drawer | `TODO` | Chưa có. |
| Detail mobile chia section/tab | `PARTIAL` | Có section tuần tự; chưa tabs/section navigation chuyên biệt. |
| Approval mobile thao tác một tay, nút cách xa, confirm/reason | `PARTIAL` | Có confirm/prompt; cần UI mobile riêng. |
| Swipe actions | `TODO` | Chưa có. |
| Camera/file preview/compress/progress/cancel/retry | `PARTIAL` | File picker/upload có; camera/compress/progress/cancel/retry chưa. |

## 29. Trợ năng và khả năng sử dụng

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Keyboard navigation/focus/tab order | `PARTIAL` | Native buttons/forms có; cần audit focus states/tab order. |
| Tooltip icon | `PARTIAL` | `title` có ở nhiều icon; tooltip custom chưa. |
| Form labels đầy đủ | `PARTIAL` | Phần lớn có label. Cần audit dynamic forms. |
| Không phụ thuộc hoàn toàn màu sắc | `PARTIAL` | Có text labels/status. Cần audit charts/status. |
| Screen reader cơ bản | `TODO` | Chưa audit ARIA. |
| Không vỡ chữ dài, zoom/system text | `PARTIAL` | CSS responsive có; cần QA stress long text. |

## 30. Hiệu năng giao diện

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Không tải toàn bộ dữ liệu lớn | `PARTIAL` | API pagination có; một số UI dùng pageSize 100. |
| Debounce search | `TODO` | Chưa có. |
| Lazy load tab | `PARTIAL` | Page render theo state; chưa code splitting. |
| Cache danh mục | `TODO` | Chưa có cache layer. |
| Upload/import/export không treo UI, progress task dài | `PARTIAL` | Loading/busy có; upload progress/cancel chưa. |
| Skeleton loading | `TODO` | Chưa có skeleton, chỉ loading block. |
| Workflow designer 100 nodes mượt | `TODO` | Chưa có designer. |

## 31. Kiểm thử UI và trải nghiệm

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Form validation/navigation/permission display | `PARTIAL` | Một số QA browser thủ công; chưa automated. |
| Create task/progress/approval/reject/upload duplicate action | `PARTIAL` | Playwright smoke đã phủ login, user edit, department edit, team create/update, role permission preview, tạo task qua UI kèm assigner/attachment, tạo task qua API, mở detail UI, upload/download attachment, cập nhật progress, đánh giá hoàn thành task, approve/reject/request-info/transfer workflow và idempotency key. Còn thiếu double-click UI cụ thể và responsive/offline action tests. |
| Form builder/workflow designer/draft/dark/responsive/offline | `PARTIAL` | Draft/dark/offline cơ bản; smoke có tạo template bằng builder động và tạo hồ sơ bằng form động. Canvas designer, responsive/offline matrix và builder nâng cao chưa có. |
| Chrome/Edge/Android/iOS/Windows desktop matrix | `PARTIAL` | Chrome/browser web đã QA nhiều lần, Windows installer và Android arm64 APK build pass. Chưa QA Edge, thiết bị Android thật/emulator, iOS/macOS. |

## 32. Dữ liệu demo UI

| Checklist | Trạng thái | Ghi chú |
| --- | --- | --- |
| Task tên dài, nhiều assignee, nhiều tags, quá hạn, nhiều comment | `PARTIAL` | Một số seed/smoke có. Cần seed stress đầy đủ. |
| Task con | `TODO` | Chưa seed rõ. |
| Workflow form dài/bảng nhiều dòng/nhiều nhánh/parallel | `PARTIAL` | Branch có ở backend và builder điều kiện cơ bản; form dài/parallel seed chưa. |
| User tên dài, phòng ban nhiều cấp, >100 records | `TODO` | Chưa có. |

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
| Audit config changes | `PARTIAL` | Settings save có route permission; audit config cần rà. |
| Không còn responsive/lint/type-check/test/build errors | `PARTIAL` | Chunk task assigner field đã pass `pnpm lint`, `pnpm test`, `pnpm build`, `docker compose up -d --build`, targeted task form attachment smoke 1/1 và `pnpm smoke:web` 18/18. Responsive còn cần QA sâu. |

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
