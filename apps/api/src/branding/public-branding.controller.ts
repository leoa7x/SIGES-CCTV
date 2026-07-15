import { Controller, Get } from "@nestjs/common";

import { BrandingService } from "./branding.service";

@Controller("public/branding")
export class PublicBrandingController {
  constructor(private readonly service: BrandingService) {}

  @Get("active")
  getActive() {
    return this.service.getActivePublic();
  }
}
