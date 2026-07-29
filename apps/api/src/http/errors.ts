import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Bạn cần đăng nhập để thực hiện thao tác này."): ApiError {
  return new ApiError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Bạn không có quyền thực hiện thao tác này."): ApiError {
  return new ApiError(403, "FORBIDDEN", message);
}

export function notFound(message = "Không tìm thấy dữ liệu."): ApiError {
  return new ApiError(404, "NOT_FOUND", message);
}

export function conflict(message: string, details?: unknown): ApiError {
  return new ApiError(409, "CONFLICT", message, details);
}

export function validationError(error: ZodError): ApiError {
  return new ApiError(422, "VALIDATION_ERROR", "Dữ liệu không hợp lệ.", error.flatten());
}

export function registerErrorHandler() {
  return (error: FastifyError | ApiError, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      const apiError = validationError(error);
      return reply.status(apiError.statusCode).send({
        error: {
          code: apiError.code,
          message: apiError.message,
          details: apiError.details
        }
      });
    }

    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    }

    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    return reply.status(statusCode).send({
      error: {
        code: statusCode === 500 ? "INTERNAL_ERROR" : "REQUEST_ERROR",
        message: statusCode === 500 ? "Hệ thống đang gặp lỗi. Vui lòng thử lại sau." : error.message
      }
    });
  };
}

