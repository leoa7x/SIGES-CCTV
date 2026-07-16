import { Module } from "@nestjs/common";
import { CenterDiscoveryModule } from "../center-discovery/center-discovery.module";
import { MonitoringCentersController } from "./monitoring-centers.controller";
import { MonitoringCentersService } from "./monitoring-centers.service";

@Module({
  imports: [CenterDiscoveryModule],
  controllers: [MonitoringCentersController],
  providers: [MonitoringCentersService],
})
export class MonitoringCentersModule {}
