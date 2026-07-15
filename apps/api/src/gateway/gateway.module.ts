import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { requireEnv } from "../common/env";
import { OpsGateway } from "./ops.gateway";

@Module({
  imports: [
    JwtModule.register({
      secret: requireEnv("JWT_SECRET"),
    }),
  ],
  providers: [OpsGateway],
})
export class GatewayModule {}
