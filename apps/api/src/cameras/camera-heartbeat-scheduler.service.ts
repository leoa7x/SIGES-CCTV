import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { CameraState } from "@prisma/client";

import { cameraHeartbeatIntervalMs, cameraHeartbeatPorts, heartbeatConcurrency } from "../heartbeat/heartbeat.constants";
import { mapWithConcurrency } from "../heartbeat/heartbeat-concurrency";
import { HeartbeatProbeService } from "../heartbeat/heartbeat-probe.service";
import { isValidIp } from "../node-discovery/node-discovery.utils";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CameraHeartbeatScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CameraHeartbeatScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly probe: HeartbeatProbeService) {}

  onModuleInit() {
    const intervalMs = cameraHeartbeatIntervalMs();
    this.logger.log(`Camera heartbeat enabled every ${intervalMs}ms`);
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async runCycle() {
    if (this.running) return;
    this.running = true;
    try {
      const cameras = await this.prisma.camera.findMany({
        where: { ip: { not: null }, state: { in: [CameraState.ONLINE, CameraState.OFFLINE] } },
        select: { id: true, ip: true },
      });
      await mapWithConcurrency(cameras, heartbeatConcurrency(), async (camera) => {
        if (!camera.ip || !isValidIp(camera.ip)) return;
        const result = await this.probe.probeIp(camera.ip, cameraHeartbeatPorts());
        await this.prisma.camera.update({
          where: { id: camera.id },
          data: {
            state: result.reachable ? CameraState.ONLINE : CameraState.OFFLINE,
            lastPreviewCheckAt: result.checkedAt,
            lastPreviewStatus: result.reachable ? `NETWORK_REACHABLE${result.detail ? ` (${result.detail})` : ""}` : "NETWORK_UNREACHABLE",
          },
        });
      });
    } catch (error) {
      this.logger.error(`Camera heartbeat cycle failed: ${error instanceof Error ? error.message : error}`);
    } finally { this.running = false; }
  }
}
