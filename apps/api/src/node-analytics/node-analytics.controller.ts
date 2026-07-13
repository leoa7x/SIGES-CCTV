import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  CreateNodeAnalyticsAssignmentDto,
  CreateNodeAssetAnalyticsAssignmentDto,
  NodeAnalyticsService,
} from "./node-analytics.service";

@UseGuards(AuthGuard("jwt"))
@Controller()
export class NodeAnalyticsController {
  constructor(private service: NodeAnalyticsService) {}

  @Get("analytics-catalog") findCatalog() { return this.service.findCatalog(); }
  @Post("nodes/:id/analytics") assignToNode(@Param("id") id: string, @Body() dto: CreateNodeAnalyticsAssignmentDto) {
    return this.service.assignToNode(id, dto);
  }
  @Delete("nodes/analytics/:assignmentId") removeFromNode(@Param("assignmentId") assignmentId: string) {
    return this.service.removeNodeAssignment(assignmentId);
  }
  @Post("node-assets/:id/analytics") assignToAsset(@Param("id") id: string, @Body() dto: CreateNodeAssetAnalyticsAssignmentDto) {
    return this.service.assignToAsset(id, dto);
  }
  @Delete("node-assets/analytics/:assignmentId") removeFromAsset(@Param("assignmentId") assignmentId: string) {
    return this.service.removeAssetAssignment(assignmentId);
  }
}
