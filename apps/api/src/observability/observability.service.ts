import { Injectable } from "@nestjs/common";

import { GrafanaDashboardKey, GrafanaEmbedDescriptor } from "./observability.types";

export type ObservabilityConfig = {
  baseUrl: string;
  orgId: string;
  dashboards: Record<GrafanaDashboardKey, string>;
};

type GrafanaEmbedInput = {
  dashboard: GrafanaDashboardKey;
  nodeId?: string;
  routeId?: string;
  centerId?: string;
  from?: string;
  to?: string;
};

const DASHBOARD_TITLES: Record<GrafanaDashboardKey, string> = {
  "node-observability": "Observabilidad del nodo",
  "network-command-view": "Vista global de red",
};

function normalizeDashboardUid(rawValue: string) {
  const trimmed = rawValue.trim().replace(/^\/+|\/+$/g, "");
  if (!trimmed) return rawValue;
  return trimmed.split("/")[0] ?? rawValue;
}

@Injectable()
export class ObservabilityService {
  private readonly baseUrl: string;

  constructor(private readonly config: ObservabilityConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
  }

  getDashboardEmbed(input: GrafanaEmbedInput): GrafanaEmbedDescriptor {
    if (!(input.dashboard in DASHBOARD_TITLES)) {
      throw new Error(`Unknown Grafana dashboard: ${input.dashboard}`);
    }

    const uid = normalizeDashboardUid(this.config.dashboards[input.dashboard]);
    const params = new URLSearchParams({
      orgId: this.config.orgId,
      // A 6h default window made these 10s-refresh panels look static —
      // each new data point was an invisible sliver against 6 hours of
      // x-axis. An hour keeps recent movement visible while still giving
      // useful context.
      from: input.from ?? "now-1h",
      to: input.to ?? "now",
      theme: "dark",
      kiosk: "tv",
    });

    if (input.nodeId) params.set("var-nodeId", input.nodeId);
    if (input.routeId) params.set("var-routeId", input.routeId);
    if (input.centerId) params.set("var-centerId", input.centerId);

    return {
      title: DASHBOARD_TITLES[input.dashboard],
      dashboard: input.dashboard,
      url: `${this.baseUrl}/d/${uid}?${params.toString()}`,
      params: Object.fromEntries(params.entries()),
    };
  }
}
