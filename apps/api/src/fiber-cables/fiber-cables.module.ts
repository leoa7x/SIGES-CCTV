import { Module } from "@nestjs/common";
import { FiberCablesController } from "./fiber-cables.controller";
import { FiberCablesService } from "./fiber-cables.service";

@Module({
  controllers: [FiberCablesController],
  providers: [FiberCablesService],
})
export class FiberCablesModule {}
