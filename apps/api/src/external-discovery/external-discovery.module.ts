import { Module } from "@nestjs/common";

import { ExternalDiscoveryController } from "./external-discovery.controller";
import { ExternalDiscoveryService } from "./external-discovery.service";

@Module({
  controllers: [ExternalDiscoveryController],
  providers: [ExternalDiscoveryService],
  exports: [ExternalDiscoveryService],
})
export class ExternalDiscoveryModule {}
