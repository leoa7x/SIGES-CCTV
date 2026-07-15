import { ForbiddenException, Injectable } from "@nestjs/common";
import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { EntityState, Permission, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";

const ELEVATED_ROLES = new Set<UserRole>([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

// Granting MANAGE_USERS lets an account administer other users, but it must
// never be enough on its own to reach SUPER_ADMIN/ADMIN — only an existing
// SUPER_ADMIN can hand out or touch elevated roles/state, and no one may
// edit the role/permissions/state of an existing elevated account except a
// SUPER_ADMIN. Without this, any user granted MANAGE_USERS could promote
// themselves straight to SUPER_ADMIN, or simply deactivate every ADMIN/
// SUPER_ADMIN account to sideline them without ever touching their role.
function assertRoleChangeAllowed(
  requesterRole: UserRole,
  targetCurrentRole: UserRole | undefined,
  dto: { role?: UserRole; permissions?: Permission[]; state?: EntityState },
) {
  if (requesterRole === UserRole.SUPER_ADMIN) return;

  if (dto.role !== undefined && ELEVATED_ROLES.has(dto.role)) {
    throw new ForbiddenException("Only a super admin can assign the SUPER_ADMIN or ADMIN role");
  }
  const touchesElevatedFields = dto.role !== undefined || dto.permissions !== undefined || dto.state !== undefined;
  if (targetCurrentRole && ELEVATED_ROLES.has(targetCurrentRole) && touchesElevatedFields) {
    throw new ForbiddenException("Only a super admin can change the role, permissions, or state of an elevated account");
  }
}

// Even a SUPER_ADMIN cannot leave the system with zero active super admins —
// there is no in-app recovery path (the seed script only creates a SUPER_ADMIN
// if none exists by email; it will not reactivate or promote an existing one),
// so this is the only thing standing between an accidental self-lockout and a
// direct database fix.
async function assertKeepsAtLeastOneActiveSuperAdmin(
  prisma: PrismaService,
  target: { id: string; role: UserRole; state: EntityState },
  dto: { role?: UserRole; state?: EntityState },
) {
  const wasActiveSuperAdmin = target.role === UserRole.SUPER_ADMIN && target.state === EntityState.ACTIVE;
  if (!wasActiveSuperAdmin) return;

  const staysActiveSuperAdmin =
    (dto.role ?? target.role) === UserRole.SUPER_ADMIN && (dto.state ?? target.state) === EntityState.ACTIVE;
  if (staysActiveSuperAdmin) return;

  const otherActiveSuperAdmins = await prisma.user.count({
    where: { id: { not: target.id }, role: UserRole.SUPER_ADMIN, state: EntityState.ACTIVE },
  });
  if (otherActiveSuperAdmins === 0) {
    throw new ForbiddenException("Cannot demote or deactivate the last active super admin");
  }
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  permissions: true,
  state: true,
  createdAt: true,
} as const;

function normalizePermissions(role: UserRole | undefined, permissions: Permission[] | undefined) {
  if (!role || role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN) {
    return [];
  }
  return [...new Set(permissions ?? [])];
}

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() name?: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsArray() @IsEnum(Permission, { each: true }) permissions?: Permission[];
}

export class UpdateUserDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;
  @IsOptional() @IsArray() @IsEnum(Permission, { each: true }) permissions?: Permission[];
  @IsOptional() @IsEnum(EntityState) state?: EntityState;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: USER_SELECT,
      orderBy: { email: "asc" },
    });
  }

  findOne(id: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id },
      select: USER_SELECT,
    });
  }

  // Deliberately minimal (no role/permissions/state) — unlike findAll(),
  // this is reachable by any authenticated user, not just MANAGE_USERS holders.
  findTechnicians() {
    return this.prisma.user.findMany({
      where: { role: UserRole.TECHNICIAN, state: EntityState.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  }

  async create(dto: CreateUserDto, requesterRole: UserRole) {
    assertRoleChangeAllowed(requesterRole, undefined, dto);
    const { password, ...rest } = dto;
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({
      data: {
        ...rest,
        permissions: normalizePermissions(rest.role, rest.permissions),
        passwordHash,
      },
      select: USER_SELECT,
    });
  }

  async update(id: string, dto: UpdateUserDto, requesterRole: UserRole) {
    if (dto.role !== undefined || dto.permissions !== undefined || dto.state !== undefined) {
      const target = await this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: { id: true, role: true, state: true },
      });
      assertRoleChangeAllowed(requesterRole, target.role, dto);
      await assertKeepsAtLeastOneActiveSuperAdmin(this.prisma, target, dto);
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.role || dto.permissions
          ? {
              permissions: normalizePermissions(dto.role, dto.permissions),
            }
          : {}),
      },
      select: USER_SELECT,
    });
  }
}
