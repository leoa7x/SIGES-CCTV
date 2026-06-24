import { Module } from "@nestjs/common";
import { MonitoringCentersController } from "./monitoring-centers.controller";
import { MonitoringCentersService } from "./monitoring-centers.service";

@Module({ controllers: [MonitoringCentersController], providers: [MonitoringCentersService] })
export class MonitoringCentersModule {}
