import { Module } from "@nestjs/common";
import { NodeAnalyticsController } from "./node-analytics.controller";
import { NodeAnalyticsService } from "./node-analytics.service";

@Module({
  controllers: [NodeAnalyticsController],
  providers: [NodeAnalyticsService],
})
export class NodeAnalyticsModule {}
