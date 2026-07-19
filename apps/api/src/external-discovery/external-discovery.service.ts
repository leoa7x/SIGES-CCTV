import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

export type ExternalFindingSource = "SCAN" | "NTOPNG" | "SCAN_AND_NTOPNG";
export type ExternalFindingStatus = "PENDING" | "IGNORED" | "CONFIRMED";
export type ExternalFindingInput = {
  ip?: string | null;
  mac?: string | null;
  vendor?: string | null;
  model?: string | null;
  hostname?: string | null;
  candidateType?: string | null;
  discoveryConfidence?: number | null;
};

function normalizeToken(value?: string | null) {
  return value?.trim() || "";
}

function buildIdentityKey(centerId: string, device: ExternalFindingInput) {
  return [
    centerId,
    normalizeToken(device.ip),
    normalizeToken(device.mac).toUpperCase(),
    normalizeToken(device.hostname).toLowerCase(),
  ].join("|");
}

function mergeSource(current: ExternalFindingSource | undefined, incoming: "SCAN" | "NTOPNG"): ExternalFindingSource {
  if (!current || current === incoming) return incoming;
  return "SCAN_AND_NTOPNG";
}

@Injectable()
export class ExternalDiscoveryService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertScanFindings(
    centerId: string,
    expectedSubnetCidr: string | null,
    observedFromTargetIp: string | null,
    devices: ExternalFindingInput[],
    source: "SCAN" | "NTOPNG",
  ) {
    const now = new Date();

    for (const device of devices) {
      const identityKey = buildIdentityKey(centerId, device);
      const repository = (this.prisma as any).externalDiscoveryFinding;
      const existing = await repository.findUnique?.({ where: { identityKey } });
      await repository.upsert({
        where: { identityKey },
        create: {
          centerId,
          identityKey,
          source,
          ip: device.ip ?? null,
          mac: device.mac ?? null,
          vendor: device.vendor ?? null,
          model: device.model ?? null,
          hostname: device.hostname ?? null,
          candidateType: device.candidateType ?? null,
          discoveryConfidence: device.discoveryConfidence ?? null,
          outsideExpectedSubnet: true,
          expectedSubnetCidr,
          observedFromTargetIp,
          status: "PENDING",
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: {
          source: mergeSource(existing?.source, source),
          ip: device.ip ?? null,
          mac: device.mac ?? null,
          vendor: device.vendor ?? null,
          model: device.model ?? null,
          hostname: device.hostname ?? null,
          candidateType: device.candidateType ?? null,
          discoveryConfidence: device.discoveryConfidence ?? null,
          outsideExpectedSubnet: true,
          expectedSubnetCidr,
          observedFromTargetIp,
          lastSeenAt: now,
        },
      });
    }
  }

  listByCenter(centerId: string) {
    return (this.prisma as any).externalDiscoveryFinding.findMany({
      where: { centerId },
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    });
  }

  async setStatus(id: string, status: ExternalFindingStatus) {
    await (this.prisma as any).externalDiscoveryFinding.update({
      where: { id },
      data: { status },
    });
    return { ok: true };
  }
}
