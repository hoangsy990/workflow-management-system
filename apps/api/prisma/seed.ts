import { PrismaClient, type Department } from "@prisma/client";
import { hashPassword } from "../src/security/hash.js";
import { addTaskComment, createTask, updateTaskProgress, evaluateTask } from "../src/modules/tasks/task.service.js";
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

  const stressDepartments: Department[] = [];
  const stressRootDepartment = await prisma.department.upsert({
    where: { code: "STRESS-L1" },
    update: { name: "Khối kiểm thử dữ liệu dài", branchId: branch.id, parentId: null },
    create: { code: "STRESS-L1", name: "Khối kiểm thử dữ liệu dài", branchId: branch.id }
  });
  stressDepartments.push(stressRootDepartment);
  const stressChildDepartment = await prisma.department.upsert({
    where: { code: "STRESS-L2" },
    update: { name: "Phòng kiểm thử nhiều cấp", branchId: branch.id, parentId: stressRootDepartment.id },
    create: { code: "STRESS-L2", name: "Phòng kiểm thử nhiều cấp", branchId: branch.id, parentId: stressRootDepartment.id }
  });
  stressDepartments.push(stressChildDepartment);
  const stressLeafDepartment = await prisma.department.upsert({
    where: { code: "STRESS-L3" },
    update: { name: "Nhóm dữ liệu lớn và tên rất dài", branchId: branch.id, parentId: stressChildDepartment.id },
    create: { code: "STRESS-L3", name: "Nhóm dữ liệu lớn và tên rất dài", branchId: branch.id, parentId: stressChildDepartment.id }
  });
  stressDepartments.push(stressLeafDepartment);

  const stressPasswordHash = await hashPassword(password.employee);
  const stressUsers = await Promise.all(
    Array.from({ length: 105 }, (_, index) => {
      const ordinal = String(index + 1).padStart(3, "0");
      const createdAt = new Date(Date.UTC(2020, 0, index + 1));
      const departmentId = stressDepartments[index % stressDepartments.length]!.id;
      return prisma.user.upsert({
        where: { email: `stress${ordinal}@workflow.local` },
        update: { departmentId, managerId: manager.id },
        create: {
          employeeCode: `STR${ordinal}`,
          fullName:
            index === 0
              ? "Người dùng kiểm thử có họ tên rất dài dùng để kiểm tra xuống dòng trên bảng, thẻ mobile và menu chọn nhân sự"
              : `Nhân viên stress ${ordinal}`,
          email: `stress${ordinal}@workflow.local`,
          phone: `091${ordinal.padStart(7, "0")}`,
          title: index === 0 ? "Chức danh kiểm thử cực dài cho layout quản trị người dùng" : "Nhân viên kiểm thử",
          departmentId,
          managerId: manager.id,
          passwordHash: stressPasswordHash,
          createdAt
        }
      });
    })
  );
  await prisma.userRole.createMany({
    data: stressUsers.map((user) => ({ userId: user.id, roleId: roles.get("employee")!.id })),
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

  if (!(await prisma.task.findFirst({ where: { title: "Demo task cha: Chuẩn bị họp giao ban", deletedAt: null } }))) {
    const parentTask = await createTask(prisma, managerAuth, {
      title: "Demo task cha: Chuẩn bị họp giao ban",
      description: "Task cha dùng để kiểm tra quan hệ công việc con và tự tính tiến độ.",
      managerId: manager.id,
      assigneeIds: [employees[0]!.id],
      followerIds: [admin.id],
      departmentId: hrDepartment.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      priority: "NORMAL",
      categoryId: categories[0]!.id,
      tagIds: [tags[2]!.id],
      requiresReview: true,
      autoCalculateParentProgress: true
    });
    const childAgenda = await createTask(prisma, managerAuth, {
      title: "Demo task con: Chuẩn bị nội dung họp",
      description: "Tổng hợp agenda và tài liệu cần trao đổi.",
      managerId: manager.id,
      assigneeIds: [employees[2]!.id],
      followerIds: [admin.id],
      departmentId: hrDepartment.id,
      parentTaskId: parentTask.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      priority: "HIGH",
      categoryId: categories[0]!.id,
      tagIds: [tags[2]!.id],
      requiresReview: false
    });
    const childMinutes = await createTask(prisma, managerAuth, {
      title: "Demo task con: Chuẩn bị biên bản họp",
      description: "Tạo mẫu biên bản và danh sách người tham dự.",
      managerId: manager.id,
      assigneeIds: [employees[3]!.id],
      followerIds: [admin.id],
      departmentId: hrDepartment.id,
      parentTaskId: parentTask.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      priority: "NORMAL",
      categoryId: categories[0]!.id,
      tagIds: [tags[1]!.id],
      requiresReview: false
    });
    await updateTaskProgress(prisma, auth(employees[2]!.id, ["task.comment"], ["employee"], employees[2]!.fullName), childAgenda.id, {
      progress: 50,
      note: "Đã chuẩn bị nửa đầu nội dung agenda."
    });
    await updateTaskProgress(prisma, auth(employees[3]!.id, ["task.comment"], ["employee"], employees[3]!.fullName), childMinutes.id, {
      progress: 100,
      note: "Đã chuẩn bị xong mẫu biên bản."
    });
  }

  if (
    !(await prisma.task.findFirst({
      where: { title: "Demo stress task: tên rất dài, nhiều người thực hiện, nhiều nhãn, quá hạn và nhiều trao đổi", deletedAt: null }
    }))
  ) {
    const stressTask = await createTask(prisma, managerAuth, {
      title: "Demo stress task: tên rất dài, nhiều người thực hiện, nhiều nhãn, quá hạn và nhiều trao đổi",
      description:
        "Dữ liệu kiểm thử giao diện với tiêu đề dài, nhiều người tham gia, nhiều nhãn, hạn đã qua và nhiều bình luận để kiểm tra layout danh sách/thẻ mobile/chi tiết.",
      managerId: manager.id,
      assigneeIds: employees.map((employee) => employee.id),
      followerIds: [admin.id],
      departmentId: financeDepartment.id,
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      priority: "URGENT",
      categoryId: categories[1]!.id,
      tagIds: tags.map((tag) => tag.id),
      requiresReview: true
    });
    await updateTaskProgress(prisma, auth(employees[0]!.id, ["task.comment"], ["employee"], employees[0]!.fullName), stressTask.id, {
      progress: 20,
      note: "Bắt đầu xử lý dữ liệu stress task."
    });
    const firstStressComment = await addTaskComment(
      prisma,
      auth(employees[0]!.id, ["task.comment"], ["employee"], employees[0]!.fullName),
      stressTask.id,
      {
        content: "Đã rà soát đầu việc, cần cả nhóm cập nhật tình trạng trước cuối ngày.",
        mentions: [manager.id]
      }
    );
    const stressCommentAuthors = [employees[1]!, employees[2]!, employees[3]!, employees[0]!, employees[1]!, employees[2]!];
    for (const [index, author] of stressCommentAuthors.entries()) {
      await addTaskComment(prisma, auth(author.id, ["task.comment"], ["employee"], author.fullName), stressTask.id, {
        content: `Cập nhật stress comment ${index + 1}: nội dung dài vừa phải để kiểm tra hiển thị dòng, xuống dòng và khoảng cách trong chi tiết công việc.`,
        mentions: index % 2 === 0 ? [manager.id] : []
      });
    }
    await addTaskComment(prisma, managerAuth, stressTask.id, {
      parentCommentId: firstStressComment.id,
      content: "Đã nhận cập nhật, nhóm tiếp tục xử lý theo thứ tự ưu tiên."
    });
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

    const needsInfo = await submitWorkflowInstance(
      prisma,
      auth(employees[3]!.id, ["workflow.instance.create"], ["employee"], employees[3]!.fullName),
      {
        templateId: paymentTemplateId,
        formData: {
          purpose: "Thanh toán chi phí đi lại",
          amount: 8500000,
          vendor: "Nhà cung cấp vé xe"
        },
        idempotencyKey: "seed-payment-needs-info"
      }
    );
    await actOnWorkflowInstance(prisma, managerAuth, (needsInfo as { id: string }).id, {
      action: "REQUEST_INFO",
      comment: "Vui lòng bổ sung hóa đơn và bảng kê chi tiết.",
      idempotencyKey: "seed-payment-needs-info-manager"
    });
  }

  const paymentSeedTemplate = await prisma.workflowTemplate.findUnique({ where: { code: "PAYMENT" } });
  if (paymentSeedTemplate) {
    const requester = employees[3]!;
    const needsInfoScope = `workflow.submit:${paymentSeedTemplate.id}`;
    const existingNeedsInfoSeed = await prisma.idempotencyKey.findUnique({
      where: {
        userId_key_scope: {
          userId: requester.id,
          key: "seed-payment-needs-info",
          scope: needsInfoScope
        }
      }
    });

    if (!existingNeedsInfoSeed) {
      const needsInfo = await submitWorkflowInstance(
        prisma,
        auth(requester.id, ["workflow.instance.create"], ["employee"], requester.fullName),
        {
          templateId: paymentSeedTemplate.id,
          formData: {
            purpose: "Thanh toán chi phí đi lại",
            amount: 8500000,
            vendor: "Nhà cung cấp vé xe"
          },
          idempotencyKey: "seed-payment-needs-info"
        }
      );
      await actOnWorkflowInstance(prisma, managerAuth, (needsInfo as { id: string }).id, {
        action: "REQUEST_INFO",
        comment: "Vui lòng bổ sung hóa đơn và bảng kê chi tiết.",
        idempotencyKey: "seed-payment-needs-info-manager"
      });
    }
  }

  let stressParallelTemplate: { id: string; code: string; name: string } | null = await prisma.workflowTemplate.findUnique({
    where: { code: "STRESS_PARALLEL" },
    select: { id: true, code: true, name: true }
  });
  if (!stressParallelTemplate) {
    stressParallelTemplate = (await createWorkflowTemplate(prisma, adminAuth, {
      code: "STRESS_PARALLEL",
      name: "Demo stress phê duyệt song song",
      description: "Dữ liệu kiểm thử quy trình song song nhiều người duyệt, dùng cho QA layout và logic MIN_COUNT.",
      category: "Kiểm thử",
      managerId: manager.id,
      activate: true,
      fields: [
        { name: "Hạng mục đề xuất", code: "item", type: "SHORT_TEXT", isRequired: true, displayOrder: 1 },
        { name: "Ngân sách dự kiến", code: "budget", type: "CURRENCY", isRequired: true, displayOrder: 2 },
        { name: "Lý do cần phê duyệt", code: "reason", type: "LONG_TEXT", isRequired: true, displayOrder: 3 }
      ],
      steps: [
        { code: "start", name: "Bắt đầu", type: "START", orderIndex: 1 },
        {
          code: "parallel_review",
          name: "Hội đồng duyệt song song",
          type: "APPROVAL",
          orderIndex: 2,
          approvalMode: "PARALLEL",
          completionRule: "MIN_COUNT",
          minCount: 2,
          deadlineAmount: 2,
          deadlineUnit: "DAY",
          reminderBeforeHours: 12,
          assignees: [
            { resolverType: "SPECIFIC_USER", userId: manager.id, orderIndex: 1 },
            { resolverType: "SPECIFIC_USER", userId: admin.id, orderIndex: 2 },
            { resolverType: "SPECIFIC_USER", userId: employees[1]!.id, orderIndex: 3 }
          ]
        },
        { code: "end", name: "Kết thúc", type: "END", orderIndex: 3 }
      ],
      transitions: [{ fromStepCode: "parallel_review", toStepCode: "end", priority: 1 }]
    })) as { id: string; code: string; name: string };
  }

  const stressParallelScope = `workflow.submit:${stressParallelTemplate.id}`;
  const existingStressParallelInstance = await prisma.idempotencyKey.findUnique({
    where: {
      userId_key_scope: {
        userId: employees[0]!.id,
        key: "seed-stress-parallel-pending",
        scope: stressParallelScope
      }
    }
  });
  if (!existingStressParallelInstance) {
    await submitWorkflowInstance(
      prisma,
      auth(employees[0]!.id, ["workflow.instance.create"], ["employee"], employees[0]!.fullName),
      {
        templateId: stressParallelTemplate.id,
        formData: {
          item: "Gói kiểm thử quy trình song song có nhiều người xử lý cùng lúc",
          budget: 36000000,
          reason: "Tạo dữ liệu thật để QA danh sách hồ sơ, chi tiết phê duyệt và trạng thái nhiều approver pending."
        },
        idempotencyKey: "seed-stress-parallel-pending"
      }
    );
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

  await Promise.all([
    prisma.systemSetting.upsert({
      where: { key: "auto_code.task.prefix" },
      update: {},
      create: {
        key: "auto_code.task.prefix",
        value: "TASK",
        description: "Tiền tố mã công việc tự sinh."
      }
    }),
    prisma.systemSetting.upsert({
      where: { key: "auto_code.task.padding" },
      update: {},
      create: {
        key: "auto_code.task.padding",
        value: 4,
        description: "Số chữ số thứ tự trong mã công việc."
      }
    }),
    prisma.systemSetting.upsert({
      where: { key: "auto_code.workflow_instance.prefix" },
      update: {},
      create: {
        key: "auto_code.workflow_instance.prefix",
        value: "WF",
        description: "Tiền tố mã hồ sơ quy trình tự sinh."
      }
    }),
    prisma.systemSetting.upsert({
      where: { key: "auto_code.workflow_instance.padding" },
      update: {},
      create: {
        key: "auto_code.workflow_instance.padding",
        value: 4,
        description: "Số chữ số thứ tự trong mã hồ sơ quy trình."
      }
    }),
    prisma.systemSetting.upsert({
      where: { key: "file.upload.max_mb" },
      update: {},
      create: {
        key: "file.upload.max_mb",
        value: 20,
        description: "Dung lượng tệp upload tối đa tính bằng MB, không vượt quá trần MAX_UPLOAD_MB."
      }
    }),
    prisma.systemSetting.upsert({
      where: { key: "file.upload.allowed_mime_types" },
      update: {},
      create: {
        key: "file.upload.allowed_mime_types",
        value: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "video/mp4"
        ],
        description: "Danh sách MIME type được phép upload cho task và workflow."
      }
    }),
    prisma.systemSetting.upsert({
      where: { key: "notification.in_app.enabled" },
      update: {},
      create: { key: "notification.in_app.enabled", value: true, description: "Bật trung tâm thông báo trong ứng dụng." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "notification.push.enabled" },
      update: {},
      create: { key: "notification.push.enabled", value: false, description: "Bật khả năng gửi push notification khi adapter được cấu hình." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "notification.email.enabled" },
      update: {},
      create: { key: "notification.email.enabled", value: false, description: "Bật khả năng gửi email notification khi SMTP được cấu hình." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "notification.deadline_reminder_hours" },
      update: {},
      create: { key: "notification.deadline_reminder_hours", value: 24, description: "Số giờ nhắc trước hạn mặc định cho công việc/quy trình." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "email.smtp.host" },
      update: {},
      create: { key: "email.smtp.host", value: "", description: "Máy chủ SMTP dùng cho email notification." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "email.smtp.port" },
      update: {},
      create: { key: "email.smtp.port", value: 587, description: "Cổng SMTP." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "email.from_address" },
      update: {},
      create: { key: "email.from_address", value: "no-reply@workflow.local", description: "Địa chỉ gửi email mặc định." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "email.smtp.tls" },
      update: {},
      create: { key: "email.smtp.tls", value: true, description: "Sử dụng TLS khi kết nối SMTP." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "security.login.max_failed_attempts" },
      update: {},
      create: { key: "security.login.max_failed_attempts", value: 5, description: "Số lần đăng nhập sai tối đa trước khi trì hoãn/khóa." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "security.login.lock_minutes" },
      update: {},
      create: { key: "security.login.lock_minutes", value: 15, description: "Số phút trì hoãn/khóa sau nhiều lần đăng nhập sai." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "backup.database.schedule" },
      update: {},
      create: { key: "backup.database.schedule", value: "0 2 * * *", description: "Lịch backup database dạng cron." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "backup.retention_days" },
      update: {},
      create: { key: "backup.retention_days", value: 30, description: "Số ngày giữ bản backup." }
    }),
    prisma.systemSetting.upsert({
      where: { key: "backup.uploads.enabled" },
      update: {},
      create: { key: "backup.uploads.enabled", value: true, description: "Có backup thư mục upload cùng database hay không." }
    })
  ]);

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
