import { Body, Controller, Delete, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Permission } from "@prisma/client";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import {
  CreateNodeAnalyticsAssignmentDto,
  CreateNodeAssetAnalyticsAssignmentDto,
  NodeAnalyticsService,
} from "./node-analytics.service";

@UseGuards(AuthGuard("jwt"), PermissionsGuard)
@Controller()
export class NodeAnalyticsController {
  constructor(private service: NodeAnalyticsService) {}

  @Get("analytics-catalog") findCatalog() { return this.service.findCatalog(); }

  @RequirePermissions(Permission.MANAGE_NODES)
  @Post("nodes/:id/analytics") assignToNode(@Param("id") id: string, @Body() dto: CreateNodeAnalyticsAssignmentDto) {
    return this.service.assignToNode(id, dto);
  }
  @RequirePermissions(Permission.MANAGE_NODES)
  @Delete("nodes/analytics/:assignmentId") removeFromNode(@Param("assignmentId") assignmentId: string) {
    return this.service.removeNodeAssignment(assignmentId);
  }
  @RequirePermissions(Permission.MANAGE_NODES)
  @Post("node-assets/:id/analytics") assignToAsset(@Param("id") id: string, @Body() dto: CreateNodeAssetAnalyticsAssignmentDto) {
    return this.service.assignToAsset(id, dto);
  }
  @RequirePermissions(Permission.MANAGE_NODES)
  @Delete("node-assets/analytics/:assignmentId") removeFromAsset(@Param("assignmentId") assignmentId: string) {
    return this.service.removeAssetAssignment(assignmentId);
  }
}
