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
import { EventsModule } from "./events/events.module";
import { MonitorModule } from "./monitor/monitor.module";
import { GatewayModule } from "./gateway/gateway.module";

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
    IncidentsModule,
    LogbookModule,
    DashboardModule,
    FiberSegmentsModule,
    EventsModule,
    MonitorModule,
    GatewayModule,
  ],
})
export class AppModule {}
