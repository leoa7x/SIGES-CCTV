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
    const response = await (this.config.fetchImpl ?? fetch)(`${this.config.baseUrl}/api/hosts`);
    if (!response.ok) throw new Error(`ntopng request failed with ${response.status}`);
    const payload = await response.json() as { hosts?: Array<Record<string, unknown>> };
    return (payload.hosts ?? []).map((host) => ({
      ip: typeof host.ip === "string" ? host.ip : undefined,
      mac: typeof host.mac === "string" ? host.mac : undefined,
      hostname: typeof host.name === "string" ? host.name : undefined,
      bytesIn: Number(host.bytes_rcvd ?? 0),
      bytesOut: Number(host.bytes_sent ?? 0),
      flowCount: Number(host.flows ?? 0),
      lastSeenAt: String(host.last_seen ?? new Date(0).toISOString()),
    }));
  }
}
