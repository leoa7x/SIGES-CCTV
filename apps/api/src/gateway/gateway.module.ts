import { Module } from "@nestjs/common";
import { OpsGateway } from "./ops.gateway";

@Module({
  providers: [OpsGateway],
})
export class GatewayModule {}
