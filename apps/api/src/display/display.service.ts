import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Deliberately small public projection for NOC displays.  It must never
 * contain credentials, RTSP URLs, MAC inventories, operator names, or any
 * mutation capability.
 */
@Injectable()
export class DisplayService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [nodes, cameras, openIncidents, criticalIncidents] = await Promise.all([
      this.prisma.node.groupBy({ by: ["operativeState"], _count: { _all: true } }),
      this.prisma.camera.groupBy({ by: ["state"], _count: { _all: true } }),
      this.prisma.incident.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      this.prisma.incident.count({ where: { severity: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
    ]);
    const nodeOnline = nodes.find((row) => row.operativeState === "ONLINE")?._count._all ?? 0;
    const nodeOffline = nodes.find((row) => row.operativeState === "OFFLINE")?._count._all ?? 0;
    const cameraOnline = cameras.find((row) => row.state === "ONLINE")?._count._all ?? 0;
    const totalNodes = nodes.reduce((sum, row) => sum + row._count._all, 0);
    const totalCameras = cameras.reduce((sum, row) => sum + row._count._all, 0);
    return {
      generatedAt: new Date().toISOString(),
      nodes: { total: totalNodes, online: nodeOnline, offline: nodeOffline, degraded: totalNodes - nodeOnline - nodeOffline },
      cameras: { total: totalCameras, online: cameraOnline, offline: totalCameras - cameraOnline },
      incidents: { open: openIncidents, critical: criticalIncidents },
    };
  }

  async noc() {
    const nodes = await this.prisma.node.findMany({
      select: {
        id: true, code: true, name: true, operativeState: true, lastHeartbeatAt: true,
        _count: { select: { cameras: true, assets: true } },
        telemetrySnapshots: { take: 1, orderBy: { capturedAt: "desc" }, select: { capturedAt: true, activeHosts: true, activeFlows: true, totalBytesIn: true, totalBytesOut: true } },
      },
      orderBy: { code: "asc" },
    });
    return {
      generatedAt: new Date().toISOString(),
      nodes: nodes.map((node) => {
        const snapshot = node.telemetrySnapshots[0];
        return {
          id: node.id, code: node.code, name: node.name, state: node.operativeState,
          lastHeartbeatAt: node.lastHeartbeatAt, cameras: node._count.cameras, assets: node._count.assets,
          telemetry: snapshot ? { capturedAt: snapshot.capturedAt, activeHosts: snapshot.activeHosts, activeFlows: snapshot.activeFlows, totalBytesIn: snapshot.totalBytesIn.toString(), totalBytesOut: snapshot.totalBytesOut.toString() } : null,
        };
      }),
    };
  }

  async map() {
    const [nodes, centers, segments] = await Promise.all([
      this.prisma.node.findMany({ select: { id: true, code: true, name: true, lat: true, lng: true, operativeState: true, hasPole: true }, orderBy: { code: "asc" } }),
      this.prisma.monitoringCenter.findMany({ select: { id: true, name: true, address: true, lat: true, lng: true }, orderBy: { name: "asc" } }),
      this.prisma.fiberSegment.findMany({ include: { nodeA: { select: { id: true, code: true, lat: true, lng: true, operativeState: true } }, nodeB: { select: { id: true, code: true, lat: true, lng: true, operativeState: true } } } }),
    ]);
    return { generatedAt: new Date().toISOString(), nodes, centers, segments: segments.map(({ id, state, nodeA, nodeB, waypoints }) => ({ id, state, nodeA, nodeB, waypoints })) };
  }
}
