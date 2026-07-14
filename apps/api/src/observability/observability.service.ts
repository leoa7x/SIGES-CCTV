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
  from?: string;
  to?: string;
};

const DASHBOARD_TITLES: Record<GrafanaDashboardKey, string> = {
  "node-observability": "Observabilidad del nodo",
  "network-command-view": "Vista global de red",
};

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

    const uid = this.config.dashboards[input.dashboard];
    const params = new URLSearchParams({
      orgId: this.config.orgId,
      from: input.from ?? "now-6h",
      to: input.to ?? "now",
      theme: "dark",
      kiosk: "tv",
    });

    if (input.nodeId) params.set("var-nodeId", input.nodeId);
    if (input.routeId) params.set("var-routeId", input.routeId);

    return {
      title: DASHBOARD_TITLES[input.dashboard],
      dashboard: input.dashboard,
      url: `${this.baseUrl}/d/${uid}?${params.toString()}`,
      params: Object.fromEntries(params.entries()),
    };
  }
}
