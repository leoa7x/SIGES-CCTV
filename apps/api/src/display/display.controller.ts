import { Controller, Get } from "@nestjs/common";
import { DisplayService } from "./display.service";

/** Endpoints are LAN-restricted by Caddy; do not add write actions here. */
@Controller("display")
export class DisplayController {
  constructor(private readonly service: DisplayService) {}
  @Get("overview") overview() { return this.service.overview(); }
  @Get("noc") noc() { return this.service.noc(); }
  @Get("map") map() { return this.service.map(); }
}
