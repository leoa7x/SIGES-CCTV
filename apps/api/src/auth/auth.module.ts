import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ThrottlerModule } from "@nestjs/throttler";
import { requireEnv } from "../common/env";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy } from "./jwt.strategy";

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: requireEnv("JWT_SECRET"),
      signOptions: { expiresIn: "8h" },
    }),
    // Scoped to this module only — brute-force protection for /auth/login,
    // does not affect rate limits anywhere else in the API.
    ThrottlerModule.forRoot([{ name: "login", ttl: 60_000, limit: 5 }]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
