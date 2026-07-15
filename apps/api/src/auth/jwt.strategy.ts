import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { requireEnv } from "../common/env";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireEnv("JWT_SECRET"),
    });
  }

  // Re-checked on every request (not baked into the JWT) so a role/permission
  // change or deactivation takes effect immediately instead of waiting up to
  // 8h for the token to expire.
  async validate(payload: { sub: string; email: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, permissions: true, state: true },
    });
    if (!user || user.state !== "ACTIVE") {
      throw new UnauthorizedException("Cuenta inactiva o inexistente");
    }
    return { id: user.id, email: user.email, role: user.role, permissions: user.permissions };
  }
}
