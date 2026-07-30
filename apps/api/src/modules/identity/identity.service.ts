import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthContext } from "../../types/fastify.js";
import { hashPassword, verifyPassword } from "../../security/hash.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { badRequest, conflict, notFound } from "../../http/errors.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { visibleWorkflowInstanceWhere } from "../workflows/workflow.service.js";

export async function listUsers(db: PrismaClient, input: { page: number; pageSize: number; keyword?: string }) {
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(input.keyword
      ? {
          OR: [
            { fullName: { contains: input.keyword, mode: "insensitive" } },
            { email: { contains: input.keyword, mode: "insensitive" } },
            { employeeCode: { contains: input.keyword, mode: "insensitive" } }
          ]
        }
      : {})
  };

  const [data, total] = await Promise.all([
    db.user.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        title: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        department: { select: { id: true, code: true, name: true } },
        manager: { select: { id: true, fullName: true } },
        teams: { include: { team: { select: { id: true, code: true, name: true } } } },
        roles: { include: { role: true } }
      }
    }),
    db.user.count({ where })
  ]);

  return { data, total };
}

const profileSelect = {
  id: true,
  employeeCode: true,
  fullName: true,
  email: true,
  phone: true,
  avatarUrl: true,
  title: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  lastLoginAt: true,
  department: { select: { id: true, code: true, name: true } },
  manager: { select: { id: true, fullName: true, email: true } },
  teams: { include: { team: { select: { id: true, code: true, name: true } } } },
  roles: { include: { role: { select: { id: true, code: true, name: true } } } }
} satisfies Prisma.UserSelect;

export async function getProfile(db: PrismaClient, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: profileSelect
  });

  if (!user || user.status !== "ACTIVE") {
    throw notFound("Không tìm thấy hồ sơ người dùng.");
  }

  return user;
}

export async function updateOwnProfile(
  db: PrismaClient,
  userId: string,
  input: {
    fullName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    title?: string | null;
  }
) {
  const existing = await db.user.findUnique({ where: { id: userId }, select: { id: true, deletedAt: true, status: true } });
  if (!existing || existing.deletedAt || existing.status !== "ACTIVE") {
    throw notFound("Không tìm thấy hồ sơ người dùng.");
  }

  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
        title: input.title
      },
      select: profileSelect
    });

    await writeAuditLog(tx, {
      actorId: userId,
      action: "user.profile.update",
      entityType: "users",
      entityId: userId
    });

    return user;
  });
}

export async function changeOwnPassword(
  db: PrismaClient,
  userId: string,
  input: {
    currentPassword: string;
    newPassword: string;
  }
) {
  const existing = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, deletedAt: true, status: true, passwordHash: true }
  });
  if (!existing || existing.deletedAt || existing.status !== "ACTIVE") {
    throw notFound("Không tìm thấy hồ sơ người dùng.");
  }

  const isValid = await verifyPassword(input.currentPassword, existing.passwordHash);
  if (!isValid) {
    throw badRequest("Mật khẩu hiện tại không đúng.");
  }

  if (input.currentPassword === input.newPassword) {
    throw badRequest("Mật khẩu mới phải khác mật khẩu hiện tại.");
  }

  const nextHash = await hashPassword(input.newPassword);
  return db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        passwordHash: nextHash,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });

    const revoked = await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await writeAuditLog(tx, {
      actorId: userId,
      action: "user.password.change",
      entityType: "users",
      entityId: userId,
      metadata: { revokedSessions: revoked.count }
    });

    return { ok: true, revokedSessions: revoked.count };
  });
}

export async function listOwnActivity(db: PrismaClient, userId: string, input: { page: number; pageSize: number }) {
  const where: Prisma.ActivityLogWhereInput = { actorId: userId };
  const [data, total] = await Promise.all([
    db.activityLog.findMany({
      where,
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        metadata: true
      }
    }),
    db.activityLog.count({ where })
  ]);

  return { data, total };
}

function isProfileTaskOverdue(task: { dueDate: Date | null; status: string }) {
  return Boolean(task.dueDate && task.dueDate.getTime() < Date.now() && !["DONE", "CANCELLED"].includes(task.status));
}

export async function getProfileRelated(db: PrismaClient, auth: AuthContext) {
  const taskScope = await visibleTaskWhere(db, auth);
  const relatedTaskWhere: Prisma.TaskWhereInput = {
    AND: [
      taskScope,
      {
        OR: [
          { creatorId: auth.userId },
          { assignerId: auth.userId },
          { managerId: auth.userId },
          { assignees: { some: { userId: auth.userId } } },
          { followers: { some: { userId: auth.userId } } }
        ]
      }
    ]
  };
  const reviewTaskWhere: Prisma.TaskWhereInput = {
    AND: [relatedTaskWhere, { status: "PENDING_REVIEW", OR: [{ creatorId: auth.userId }, { managerId: auth.userId }] }]
  };
  const overdueTaskWhere: Prisma.TaskWhereInput = {
    AND: [relatedTaskWhere, { dueDate: { lt: new Date() }, status: { notIn: ["DONE", "CANCELLED"] } }]
  };
  const workflowScope = visibleWorkflowInstanceWhere(auth);
  const createdWorkflowWhere: Prisma.WorkflowInstanceWhereInput = {
    AND: [workflowScope, { requesterId: auth.userId }]
  };
  const pendingWorkflowWhere: Prisma.WorkflowInstanceWhereInput = {
    AND: [workflowScope, { approvals: { some: { approverId: auth.userId, status: "PENDING" } } }]
  };

  const [
    relatedTasks,
    taskTotal,
    taskAssignedTotal,
    taskCreatedTotal,
    taskManagedTotal,
    taskFollowingTotal,
    taskReviewTotal,
    taskOverdueTotal,
    createdWorkflowInstances,
    createdWorkflowTotal,
    pendingWorkflowInstances,
    pendingWorkflowTotal
  ] = await Promise.all([
    db.task.findMany({
      where: relatedTaskWhere,
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        priority: true,
        progress: true,
        startDate: true,
        dueDate: true,
        assignees: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        _count: { select: { comments: true, attachments: true } }
      }
    }),
    db.task.count({ where: relatedTaskWhere }),
    db.task.count({ where: { AND: [relatedTaskWhere, { assignees: { some: { userId: auth.userId } } }] } }),
    db.task.count({ where: { AND: [relatedTaskWhere, { OR: [{ assignerId: auth.userId }, { creatorId: auth.userId }] }] } }),
    db.task.count({ where: { AND: [relatedTaskWhere, { managerId: auth.userId }] } }),
    db.task.count({ where: { AND: [relatedTaskWhere, { followers: { some: { userId: auth.userId } } }] } }),
    db.task.count({ where: reviewTaskWhere }),
    db.task.count({ where: overdueTaskWhere }),
    db.workflowInstance.findMany({
      where: createdWorkflowWhere,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { id: true, code: true, name: true } },
        currentStep: { select: { id: true, name: true, type: true } },
        approvals: {
          where: { status: "PENDING" },
          include: { approver: { select: { id: true, fullName: true } } }
        }
      }
    }),
    db.workflowInstance.count({ where: createdWorkflowWhere }),
    db.workflowInstance.findMany({
      where: pendingWorkflowWhere,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { id: true, code: true, name: true } },
        requester: { select: { id: true, fullName: true } },
        currentStep: { select: { id: true, name: true, type: true } },
        approvals: {
          where: { status: "PENDING" },
          include: { approver: { select: { id: true, fullName: true } } }
        }
      }
    }),
    db.workflowInstance.count({ where: pendingWorkflowWhere })
  ]);

  return {
    tasks: {
      total: taskTotal,
      assignedTotal: taskAssignedTotal,
      createdTotal: taskCreatedTotal,
      managedTotal: taskManagedTotal,
      followingTotal: taskFollowingTotal,
      pendingReviewTotal: taskReviewTotal,
      overdueTotal: taskOverdueTotal,
      data: relatedTasks.map((task) => ({
        ...task,
        displayStatus: isProfileTaskOverdue(task) ? "OVERDUE" : task.status
      }))
    },
    workflows: {
      created: { total: createdWorkflowTotal, data: createdWorkflowInstances },
      pending: { total: pendingWorkflowTotal, data: pendingWorkflowInstances }
    }
  };
}

export async function createUser(
  db: PrismaClient,
  actorId: string,
  input: {
    employeeCode: string;
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    avatarUrl?: string;
    title?: string;
    departmentId?: string;
    managerId?: string;
    roleIds?: string[];
    teamIds?: string[];
  }
) {
  const existed = await db.user.findFirst({
    where: { OR: [{ email: input.email }, { employeeCode: input.employeeCode }] }
  });
  if (existed) {
    throw conflict("Email hoặc mã nhân viên đã tồn tại.");
  }

  await assertExistingTeams(db, input.teamIds);

  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        employeeCode: input.employeeCode,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        passwordHash: await hashPassword(input.password),
        avatarUrl: input.avatarUrl,
        title: input.title,
        departmentId: input.departmentId,
        managerId: input.managerId,
        roles: input.roleIds?.length
          ? {
              createMany: {
                data: input.roleIds.map((roleId) => ({ roleId })),
                skipDuplicates: true
              }
            }
          : undefined,
        teams: input.teamIds?.length
          ? {
              createMany: {
                data: input.teamIds.map((teamId) => ({ teamId })),
                skipDuplicates: true
              }
            }
          : undefined
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        status: true,
        createdAt: true
      }
    });

    await writeAuditLog(tx, {
      actorId,
      action: "user.create",
      entityType: "users",
      entityId: user.id
    });

    return user;
  });
}

export async function updateUser(
  db: PrismaClient,
  actorId: string,
  id: string,
  input: {
    fullName?: string;
    phone?: string | null;
    avatarUrl?: string | null;
    title?: string | null;
    departmentId?: string | null;
    managerId?: string | null;
    status?: "ACTIVE" | "INACTIVE" | "LOCKED";
    roleIds?: string[];
    teamIds?: string[];
  }
) {
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw notFound("Không tìm thấy người dùng.");
  }

  await assertExistingTeams(db, input.teamIds);

  return db.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: {
        fullName: input.fullName,
        phone: input.phone,
        avatarUrl: input.avatarUrl,
        title: input.title,
        departmentId: input.departmentId,
        managerId: input.managerId,
        status: input.status
      },
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        status: true
      }
    });

    if (input.roleIds) {
      await tx.userRole.deleteMany({ where: { userId: id } });
      await tx.userRole.createMany({
        data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
        skipDuplicates: true
      });
    }

    if (input.teamIds) {
      await tx.teamMember.deleteMany({ where: { userId: id } });
      await tx.teamMember.createMany({
        data: input.teamIds.map((teamId) => ({ userId: id, teamId })),
        skipDuplicates: true
      });
    }

    await writeAuditLog(tx, {
      actorId,
      action: "user.update",
      entityType: "users",
      entityId: id
    });

    return user;
  });
}

export async function listDepartments(db: PrismaClient) {
  return db.department.findMany({
    where: { deletedAt: null },
    orderBy: [{ parentId: "asc" }, { name: "asc" }],
    include: {
      manager: { select: { id: true, fullName: true } },
      branch: { select: { id: true, name: true } },
      parent: { select: { id: true, code: true, name: true } },
      _count: { select: { users: true, tasks: true } }
    }
  });
}

async function assertValidDepartmentParent(db: PrismaClient, id: string | undefined, parentId: string | null | undefined) {
  if (!parentId) return;
  if (id && parentId === id) {
    throw badRequest("Phòng ban cha không được trùng với phòng ban đang chỉnh sửa.");
  }

  let cursor = await db.department.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true, deletedAt: true }
  });
  if (!cursor || cursor.deletedAt) {
    throw notFound("Không tìm thấy phòng ban cha.");
  }

  const visited = new Set<string>();
  while (cursor?.parentId) {
    if (id && cursor.parentId === id) {
      throw badRequest("Không thể tạo quan hệ vòng lặp trong cơ cấu phòng ban.");
    }
    if (visited.has(cursor.parentId)) {
      throw badRequest("Cơ cấu phòng ban hiện có quan hệ vòng lặp.");
    }
    visited.add(cursor.parentId);
    cursor = await db.department.findUnique({
      where: { id: cursor.parentId },
      select: { id: true, parentId: true, deletedAt: true }
    });
  }
}

export async function upsertDepartment(
  db: PrismaClient,
  actorId: string,
  input: {
    id?: string;
    code: string;
    name: string;
    description?: string;
    parentId?: string | null;
    managerId?: string | null;
  }
) {
  await assertValidDepartmentParent(db, input.id, input.parentId);

  return db.$transaction(async (tx) => {
    const department = input.id
      ? await tx.department.update({
          where: { id: input.id },
          data: {
            code: input.code,
            name: input.name,
            description: input.description,
            parentId: input.parentId,
            managerId: input.managerId
          }
        })
      : await tx.department.create({
          data: {
            code: input.code,
            name: input.name,
            description: input.description,
            parentId: input.parentId,
            managerId: input.managerId
          }
        });

    await writeAuditLog(tx, {
      actorId,
      action: input.id ? "department.update" : "department.create",
      entityType: "departments",
      entityId: department.id
    });

    return department;
  });
}

async function assertExistingTeams(db: PrismaClient, teamIds: string[] | undefined) {
  const uniqueTeamIds = [...new Set(teamIds ?? [])];
  if (uniqueTeamIds.length === 0) return;

  const existingCount = await db.team.count({
    where: { id: { in: uniqueTeamIds }, deletedAt: null }
  });
  if (existingCount !== uniqueTeamIds.length) {
    throw badRequest("Danh sÃ¡ch nhÃ³m lÃ m viá»‡c khÃ´ng há»£p lá»‡.");
  }
}

const teamInclude = {
  department: { select: { id: true, code: true, name: true } },
  members: {
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, employeeCode: true, fullName: true, email: true, department: { select: { id: true, name: true } } } } }
  },
  _count: { select: { members: true } }
} satisfies Prisma.TeamInclude;

async function assertValidTeamReferences(
  db: PrismaClient,
  input: { departmentId?: string | null; memberIds?: string[] }
) {
  if (input.departmentId) {
    const department = await db.department.findFirst({
      where: { id: input.departmentId, deletedAt: null },
      select: { id: true }
    });
    if (!department) {
      throw notFound("KhÃ´ng tÃ¬m tháº¥y phÃ²ng ban cá»§a nhÃ³m.");
    }
  }

  const memberIds = [...new Set(input.memberIds ?? [])];
  if (memberIds.length > 0) {
    const activeCount = await db.user.count({
      where: { id: { in: memberIds }, status: "ACTIVE", deletedAt: null }
    });
    if (activeCount !== memberIds.length) {
      throw badRequest("Danh sÃ¡ch thÃ nh viÃªn nhÃ³m cÃ³ ngÆ°á»i dÃ¹ng khÃ´ng há»£p lá»‡ hoáº·c khÃ´ng hoáº¡t Ä‘á»™ng.");
    }
  }
}

export async function listTeams(db: PrismaClient) {
  return db.team.findMany({
    where: { deletedAt: null },
    orderBy: [{ departmentId: "asc" }, { name: "asc" }],
    include: teamInclude
  });
}

export async function upsertTeam(
  db: PrismaClient,
  actorId: string,
  input: {
    id?: string;
    code: string;
    name: string;
    departmentId?: string | null;
    memberIds?: string[];
  }
) {
  await assertValidTeamReferences(db, input);
  const memberIds = [...new Set(input.memberIds ?? [])];
  const codeOwner = await db.team.findUnique({ where: { code: input.code }, select: { id: true, deletedAt: true } });
  if (codeOwner && codeOwner.id !== input.id) {
    throw conflict("MÃ£ nhÃ³m lÃ m viá»‡c Ä‘Ã£ tá»“n táº¡i.");
  }
  if (input.id) {
    const existing = await db.team.findUnique({ where: { id: input.id }, select: { id: true, deletedAt: true } });
    if (!existing || existing.deletedAt) {
      throw notFound("KhÃ´ng tÃ¬m tháº¥y nhÃ³m lÃ m viá»‡c.");
    }
  }

  return db.$transaction(async (tx) => {
    const team = input.id
      ? await tx.team.update({
          where: { id: input.id },
          data: {
            code: input.code,
            name: input.name,
            departmentId: input.departmentId
          }
        })
      : await tx.team.create({
          data: {
            code: input.code,
            name: input.name,
            departmentId: input.departmentId
          }
        });

    if (input.memberIds) {
      await tx.teamMember.deleteMany({ where: { teamId: team.id } });
      await tx.teamMember.createMany({
        data: memberIds.map((userId) => ({ teamId: team.id, userId })),
        skipDuplicates: true
      });
    }

    await writeAuditLog(tx, {
      actorId,
      action: input.id ? "team.update" : "team.create",
      entityType: "teams",
      entityId: team.id
    });

    return tx.team.findUniqueOrThrow({ where: { id: team.id }, include: teamInclude });
  });
}

export async function listRoles(db: PrismaClient) {
  return db.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: {
        include: { permission: true }
      },
      _count: { select: { users: true } }
    }
  });
}

export async function listPermissions(db: PrismaClient) {
  return db.permission.findMany({ orderBy: [{ group: "asc" }, { code: "asc" }] });
}

export async function createRole(
  db: PrismaClient,
  actorId: string,
  input: { code: string; name: string; description?: string; permissionIds?: string[] }
) {
  return db.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description,
        permissions: input.permissionIds?.length
          ? {
              createMany: {
                data: input.permissionIds.map((permissionId) => ({ permissionId })),
                skipDuplicates: true
              }
            }
          : undefined
      }
    });

    await writeAuditLog(tx, {
      actorId,
      action: "role.create",
      entityType: "roles",
      entityId: role.id
    });

    return role;
  });
}

export async function updateRolePermissions(db: PrismaClient, actorId: string, roleId: string, permissionIds: string[]) {
  return db.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true
    });
    await writeAuditLog(tx, {
      actorId,
      action: "role.permissions.update",
      entityType: "roles",
      entityId: roleId
    });
    return { ok: true };
  });
}
