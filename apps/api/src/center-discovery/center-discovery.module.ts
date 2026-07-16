import { Module } from "@nestjs/common";

import { CenterAssetsModule } from "../center-assets/center-assets.module";
import { CenterDiscoveryController } from "./center-discovery.controller";
import { CenterDiscoveryService } from "./center-discovery.service";

@Module({
  imports: [CenterAssetsModule],
  controllers: [CenterDiscoveryController],
  providers: [CenterDiscoveryService],
  exports: [CenterDiscoveryService],
})
export class CenterDiscoveryModule {}
