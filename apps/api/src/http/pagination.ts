import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function toPagination(query: unknown): PaginationQuery {
  return paginationSchema.parse(query);
}

export function paginate<T>(data: T[], page: number, pageSize: number, total: number) {
  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize))
    }
  };
}

