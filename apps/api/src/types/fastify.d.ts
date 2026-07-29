import "fastify";

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  departmentId: string | null;
  managerId: string | null;
  permissions: string[];
  roles: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
    };
  }
}

