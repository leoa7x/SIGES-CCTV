import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { EntityState } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { CenterDiscoveryService } from "./center-discovery.service";

/**
 * Periodically re-scans every active CMC that has a primaryIp/scanSubnetCidr
 * configured, so CenterAsset.operativeState reflects reality instead of
 * whatever an operator last typed by hand. Disabled unless
 * CENTER_MONITORING_INTERVAL_MS is set — this must never start scanning a
 * real network just because the API booted, especially during local dev.
 */
@Injectable()
export class CenterDiscoveryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CenterDiscoveryScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly centerDiscoveryService: CenterDiscoveryService,
  ) {}

  onModuleInit() {
    const intervalMs = Number(process.env.CENTER_MONITORING_INTERVAL_MS);
    if (!intervalMs || intervalMs <= 0) {
      this.logger.log("CENTER_MONITORING_INTERVAL_MS not set — periodic CMC health checks are disabled");
      return;
    }

    this.logger.log(`Periodic CMC health checks enabled every ${intervalMs}ms`);
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async runCycle() {
    if (this.running) {
      this.logger.warn("Skipping CMC health-check cycle — the previous cycle is still running");
      return;
    }
    this.running = true;

    try {
      const centers = await this.prisma.monitoringCenter.findMany({
        where: {
          state: EntityState.ACTIVE,
          OR: [{ primaryIp: { not: null } }, { scanSubnetCidr: { not: null } }],
        },
        select: { id: true },
      });

      // Sequential on purpose: running many nmap scans concurrently against
      // different CMC subnets would spike load/traffic for no real benefit —
      // a health-check cycle isn't latency-sensitive.
      for (const center of centers) {
        try {
          await this.centerDiscoveryService.runForCenter(center.id);
        } catch (error) {
          this.logger.warn(
            `CMC health check failed for center ${center.id}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`CMC health-check cycle failed: ${error instanceof Error ? error.message : error}`);
    } finally {
      this.running = false;
    }
  }
}
