import { Module } from "@nestjs/common";
import { HeartbeatModule } from "../heartbeat/heartbeat.module";
import { NodeAssetsModule } from "../node-assets/node-assets.module";
import { PrismaModule } from "../prisma/prisma.module";
import { NodeDiscoveryController } from "./node-discovery.controller";
import { NodeHeartbeatScheduler } from "./node-heartbeat-scheduler.service";
import { NodeDiscoveryService } from "./node-discovery.service";

@Module({
  imports: [PrismaModule, NodeAssetsModule, HeartbeatModule],
  controllers: [NodeDiscoveryController],
  providers: [NodeDiscoveryService, NodeHeartbeatScheduler],
  exports: [NodeDiscoveryService],
})
export class NodeDiscoveryModule {}
