import { Module } from "@nestjs/common";
import { FiberSegmentsController } from "./fiber-segments.controller";
import { FiberSegmentsService } from "./fiber-segments.service";

@Module({
  controllers: [FiberSegmentsController],
  providers: [FiberSegmentsService],
})
export class FiberSegmentsModule {}
