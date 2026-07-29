import type { AuthContext } from "../../types/fastify.js";
import { forbidden } from "../../http/errors.js";

export function hasPermission(auth: AuthContext | undefined, permission: string): boolean {
  return Boolean(auth?.permissions.includes(permission));
}

export function requirePermissionCode(auth: AuthContext | undefined, permission: string) {
  if (!hasPermission(auth, permission)) {
    throw forbidden();
  }
}

export function canManageSystem(auth: AuthContext | undefined): boolean {
  return hasPermission(auth, "setting.manage") || hasPermission(auth, "role.manage");
}

