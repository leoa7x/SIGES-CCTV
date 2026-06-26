import { Module } from "@nestjs/common";
import { MonitorController } from "./monitor.controller";
import { MonitorService } from "./monitor.service";
import { EventsModule } from "../events/events.module";

@Module({
  imports: [EventsModule],
  controllers: [MonitorController],
  providers: [MonitorService],
})
export class MonitorModule {}
