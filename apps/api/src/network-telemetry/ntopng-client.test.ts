import assert from "node:assert/strict";
import test from "node:test";

import { NtopngClient } from "./ntopng-client";

test("fetchObservedHosts normalizes ntopng host rows into SIGES host observations", async () => {
  const client = new NtopngClient({
    baseUrl: "http://ntopng.local",
    username: "admin",
    password: "secret",
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        hosts: [
          {
            ip: "192.168.1.6",
            mac: "AA:BB:CC:DD:EE:FF",
            name: "celular",
            bytes_rcvd: 1200,
            bytes_sent: 800,
            flows: 4,
            last_seen: "2026-07-20T18:00:00.000Z",
          },
        ],
      }),
    } as Response),
  });

  const hosts = await client.fetchObservedHosts();

  assert.deepEqual(hosts, [
    {
      ip: "192.168.1.6",
      mac: "AA:BB:CC:DD:EE:FF",
      hostname: "celular",
      bytesIn: 1200,
      bytesOut: 800,
      flowCount: 4,
      lastSeenAt: "2026-07-20T18:00:00.000Z",
    },
  ]);
});
