import { NtopngObservedHost } from "./ntopng-collector.types";

type FetchLike = typeof fetch;
type NtopngEnvelope<T> = { rc: number; rc_str?: string; rc_str_hr?: string; rsp: T };

export class NtopngClient {
  constructor(
    private readonly config: {
      baseUrl: string;
      username: string;
      password: string;
      seedHosts?: string[];
      fetchImpl?: FetchLike;
    },
  ) {}

  async fetchObservedHosts(): Promise<NtopngObservedHost[]> {
    const interfaces = await this.fetchJson<Array<{ ifid: number }>>("/lua/rest/v2/get/ntopng/interfaces.lua");
    const ifid = interfaces[0]?.ifid;
    if (typeof ifid !== "number") {
      throw new Error("ntopng did not return a monitored interface id");
    }

    const active = await this.fetchJson<{ data?: Array<Record<string, unknown>> }>(
      `/lua/rest/v2/get/host/active.lua?ifid=${ifid}&all=true`,
    );
    const rows = Array.isArray(active.data) ? active.data : [];

    const observed = rows.map((host, index) => this.normalizeHost(host, index));
    // ntopng's active list can be sparse during quiet periods. Merge it with
    // the official inventory so a selected node still has a contextual record
    // instead of making the NOC appear empty whenever only a few hosts talk.
    const observedIps = new Set(observed.map((host) => host.ip).filter((ip): ip is string => Boolean(ip)));
    const fallbackHosts = [...new Set((this.config.seedHosts ?? []).map((host) => host.trim()).filter(Boolean))]
      .filter((host) => !observedIps.has(host));
    const fallbackResults = await Promise.all(
      fallbackHosts.map(async (host, index) => {
        try {
          const payload = await this.fetchJson<Record<string, unknown>>(
            `/lua/rest/v2/get/host/data.lua?ifid=${ifid}&host=${encodeURIComponent(host)}`,
          );
          return this.normalizeHost(payload, index);
        } catch {
          return null;
        }
      }),
    );

    return [...observed, ...fallbackResults.filter((host): host is NtopngObservedHost => host !== null)];
  }

  private async fetchJson<T>(path: string): Promise<T> {
    const response = await (this.config.fetchImpl ?? fetch)(`${this.config.baseUrl}${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")}`,
      },
    });
    if (!response.ok) throw new Error(`ntopng request failed with ${response.status}`);

    const payload = await response.json() as NtopngEnvelope<T>;
    if (typeof payload?.rc !== "number" || payload.rc !== 0) {
      throw new Error(`ntopng API error ${payload?.rc ?? "UNKNOWN"} at ${path}`);
    }

    return payload.rsp;
  }

  private normalizeHost(host: Record<string, unknown>, index: number): NtopngObservedHost {
    const rawIp = host.ip;
    const ip = typeof rawIp === "string"
      ? rawIp
      : this.readNestedString(rawIp, "ip");

    return {
      ip,
      mac: this.readOptionalString(host.mac ?? host.mac_address),
      hostname: this.readOptionalString(host.name ?? host.symbolic_name),
      bytesIn: this.readMetricFromCandidates(host, [["bytes.rcvd"], ["rcvd", "bytes"]], index),
      bytesOut: this.readMetricFromCandidates(host, [["bytes.sent"], ["sent", "bytes"]], index),
      flowCount: this.readFlowCount(host, index),
      lastSeenAt: this.readLastSeen(host, index),
      protocols: this.readProtocols(host),
    };
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

  private readNestedMetric(host: Record<string, unknown>, parentField: string, childField: string, index: number): number {
    const parent = host[parentField];
    if (!parent || typeof parent !== "object") {
      throw new Error(`ntopng host row ${index} is missing a valid ${parentField}.${childField} value`);
    }
    return this.readMetric(parent as Record<string, unknown>, childField, index);
  }

  private readMetricFromCandidates(
    host: Record<string, unknown>,
    candidates: Array<[string] | [string, string]>,
    index: number,
  ): number {
    for (const candidate of candidates) {
      try {
        if (candidate.length === 1) {
          return this.readMetric(host, candidate[0], index);
        }
        return this.readNestedMetric(host, candidate[0], candidate[1], index);
      } catch {
      }
    }
    const label = candidates.map((candidate) => candidate.join(".")).join(" or ");
    throw new Error(`ntopng host row ${index} is missing a valid ${label} value`);
  }

  private readFlowCount(host: Record<string, unknown>, index: number): number {
    const asClient = this.readMetric(host, "flows.as_client", index);
    const asServer = this.readMetric(host, "flows.as_server", index);
    return asClient + asServer;
  }

  private readLastSeen(host: Record<string, unknown>, index: number): string {
    const value = host["seen.last"];
    if ((typeof value !== "number" && typeof value !== "string") || !Number.isFinite(Number(value))) {
      throw new Error(`ntopng host row ${index} is missing a valid seen.last value`);
    }
    return new Date(Number(value) * 1000).toISOString();
  }

  private readOptionalString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
  }

  private readNestedString(value: unknown, childField: string): string | undefined {
    if (!value || typeof value !== "object") return undefined;
    return this.readOptionalString((value as Record<string, unknown>)[childField]);
  }

  private readProtocols(host: Record<string, unknown>) {
    const ndpi = host.ndpi;
    if (!ndpi || typeof ndpi !== "object") return undefined;

    const protocols = Object.entries(ndpi as Record<string, unknown>)
      .map(([name, value]) => {
        if (!value || typeof value !== "object") return null;
        const row = value as Record<string, unknown>;
        const bytesSent = this.readOptionalNumber(row["bytes.sent"]);
        const bytesReceived = this.readOptionalNumber(row["bytes.rcvd"]);
        const flowCount = this.readOptionalNumber(row.num_flows);
        const totalBytes = bytesSent + bytesReceived;
        if (totalBytes <= 0 && flowCount <= 0) return null;
        return {
          name,
          bytes: totalBytes,
          flowCount,
        };
      })
      .filter((item): item is { name: string; bytes: number; flowCount: number } => item !== null)
      .sort((left, right) => right.bytes - left.bytes)
      .slice(0, 8);

    return protocols.length > 0 ? protocols : undefined;
  }

  private readOptionalNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))
        ? Number(value)
        : 0;
  }
}
