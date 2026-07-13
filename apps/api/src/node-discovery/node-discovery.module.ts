import { Module } from "@nestjs/common";
import { NodeAssetsModule } from "../node-assets/node-assets.module";
import { NodeDiscoveryController } from "./node-discovery.controller";
import { NodeDiscoveryService } from "./node-discovery.service";

@Module({
  imports: [NodeAssetsModule],
  controllers: [NodeDiscoveryController],
  providers: [NodeDiscoveryService],
  exports: [NodeDiscoveryService],
})
export class NodeDiscoveryModule {}
