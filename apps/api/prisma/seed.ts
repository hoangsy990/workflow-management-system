import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/security/hash.js";
import { createTask, updateTaskProgress, evaluateTask } from "../src/modules/tasks/task.service.js";
import { actOnWorkflowInstance, createWorkflowTemplate, submitWorkflowInstance } from "../src/modules/workflows/workflow.service.js";
import type { AuthContext } from "../src/types/fastify.js";

const prisma = new PrismaClient();

const permissionCodes = [
  "user.read",
  "user.manage",
  "department.read",
  "department.manage",
  "role.read",
  "role.manage",
  "task.create",
  "task.read_all",
  "task.read_team",
  "task.update_any",
  "task.assign",
  "task.evaluate",
  "task.comment",
  "workflow.template.manage",
  "workflow.instance.create",
  "workflow.instance.approve",
  "workflow.instance.read_all",
  "notification.read",
  "audit.read",
  "setting.manage"
] as const;

const password = {
  admin: "Admin@123456",
  manager: "Manager@123456",
  employee: "Demo@123456"
};

function auth(userId: string, permissions: string[], roles: string[], fullName: string): AuthContext {
  return {
    userId,
    email: "",
    fullName,
    departmentId: null,
    managerId: null,
    permissions,
    roles
  };
}

async function main() {
  const company = await prisma.company.upsert({
    where: { code: "WF" },
    update: {},
    create: { code: "WF", name: "WorkFlow Demo Company" }
  });

  const branch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: company.id, code: "HCM" } },
    update: {},
    create: { companyId: company.id, code: "HCM", name: "Chi nhánh Hồ Chí Minh" }
  });

  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: "FIN" },
      update: { name: "Phòng Tài chính", branchId: branch.id },
      create: { code: "FIN", name: "Phòng Tài chính", branchId: branch.id }
    }),
    prisma.department.upsert({
      where: { code: "HR" },
      update: { name: "Phòng Nhân sự", branchId: branch.id },
      create: { code: "HR", name: "Phòng Nhân sự", branchId: branch.id }
    })
  ]);
  const [financeDepartment, hrDepartment] = departments;

  const permissions = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name: code,
          group: code.split(".")[0] ?? "system"
        }
      })
    )
  );
  const permissionByCode = new Map(permissions.map((permission) => [permission.code, permission]));

  const roleDefinitions = [
    {
      code: "system_admin",
      name: "Quản trị hệ thống",
      permissions: permissionCodes
    },
    {
      code: "manager",
      name: "Quản lý",
      permissions: [
        "user.read",
        "department.read",
        "task.create",
        "task.read_team",
        "task.assign",
        "task.evaluate",
        "task.comment",
        "workflow.instance.create",
        "workflow.instance.approve",
        "notification.read"
      ]
    },
    {
      code: "employee",
      name: "Nhân viên",
      permissions: [
        "user.read",
        "department.read",
        "task.create",
        "task.comment",
        "workflow.instance.create",
        "workflow.instance.approve",
        "notification.read"
      ]
    },
    {
      code: "watcher",
      name: "Người theo dõi",
      permissions: ["task.comment", "notification.read"]
    }
  ] as const;

  const roles = new Map<string, { id: string; code: string; name: string }>();
  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { code: definition.code },
      update: { name: definition.name, isSystem: true },
      create: { code: definition.code, name: definition.name, isSystem: true }
    });
    roles.set(role.code, role);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: definition.permissions.map((code) => ({
        roleId: role.id,
        permissionId: permissionByCode.get(code as string)!.id
      })),
      skipDuplicates: true
    });
  }

  const admin = await prisma.user.upsert({
    where: { email: "admin@workflow.local" },
    update: { fullName: "Quản trị hệ thống", departmentId: financeDepartment.id },
    create: {
      employeeCode: "ADM001",
      fullName: "Quản trị hệ thống",
      email: "admin@workflow.local",
      phone: "0900000001",
      title: "System Administrator",
      departmentId: financeDepartment.id,
      passwordHash: await hashPassword(password.admin)
    }
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@workflow.local" },
    update: { fullName: "Nguyễn Minh Quản", departmentId: financeDepartment.id },
    create: {
      employeeCode: "MGR001",
      fullName: "Nguyễn Minh Quản",
      email: "manager@workflow.local",
      phone: "0900000002",
      title: "Trưởng phòng",
      departmentId: financeDepartment.id,
      passwordHash: await hashPassword(password.manager)
    }
  });

  await prisma.department.update({ where: { id: financeDepartment.id }, data: { managerId: manager.id } });

  const employees = await Promise.all([
    prisma.user.upsert({
      where: { email: "lan@workflow.local" },
      update: { managerId: manager.id, departmentId: financeDepartment.id },
      create: {
        employeeCode: "EMP001",
        fullName: "Trần Hoài Lan",
        email: "lan@workflow.local",
        phone: "0900000003",
        title: "Kế toán viên",
        departmentId: financeDepartment.id,
        managerId: manager.id,
        passwordHash: await hashPassword(password.employee)
      }
    }),
    prisma.user.upsert({
      where: { email: "nam@workflow.local" },
      update: { managerId: manager.id, departmentId: financeDepartment.id },
      create: {
        employeeCode: "EMP002",
        fullName: "Phạm Hoàng Nam",
        email: "nam@workflow.local",
        phone: "0900000004",
        title: "Chuyên viên mua hàng",
        departmentId: financeDepartment.id,
        managerId: manager.id,
        passwordHash: await hashPassword(password.employee)
      }
    }),
    prisma.user.upsert({
      where: { email: "mai@workflow.local" },
      update: { departmentId: hrDepartment.id, managerId: manager.id },
      create: {
        employeeCode: "EMP003",
        fullName: "Lê Thảo Mai",
        email: "mai@workflow.local",
        phone: "0900000005",
        title: "Nhân sự tổng hợp",
        departmentId: hrDepartment.id,
        managerId: manager.id,
        passwordHash: await hashPassword(password.employee)
      }
    }),
    prisma.user.upsert({
      where: { email: "huy@workflow.local" },
      update: { departmentId: hrDepartment.id, managerId: manager.id },
      create: {
        employeeCode: "EMP004",
        fullName: "Đỗ Quốc Huy",
        email: "huy@workflow.local",
        phone: "0900000006",
        title: "Chuyên viên hành chính",
        departmentId: hrDepartment.id,
        managerId: manager.id,
        passwordHash: await hashPassword(password.employee)
      }
    })
  ]);

  await prisma.userRole.createMany({
    data: [
      { userId: admin.id, roleId: roles.get("system_admin")!.id },
      { userId: manager.id, roleId: roles.get("manager")!.id },
      ...employees.map((employee) => ({ userId: employee.id, roleId: roles.get("employee")!.id }))
    ],
    skipDuplicates: true
  });

  const demoTeams = await Promise.all([
    prisma.team.upsert({
      where: { code: "FIN-OPS" },
      update: { name: "NhÃ³m TÃ i chÃ­nh váº­n hÃ nh", departmentId: financeDepartment.id },
      create: { code: "FIN-OPS", name: "NhÃ³m TÃ i chÃ­nh váº­n hÃ nh", departmentId: financeDepartment.id }
    }),
    prisma.team.upsert({
      where: { code: "HR-ADMIN" },
      update: { name: "NhÃ³m NhÃ¢n sá»± hÃ nh chÃ­nh", departmentId: hrDepartment.id },
      create: { code: "HR-ADMIN", name: "NhÃ³m NhÃ¢n sá»± hÃ nh chÃ­nh", departmentId: hrDepartment.id }
    })
  ]);

  await prisma.teamMember.deleteMany({ where: { teamId: { in: demoTeams.map((team) => team.id) } } });
  await prisma.teamMember.createMany({
    data: [
      { teamId: demoTeams[0]!.id, userId: manager.id },
      { teamId: demoTeams[0]!.id, userId: employees[0]!.id },
      { teamId: demoTeams[0]!.id, userId: employees[1]!.id },
      { teamId: demoTeams[1]!.id, userId: employees[2]!.id },
      { teamId: demoTeams[1]!.id, userId: employees[3]!.id }
    ],
    skipDuplicates: true
  });

  const categories = await Promise.all([
    prisma.taskCategory.upsert({
      where: { code: "OPS" },
      update: {},
      create: { code: "OPS", name: "Vận hành" }
    }),
    prisma.taskCategory.upsert({
      where: { code: "FIN-TASK" },
      update: {},
      create: { code: "FIN-TASK", name: "Tài chính" }
    })
  ]);

  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: "Gấp" }, update: { color: "#dc2626" }, create: { name: "Gấp", color: "#dc2626" } }),
    prisma.tag.upsert({ where: { name: "Báo cáo" }, update: { color: "#2563eb" }, create: { name: "Báo cáo", color: "#2563eb" } }),
    prisma.tag.upsert({ where: { name: "Nội bộ" }, update: { color: "#16a34a" }, create: { name: "Nội bộ", color: "#16a34a" } })
  ]);

  const adminAuth = auth(admin.id, [...permissionCodes], ["system_admin"], admin.fullName);
  const managerAuth = auth(
    manager.id,
    [...roleDefinitions.find((role) => role.code === "manager")!.permissions],
    ["manager"],
    manager.fullName
  );

  if ((await prisma.task.count()) === 0) {
    const task1 = await createTask(prisma, managerAuth, {
      title: "Chuẩn bị báo cáo chi phí tháng",
      description: "Tổng hợp chi phí hoạt động và gửi quản lý đánh giá.",
      managerId: manager.id,
      assigneeIds: [employees[0]!.id],
      followerIds: [admin.id],
      departmentId: financeDepartment.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      priority: "HIGH",
      categoryId: categories[1]!.id,
      tagIds: [tags[0]!.id, tags[1]!.id],
      requiresReview: true
    });
    await updateTaskProgress(prisma, auth(employees[0]!.id, ["task.comment"], ["employee"], employees[0]!.fullName), task1.id, {
      progress: 65,
      note: "Đã tổng hợp dữ liệu từ các chi nhánh."
    });

    const task2 = await createTask(prisma, managerAuth, {
      title: "Kiểm kê thiết bị văn phòng",
      description: "Rà soát thiết bị đang sử dụng tại các phòng ban.",
      managerId: manager.id,
      assigneeIds: [employees[1]!.id, employees[3]!.id],
      followerIds: [employees[2]!.id],
      departmentId: hrDepartment.id,
      startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      priority: "NORMAL",
      categoryId: categories[0]!.id,
      tagIds: [tags[2]!.id],
      requiresReview: true
    });
    await updateTaskProgress(prisma, auth(employees[1]!.id, ["task.comment"], ["employee"], employees[1]!.fullName), task2.id, {
      progress: 35,
      note: "Đã kiểm kê tầng 1."
    });

    const task3 = await createTask(prisma, managerAuth, {
      title: "Cập nhật quy định nghỉ phép nội bộ",
      description: "Rà soát chính sách và chuẩn bị bản cập nhật.",
      managerId: manager.id,
      assigneeIds: [employees[2]!.id],
      followerIds: [admin.id],
      departmentId: hrDepartment.id,
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      priority: "URGENT",
      categoryId: categories[0]!.id,
      tagIds: [tags[0]!.id],
      requiresReview: true
    });
    await updateTaskProgress(prisma, auth(employees[2]!.id, ["task.comment"], ["employee"], employees[2]!.fullName), task3.id, {
      progress: 100,
      note: "Đã gửi bản nháp để đánh giá."
    });

    const task4 = await createTask(prisma, managerAuth, {
      title: "Lưu trữ hồ sơ thanh toán quý trước",
      description: "Đưa hồ sơ đã xử lý vào kho tài liệu nội bộ.",
      managerId: manager.id,
      assigneeIds: [employees[0]!.id],
      followerIds: [],
      departmentId: financeDepartment.id,
      startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      priority: "LOW",
      categoryId: categories[1]!.id,
      tagIds: [tags[1]!.id],
      requiresReview: false
    });
    await updateTaskProgress(prisma, auth(employees[0]!.id, ["task.comment"], ["employee"], employees[0]!.fullName), task4.id, {
      progress: 100,
      note: "Đã hoàn tất lưu trữ."
    });
    await evaluateTask(prisma, managerAuth, task4.id, { accepted: true, rating: 5, comment: "Hoàn thành tốt." });
  }

  if ((await prisma.workflowTemplate.count()) === 0) {
    const paymentTemplate = await createWorkflowTemplate(prisma, adminAuth, {
      code: "PAYMENT",
      name: "Đề xuất thanh toán",
      description: "Quy trình phê duyệt đề xuất thanh toán theo hạn mức.",
      category: "Tài chính",
      managerId: manager.id,
      activate: true,
      fields: [
        { name: "Nội dung thanh toán", code: "purpose", type: "SHORT_TEXT", isRequired: true, displayOrder: 1 },
        { name: "Số tiền", code: "amount", type: "CURRENCY", isRequired: true, displayOrder: 2 },
        { name: "Nhà cung cấp", code: "vendor", type: "SHORT_TEXT", isRequired: true, displayOrder: 3 },
        { name: "Tệp chứng từ", code: "evidence", type: "ATTACHMENT", displayOrder: 4 }
      ],
      steps: [
        { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
        {
          code: "manager",
          name: "Trưởng phòng phê duyệt",
          type: "APPROVAL",
          orderIndex: 2,
          approvalMode: "SEQUENTIAL",
          assignees: [{ resolverType: "REQUESTER_MANAGER", orderIndex: 1 }]
        },
        {
          code: "director",
          name: "Giám đốc phê duyệt",
          type: "APPROVAL",
          orderIndex: 3,
          approvalMode: "SEQUENTIAL",
          assignees: [{ resolverType: "SPECIFIC_USER", userId: admin.id, orderIndex: 1 }]
        },
        { code: "end", name: "Kết thúc", type: "END", orderIndex: 4 }
      ],
      transitions: [
        {
          fromStepCode: "manager",
          toStepCode: "end",
          priority: 1,
          conditions: [{ fieldCode: "amount", operator: "lte", compareValue: 50000000 }]
        },
        {
          fromStepCode: "manager",
          toStepCode: "director",
          priority: 2,
          conditions: [{ fieldCode: "amount", operator: "gt", compareValue: 50000000 }]
        },
        { fromStepCode: "director", toStepCode: "end", priority: 1 }
      ]
    });

    const leaveTemplate = await createWorkflowTemplate(prisma, adminAuth, {
      code: "LEAVE",
      name: "Đề xuất nghỉ phép",
      description: "Quy trình nghỉ phép có trưởng phòng duyệt.",
      category: "Nhân sự",
      managerId: manager.id,
      activate: true,
      fields: [
        { name: "Từ ngày", code: "fromDate", type: "DATE", isRequired: true, displayOrder: 1 },
        { name: "Đến ngày", code: "toDate", type: "DATE", isRequired: true, displayOrder: 2 },
        { name: "Lý do", code: "reason", type: "LONG_TEXT", isRequired: true, displayOrder: 3 }
      ],
      steps: [
        { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
        {
          code: "manager",
          name: "Trưởng phòng duyệt nghỉ phép",
          type: "APPROVAL",
          orderIndex: 2,
          assignees: [{ resolverType: "REQUESTER_MANAGER", orderIndex: 1 }]
        },
        { code: "end", name: "Kết thúc", type: "END", orderIndex: 3 }
      ],
      transitions: [{ fromStepCode: "manager", toStepCode: "end", priority: 1 }]
    });

    const paymentTemplateId = paymentTemplate.id;
    const leaveTemplateId = leaveTemplate.id;

    await submitWorkflowInstance(prisma, auth(employees[0]!.id, ["workflow.instance.create"], ["employee"], employees[0]!.fullName), {
      templateId: paymentTemplateId,
      formData: { purpose: "Thanh toán dịch vụ phần mềm", amount: 72000000, vendor: "Công ty Demo SaaS" },
      idempotencyKey: "seed-payment-pending"
    });

    const approved = await submitWorkflowInstance(
      prisma,
      auth(employees[1]!.id, ["workflow.instance.create"], ["employee"], employees[1]!.fullName),
      {
        templateId: paymentTemplateId,
        formData: { purpose: "Thanh toán văn phòng phẩm", amount: 12000000, vendor: "Nhà cung cấp A" },
        idempotencyKey: "seed-payment-approved"
      }
    );
    await actOnWorkflowInstance(prisma, managerAuth, (approved as { id: string }).id, {
      action: "APPROVE",
      comment: "Đồng ý thanh toán.",
      idempotencyKey: "seed-payment-approved-manager"
    });

    const rejected = await submitWorkflowInstance(
      prisma,
      auth(employees[2]!.id, ["workflow.instance.create"], ["employee"], employees[2]!.fullName),
      {
        templateId: leaveTemplateId,
        formData: {
          fromDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          toDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          reason: "Nghỉ việc cá nhân"
        },
        idempotencyKey: "seed-leave-rejected"
      }
    );
    await actOnWorkflowInstance(prisma, managerAuth, (rejected as { id: string }).id, {
      action: "REJECT",
      comment: "Thời điểm này phòng đang thiếu nhân sự.",
      idempotencyKey: "seed-leave-rejected-manager"
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "task.redo.reset_progress" },
    update: { value: false },
    create: {
      key: "task.redo.reset_progress",
      value: false,
      description: "Có đặt lại tiến độ khi yêu cầu thực hiện lại hay không."
    }
  });

  console.log("Seed completed.");
  console.table([
    { role: "Admin", email: "admin@workflow.local", password: password.admin },
    { role: "Manager", email: "manager@workflow.local", password: password.manager },
    { role: "Employee", email: "lan@workflow.local", password: password.employee }
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
