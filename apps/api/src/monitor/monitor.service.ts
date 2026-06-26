import { Injectable, NotFoundException } from "@nestjs/common";
import { IsNotEmpty, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { EventsService } from "../events/events.service";

export class StateChangeDto {
  @IsString() @IsNotEmpty() entityType!: "node" | "camera";
  @IsString() @IsNotEmpty() entityId!: string;
  @IsString() @IsNotEmpty() oldState!: string;
  @IsString() @IsNotEmpty() newState!: string;
}

@Injectable()
export class MonitorService {
  constructor(
    private prisma: PrismaService,
    private events: EventsService,
  ) {}

  async handleStateChange(dto: StateChangeDto) {
    const { entityType, entityId, oldState, newState } = dto;
    let centerId: string;

    if (entityType === "node") {
      const node = await this.prisma.node.findUnique({
        where: { id: entityId },
        include: { route: { include: { center: true } } },
      });
      if (!node) throw new NotFoundException(`Node ${entityId} not found`);
      centerId = node.route.center.id;
      await this.prisma.node.update({
        where: { id: entityId },
        data: { operativeState: newState as Parameters<typeof this.prisma.node.update>[0]["data"]["operativeState"] },
      });
    } else {
      const camera = await this.prisma.camera.findUnique({
        where: { id: entityId },
        include: { node: { include: { route: { include: { center: true } } } } },
      });
      if (!camera) throw new NotFoundException(`Camera ${entityId} not found`);
      centerId = camera.node.route.center.id;
      await this.prisma.camera.update({
        where: { id: entityId },
        data: { state: newState as Parameters<typeof this.prisma.camera.update>[0]["data"]["state"] },
      });
    }

    await this.prisma.deviceStateLog.create({
      data: { entityType, entityId, oldState, newState, source: "MONITOR" },
    });

    await this.events.publish("siges.state-changes", {
      entityType,
      entityId,
      oldState,
      newState,
      centerId,
      timestamp: new Date().toISOString(),
    });

    return { ok: true };
  }

  async getDevices() {
    const [nodes, cameras] = await Promise.all([
      this.prisma.node.findMany({
        where: { ip: { not: null } },
        include: { route: { include: { center: true } } },
      }),
      this.prisma.camera.findMany({
        where: { ip: { not: null } },
        include: { node: { include: { route: { include: { center: true } } } } },
      }),
    ]);

    return [
      ...nodes.map((n) => ({
        id: n.id,
        type: "node" as const,
        ip: n.ip,
        mac: n.mac,
        nodeType: n.nodeType,
        snmpCommunity: n.snmpCommunity,
        state: n.operativeState,
        centerId: n.route.center.id,
      })),
      ...cameras.map((c) => ({
        id: c.id,
        type: "camera" as const,
        ip: c.ip,
        state: c.state,
        centerId: c.node.route.center.id,
      })),
    ];
  }
}
