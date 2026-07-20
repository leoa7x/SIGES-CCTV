import { NtopngObservedHost } from "./ntopng-collector.types";

type FetchLike = typeof fetch;

export class NtopngClient {
  constructor(
    private readonly config: {
      baseUrl: string;
      username: string;
      password: string;
      fetchImpl?: FetchLike;
    },
  ) {}

  async fetchObservedHosts(): Promise<NtopngObservedHost[]> {
    const response = await (this.config.fetchImpl ?? fetch)(`${this.config.baseUrl}/api/hosts`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`,
      },
    });
    if (!response.ok) throw new Error(`ntopng request failed with ${response.status}`);
    const payload = await response.json() as { hosts?: Array<Record<string, unknown>> };
    return (payload.hosts ?? []).map((host, index) => ({
      ip: typeof host.ip === "string" ? host.ip : undefined,
      mac: typeof host.mac === "string" ? host.mac : undefined,
      hostname: typeof host.name === "string" ? host.name : undefined,
      bytesIn: this.readMetric(host, "bytes_rcvd", index),
      bytesOut: this.readMetric(host, "bytes_sent", index),
      flowCount: this.readMetric(host, "flows", index),
      lastSeenAt: this.readTimestamp(host, index),
    }));
  }

  private readMetric(host: Record<string, unknown>, field: string, index: number): number {
    const value = host[field];
    if (
      (typeof value !== "number" && typeof value !== "string")
      || (typeof value === "string" && value.trim().length === 0)
      || !Number.isFinite(Number(value))
    ) {
      throw new Error(`ntopng host row ${index} is missing a valid ${field} value`);
    }
    return Number(value);
  }

  private readTimestamp(host: Record<string, unknown>, index: number): string {
    const value = host.last_seen;
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`ntopng host row ${index} is missing a valid last_seen value`);
    }
    return value;
  }
}
