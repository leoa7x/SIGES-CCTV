import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { HeartbeatProbeService } from "./heartbeat-probe.service";
import { OperationalAlertsService } from "./operational-alerts.service";

@Module({
  imports: [PrismaModule],
  providers: [HeartbeatProbeService, OperationalAlertsService],
  exports: [HeartbeatProbeService, OperationalAlertsService],
})
export class HeartbeatModule {}
