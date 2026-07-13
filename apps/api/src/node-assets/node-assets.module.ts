import { Module } from "@nestjs/common";
import { NodeAssetsController } from "./node-assets.controller";
import { NodeAssetsService } from "./node-assets.service";

@Module({
  controllers: [NodeAssetsController],
  providers: [NodeAssetsService],
  exports: [NodeAssetsService],
})
export class NodeAssetsModule {}
