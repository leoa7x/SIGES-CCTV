import { Module } from "@nestjs/common";

import { CenterAssetsModule } from "../center-assets/center-assets.module";
import { CenterDiscoveryScheduler } from "./center-discovery-scheduler.service";
import { CenterDiscoveryController } from "./center-discovery.controller";
import { CenterDiscoveryService } from "./center-discovery.service";

@Module({
  imports: [CenterAssetsModule],
  controllers: [CenterDiscoveryController],
  providers: [CenterDiscoveryService, CenterDiscoveryScheduler],
  exports: [CenterDiscoveryService],
})
export class CenterDiscoveryModule {}
