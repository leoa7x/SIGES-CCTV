import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CitiesModule } from "./cities/cities.module";
import { ProjectsModule } from "./projects/projects.module";
import { MonitoringCentersModule } from "./monitoring-centers/monitoring-centers.module";
import { RoutesModule } from "./routes/routes.module";
import { NodesModule } from "./nodes/nodes.module";
import { CamerasModule } from "./cameras/cameras.module";
import { IncidentsModule } from "./incidents/incidents.module";
import { LogbookModule } from "./logbook/logbook.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { FiberSegmentsModule } from "./fiber-segments/fiber-segments.module";
import { FiberPointsModule } from "./fiber-points/fiber-points.module";
import { FiberCablesModule } from "./fiber-cables/fiber-cables.module";
import { EventsModule } from "./events/events.module";
import { SplicesModule } from "./splices/splices.module";
import { MonitorModule } from "./monitor/monitor.module";
import { GatewayModule } from "./gateway/gateway.module";
import { NodeAssetsModule } from "./node-assets/node-assets.module";
import { NodeAnalyticsModule } from "./node-analytics/node-analytics.module";
import { NodeDiscoveryModule } from "./node-discovery/node-discovery.module";
import { NetworkTelemetryModule } from "./network-telemetry/network-telemetry.module";
import { ObservabilityModule } from "./observability/observability.module";
import { CameraPreviewModule } from "./camera-preview/camera-preview.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CitiesModule,
    ProjectsModule,
    MonitoringCentersModule,
    RoutesModule,
    NodesModule,
    CamerasModule,
    CameraPreviewModule,
    IncidentsModule,
    LogbookModule,
    DashboardModule,
    FiberSegmentsModule,
    FiberPointsModule,
    FiberCablesModule,
    EventsModule,
    SplicesModule,
    MonitorModule,
    GatewayModule,
    NodeAssetsModule,
    NodeAnalyticsModule,
    NodeDiscoveryModule,
    NetworkTelemetryModule,
    ObservabilityModule,
  ],
})
export class AppModule {}
