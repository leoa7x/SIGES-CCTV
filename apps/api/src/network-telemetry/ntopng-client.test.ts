import assert from "node:assert/strict";
import test from "node:test";

import { NtopngClient } from "./ntopng-client";

test("fetchObservedHosts normalizes ntopng active host rows into SIGES host observations", async () => {
  let call = 0;
  const client = new NtopngClient({
    baseUrl: "http://ntopng.local",
    username: "admin",
    password: "secret",
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        call += 1;
        return call === 1
          ? {
              rc: 0,
              rsp: [{ ifid: 0 }],
            }
          : {
              rc: 0,
              rsp: {
                data: [
                  {
                    ip: { ip: "192.168.1.6" },
                    mac: "AA:BB:CC:DD:EE:FF",
                    symbolic_name: "celular",
                    rcvd: { bytes: 1200 },
                    sent: { bytes: 800 },
                    "flows.as_client": 1,
                    "flows.as_server": 3,
                    "seen.last": 1784570400,
                  },
                ],
              },
            };
      },
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
      protocols: undefined,
    },
  ]);
});

test("fetchObservedHosts applies configured credentials as Basic authentication", async () => {
  let requestInit: RequestInit | undefined;
  let call = 0;
  const client = new NtopngClient({
    baseUrl: "http://ntopng.local",
    username: "admin",
    password: "secret",
    fetchImpl: async (_input, init) => {
      requestInit = init;
      return {
        ok: true,
        json: async () => {
          call += 1;
          return call === 1
            ? { rc: 0, rsp: [{ ifid: 0 }] }
            : { rc: 0, rsp: { data: [] } };
        },
      } as Response;
    },
  });

  await client.fetchObservedHosts();

  assert.deepEqual(requestInit?.headers, {
    Authorization: `Basic ${Buffer.from("admin:secret").toString("base64")}`,
  });
});

test("fetchObservedHosts falls back to host data for seed hosts when active rows are empty", async () => {
  const requestedPaths: string[] = [];
  const client = new NtopngClient({
    baseUrl: "http://ntopng.local",
    username: "admin",
    password: "secret",
    seedHosts: ["192.168.1.182"],
    fetchImpl: async (input) => {
      requestedPaths.push(String(input));
      return {
        ok: true,
        json: async () => {
          if (requestedPaths.length === 1) return { rc: 0, rsp: [{ ifid: 0 }] };
          if (requestedPaths.length === 2) return { rc: 0, rsp: { data: [] } };
          return {
            rc: 0,
            rsp: {
              ip: "192.168.1.182",
              mac: "56:D5:58:B0:D8:9F",
              name: "celular",
              "bytes.rcvd": 75376,
              "bytes.sent": 55672,
              "flows.as_client": 2,
              "flows.as_server": 1007,
              "seen.last": 1784589777,
            },
          };
        },
      } as Response;
    },
  });

  const hosts = await client.fetchObservedHosts();

  assert.equal(hosts.length, 1);
  assert.equal(hosts[0]?.ip, "192.168.1.182");
  assert.equal(hosts[0]?.bytesIn, 75376);
  assert.equal(hosts[0]?.bytesOut, 55672);
  assert.equal(hosts[0]?.flowCount, 1009);
  assert.match(requestedPaths[2] ?? "", /host\/data\.lua\?ifid=0&host=192.168.1.182/);
});

test("fetchObservedHosts rejects rows with missing source metrics instead of inventing values", async () => {
  let call = 0;
  const client = new NtopngClient({
    baseUrl: "http://ntopng.local",
    username: "admin",
    password: "secret",
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        call += 1;
        return call === 1
          ? { rc: 0, rsp: [{ ifid: 0 }] }
          : {
              rc: 0,
              rsp: {
                data: [{ rcvd: { bytes: 1200 }, sent: { bytes: 800 }, "flows.as_client": 2, "flows.as_server": 2 }],
              },
            };
      },
    } as Response),
  });

  await assert.rejects(
    () => client.fetchObservedHosts(),
    /ntopng host row 0 is missing a valid seen\.last value/,
  );
});
