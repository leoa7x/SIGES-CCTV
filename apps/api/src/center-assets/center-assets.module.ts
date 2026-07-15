import { Module } from "@nestjs/common";

import { CenterAssetsController } from "./center-assets.controller";
import { CenterAssetsService } from "./center-assets.service";

@Module({
  controllers: [CenterAssetsController],
  providers: [CenterAssetsService],
  exports: [CenterAssetsService],
})
export class CenterAssetsModule {}
