import { Module } from "@nestjs/common";
import { FiberPointsController } from "./fiber-points.controller";
import { FiberPointsService } from "./fiber-points.service";

@Module({
  controllers: [FiberPointsController],
  providers: [FiberPointsService],
})
export class FiberPointsModule {}
