import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../prisma.js";
import { paginate, paginationSchema } from "../../http/pagination.js";
import { parseBody, parseParams, parseQuery } from "../../http/validation.js";
import { requireAuth, requirePermission } from "../auth/auth.guard.js";
import {
  changeOwnPassword,
  createRole,
  createUser,
  getProfile,
  getProfileRelated,
  listDepartments,
  listOwnActivity,
  listPermissions,
  listRoles,
  listTeams,
  listUsers,
  updateOwnProfile,
  updateRolePermissions,
  updateUser,
  upsertDepartment,
  upsertTeam
} from "./identity.service.js";

const idParamSchema = z.object({ id: z.string().uuid() });

const userQuerySchema = paginationSchema.extend({
  keyword: z.string().optional()
});

const externalAvatarUrlSchema = z.string().url();
const avatarUrlSchema = z.string().max(500).refine(
  (value) => value.startsWith("/api/v1/avatars/") || externalAvatarUrlSchema.safeParse(value).success,
  "Ảnh đại diện phải là URL hợp lệ."
);

const createUserSchema = z.object({
  employeeCode: z.string().min(2),
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  avatarUrl: avatarUrlSchema.optional(),
  title: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  roleIds: z.array(z.string().uuid()).default([]),
  teamIds: z.array(z.string().uuid()).default([])
});

const updateUserSchema = createUserSchema
  .omit({ employeeCode: true, email: true, password: true })
  .partial()
  .extend({
    status: z.enum(["ACTIVE", "INACTIVE", "LOCKED"]).optional(),
    phone: z.string().nullable().optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    title: z.string().nullable().optional(),
    departmentId: z.string().uuid().nullable().optional(),
    managerId: z.string().uuid().nullable().optional()
  });

const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  avatarUrl: avatarUrlSchema.nullable().optional(),
  title: z.string().max(120).nullable().optional()
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128)
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại."
  });

const departmentSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  managerId: z.string().uuid().nullable().optional()
});

const teamSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2),
  name: z.string().min(2),
  departmentId: z.string().uuid().nullable().optional(),
  memberIds: z.array(z.string().uuid()).default([])
});

const roleSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).default([])
});

const rolePermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid())
});

export async function identityRoutes(app: FastifyInstance) {
  app.get("/profile", { preHandler: requireAuth }, async (request) => {
    return getProfile(prisma, request.auth!.userId);
  });

  app.patch("/profile", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, profileUpdateSchema);
    return updateOwnProfile(prisma, request.auth!.userId, body);
  });

  app.post("/profile/password", { preHandler: requireAuth }, async (request) => {
    const body = parseBody(request, changePasswordSchema);
    return changeOwnPassword(prisma, request.auth!.userId, body);
  });

  app.get("/profile/activity", { preHandler: requireAuth }, async (request) => {
    const query = parseQuery(request, paginationSchema);
    const result = await listOwnActivity(prisma, request.auth!.userId, query);
    return paginate(result.data, query.page, query.pageSize, result.total);
  });

  app.get("/profile/related", { preHandler: requireAuth }, async (request) => {
    return getProfileRelated(prisma, request.auth!);
  });

  app.get("/users", { preHandler: requirePermission("user.read") }, async (request) => {
    const query = parseQuery(request, userQuerySchema);
    const result = await listUsers(prisma, query);
    return paginate(result.data, query.page, query.pageSize, result.total);
  });

  app.post("/users", { preHandler: requirePermission("user.manage") }, async (request) => {
    const body = parseBody(request, createUserSchema);
    return createUser(prisma, request.auth!.userId, body);
  });

  app.patch("/users/:id", { preHandler: requirePermission("user.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, updateUserSchema);
    return updateUser(prisma, request.auth!.userId, params.id, body);
  });

  app.get("/departments", { preHandler: requireAuth }, async () => {
    return listDepartments(prisma);
  });

  app.post("/departments", { preHandler: requirePermission("department.manage") }, async (request) => {
    const body = parseBody(request, departmentSchema);
    return upsertDepartment(prisma, request.auth!.userId, body);
  });

  app.patch("/departments/:id", { preHandler: requirePermission("department.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, departmentSchema.omit({ id: true }).partial());
    const current = await prisma.department.findUnique({ where: { id: params.id } });
    return upsertDepartment(prisma, request.auth!.userId, {
      id: params.id,
      code: body.code ?? current?.code ?? "",
      name: body.name ?? current?.name ?? "",
      description: body.description ?? current?.description ?? undefined,
      parentId: body.parentId,
      managerId: body.managerId
    });
  });

  app.get("/teams", { preHandler: requireAuth }, async () => {
    return listTeams(prisma);
  });

  app.post("/teams", { preHandler: requirePermission("department.manage") }, async (request) => {
    const body = parseBody(request, teamSchema);
    return upsertTeam(prisma, request.auth!.userId, body);
  });

  app.patch("/teams/:id", { preHandler: requirePermission("department.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, teamSchema.omit({ id: true }).partial());
    const current = await prisma.team.findUnique({ where: { id: params.id }, include: { members: true } });
    return upsertTeam(prisma, request.auth!.userId, {
      id: params.id,
      code: body.code ?? current?.code ?? "",
      name: body.name ?? current?.name ?? "",
      departmentId: body.departmentId,
      memberIds: body.memberIds ?? current?.members.map((member) => member.userId) ?? []
    });
  });

  app.get("/roles", { preHandler: requirePermission("role.read") }, async () => {
    return listRoles(prisma);
  });

  app.get("/permissions", { preHandler: requirePermission("role.read") }, async () => {
    return listPermissions(prisma);
  });

  app.post("/roles", { preHandler: requirePermission("role.manage") }, async (request) => {
    const body = parseBody(request, roleSchema);
    return createRole(prisma, request.auth!.userId, body);
  });

  app.put("/roles/:id/permissions", { preHandler: requirePermission("role.manage") }, async (request) => {
    const params = parseParams(request, idParamSchema);
    const body = parseBody(request, rolePermissionsSchema);
    return updateRolePermissions(prisma, request.auth!.userId, params.id, body.permissionIds);
  });
}
