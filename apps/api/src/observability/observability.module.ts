import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ObservabilityController } from "./observability.controller";
import { ObservabilityService } from "./observability.service";

@Module({
  controllers: [ObservabilityController],
  providers: [
    {
      provide: ObservabilityService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new ObservabilityService({
          baseUrl: configService.getOrThrow<string>("GRAFANA_BASE_URL"),
          orgId: configService.getOrThrow<string>("GRAFANA_ORG_ID"),
          dashboards: {
            "node-observability": configService.getOrThrow<string>("GRAFANA_DASHBOARD_NODE_OBSERVABILITY_UID"),
            "network-command-view": configService.getOrThrow<string>("GRAFANA_DASHBOARD_NETWORK_COMMAND_VIEW_UID"),
          },
        }),
    },
  ],
})
export class ObservabilityModule {}
