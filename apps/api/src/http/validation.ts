import type { FastifyRequest } from "fastify";
import type { ZodType } from "zod";

export function parseBody<T>(request: FastifyRequest, schema: ZodType<T>): T {
  return schema.parse(request.body);
}

export function parseQuery<T>(request: FastifyRequest, schema: ZodType<T>): T {
  return schema.parse(request.query);
}

export function parseParams<T>(request: FastifyRequest, schema: ZodType<T>): T {
  return schema.parse(request.params);
}

