import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Permission, UserRole } from "@prisma/client";
import { Request } from "express";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";

type AuthedUser = { role: UserRole; permissions: Permission[] };

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<Request & { user: AuthedUser }>();
    if (!user) return false;

    // SUPER_ADMIN and ADMIN keep full operational access. Granular permissions
    // apply only to the lower roles managed from the users console.
    if (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN) return true;

    return required.some((permission) => user.permissions?.includes(permission));
  }
}
