import { Module } from "@nestjs/common";

import { StorageModule } from "../storage/storage.module";
import { BrandingController } from "./branding.controller";
import { BrandingService } from "./branding.service";
import { PublicBrandingController } from "./public-branding.controller";

@Module({
  imports: [StorageModule],
  controllers: [BrandingController, PublicBrandingController],
  providers: [BrandingService],
})
export class BrandingModule {}
