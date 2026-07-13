import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { CreateNodeAssetDto, NodeAssetsService, UpdateNodeAssetDto } from "./node-assets.service";

@UseGuards(AuthGuard("jwt"))
@Controller("node-assets")
export class NodeAssetsController {
  constructor(private service: NodeAssetsService) {}

  @Get() findAll(@Query("nodeId") nodeId?: string) { return this.service.findAll(nodeId); }
  @Post() create(@Body() dto: CreateNodeAssetDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateNodeAssetDto) { return this.service.update(id, dto); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
}
