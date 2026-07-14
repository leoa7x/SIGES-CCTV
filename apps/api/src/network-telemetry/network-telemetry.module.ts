import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { NetworkTelemetryController } from "./network-telemetry.controller";
import { NetworkTelemetryService } from "./network-telemetry.service";

@Module({
  imports: [PrismaModule],
  controllers: [NetworkTelemetryController],
  providers: [NetworkTelemetryService],
  exports: [NetworkTelemetryService],
})
export class NetworkTelemetryModule {}
