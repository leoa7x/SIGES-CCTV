import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaModule } from "../prisma/prisma.module";
import { NetworkTelemetryController } from "./network-telemetry.controller";
import { NetworkTelemetryService } from "./network-telemetry.service";
import { NtopngClient } from "./ntopng-client";

@Module({
  imports: [PrismaModule],
  controllers: [NetworkTelemetryController],
  providers: [
    NetworkTelemetryService,
    {
      provide: NtopngClient,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => new NtopngClient({
        baseUrl: configService.getOrThrow<string>("NTOPNG_BASE_URL"),
        username: configService.getOrThrow<string>("NTOPNG_USERNAME"),
        password: configService.getOrThrow<string>("NTOPNG_PASSWORD"),
      }),
    },
  ],
  exports: [NetworkTelemetryService, NtopngClient],
})
export class NetworkTelemetryModule {}
