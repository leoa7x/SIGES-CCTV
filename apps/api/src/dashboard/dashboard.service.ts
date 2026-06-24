import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const [
      totalNodes,
      onlineNodes,
      offlineNodes,
      totalCameras,
      onlineCameras,
      openIncidents,
      criticalIncidents,
      recentIncidents,
    ] = await Promise.all([
      this.prisma.node.count(),
      this.prisma.node.count({ where: { operativeState: "ONLINE" } }),
      this.prisma.node.count({ where: { operativeState: "OFFLINE" } }),
      this.prisma.camera.count(),
      this.prisma.camera.count({ where: { state: "ONLINE" } }),
      this.prisma.incident.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      this.prisma.incident.count({ where: { severity: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      this.prisma.incident.findMany({
        where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
        orderBy: { detectedAt: "desc" },
        take: 5,
        include: { node: true, assignedUser: { select: { name: true, email: true } } },
      }),
    ]);

    return {
      nodes: { total: totalNodes, online: onlineNodes, offline: offlineNodes, degraded: totalNodes - onlineNodes - offlineNodes },
      cameras: { total: totalCameras, online: onlineCameras, offline: totalCameras - onlineCameras },
      incidents: { open: openIncidents, critical: criticalIncidents },
      recentIncidents,
    };
  }
}
