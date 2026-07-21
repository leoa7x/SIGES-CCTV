import type { TelemetryOwner } from "./network-telemetry-correlation";

export type { NtopngObservedHost } from "./ntopng-collector.types";

export type NtopngCollectorDependencies = {
  correlateHost: (host: import("./ntopng-collector.types").NtopngObservedHost) => Promise<TelemetryOwner>;
  intervalSeconds?: number;
  externalDiscovery?: {
    upsertScanFindings: (
      centerId: string,
      expectedSubnetCidr: string | null,
      observedFromTargetIp: string | null,
      devices: Array<{
        ip?: string | null;
        mac?: string | null;
        hostname?: string | null;
      }>,
      source: "NTOPNG",
    ) => Promise<void>;
  };
};

export type NetworkTelemetryProtocolEntry = {
  name: string;
  bytes: number;
  flowCount: number;
};

export type NetworkTelemetryDestinationEntry = {
  target: string;
  kind: "IP" | "DOMAIN" | "ASN" | "UNKNOWN";
  bytes: number;
  flowCount: number;
};

export type NetworkTelemetryAssetEntry = {
  ip?: string;
  mac?: string;
  hostname?: string;
  bytesIn: number;
  bytesOut: number;
  flowCount: number;
  lastSeenAt: string;
};
