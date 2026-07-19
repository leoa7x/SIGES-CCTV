import { Module } from "@nestjs/common";

import { CenterAssetsModule } from "../center-assets/center-assets.module";
import { ExternalDiscoveryModule } from "../external-discovery/external-discovery.module";
import { HeartbeatModule } from "../heartbeat/heartbeat.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CenterHeartbeatScheduler } from "./center-heartbeat-scheduler.service";
import { CenterDiscoveryScheduler } from "./center-discovery-scheduler.service";
import { CenterDiscoveryController } from "./center-discovery.controller";
import { CenterDiscoveryService } from "./center-discovery.service";

@Module({
  imports: [PrismaModule, CenterAssetsModule, ExternalDiscoveryModule, HeartbeatModule],
  controllers: [CenterDiscoveryController],
  providers: [CenterDiscoveryService, CenterDiscoveryScheduler, CenterHeartbeatScheduler],
  exports: [CenterDiscoveryService],
})
export class CenterDiscoveryModule {}
