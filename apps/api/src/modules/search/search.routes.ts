import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseQuery } from "../../http/validation.js";
import { prisma } from "../../prisma.js";
import { requireAuth } from "../auth/auth.guard.js";
import { hasPermission } from "../auth/policy.js";
import { visibleTaskWhere } from "../tasks/task.service.js";
import { visibleWorkflowInstanceWhere } from "../workflows/workflow.service.js";

const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(100),
  pageSize: z.coerce.number().int().min(1).max(10).default(5)
});

export async function searchRoutes(app: FastifyInstance) {
  app.get("/search", { preHandler: requireAuth }, async (request) => {
    const query = parseQuery(request, searchQuerySchema);
    const auth = request.auth!;
    const keyword = query.q;
    const taskScope = await visibleTaskWhere(prisma, auth);
    const workflowScope = visibleWorkflowInstanceWhere(auth);
    const userSearchEnabled = hasPermission(auth, "user.read");

    const [tasks, workflowInstances, users] = await Promise.all([
      prisma.task.findMany({
        where: {
          AND: [
            taskScope,
            {
              OR: [
                { code: { contains: keyword, mode: "insensitive" } },
                { title: { contains: keyword, mode: "insensitive" } },
                { description: { contains: keyword, mode: "insensitive" } }
              ]
            }
          ]
        },
        take: query.pageSize,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          dueDate: true,
          department: { select: { name: true } }
        }
      }),
      prisma.workflowInstance.findMany({
        where: {
          AND: [
            workflowScope,
            {
              OR: [
                { code: { contains: keyword, mode: "insensitive" } },
                { template: { name: { contains: keyword, mode: "insensitive" } } },
                { currentStep: { name: { contains: keyword, mode: "insensitive" } } }
              ]
            }
          ]
        },
        take: query.pageSize,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          code: true,
          status: true,
          template: { select: { name: true } },
          currentStep: { select: { name: true } }
        }
      }),
      userSearchEnabled
        ? prisma.user.findMany({
            where: {
              deletedAt: null,
              OR: [
                { fullName: { contains: keyword, mode: "insensitive" } },
                { email: { contains: keyword, mode: "insensitive" } },
                { employeeCode: { contains: keyword, mode: "insensitive" } }
              ]
            },
            take: query.pageSize,
            orderBy: { fullName: "asc" },
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              email: true,
              title: true,
              department: { select: { name: true } }
            }
          })
        : Promise.resolve([])
    ]);

    return { query: keyword, tasks, workflowInstances, users };
  });
}
