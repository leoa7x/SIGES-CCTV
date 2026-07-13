import { Module } from "@nestjs/common";
import { SplicesController } from "./splices.controller";
import { SplicesService } from "./splices.service";

@Module({
  controllers: [SplicesController],
  providers: [SplicesService],
})
export class SplicesModule {}
