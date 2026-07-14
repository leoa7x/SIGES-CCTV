export type GrafanaDashboardKey = "node-observability" | "network-command-view";

export type GrafanaEmbedDescriptor = {
  title: string;
  dashboard: GrafanaDashboardKey;
  url: string;
  params: Record<string, string>;
};
