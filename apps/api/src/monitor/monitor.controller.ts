import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { MonitorGuard } from "./monitor.guard";
import { MonitorService, StateChangeDto } from "./monitor.service";

@UseGuards(MonitorGuard)
@Controller("internal")
export class MonitorController {
  constructor(private service: MonitorService) {}

  @Post("state-change")
  stateChange(@Body() dto: StateChangeDto) {
    return this.service.handleStateChange(dto);
  }

  @Get("devices")
  getDevices() {
    return this.service.getDevices();
  }
}
