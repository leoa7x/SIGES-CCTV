# ntopng Telemetry Collector Verification Notes

Date: 2026-07-20
Status: Partial verification completed, infrastructure blocker remains

## Code Path Verified

- `apps/api/src/network-telemetry/ntopng-client.test.ts`
- `apps/api/src/network-telemetry/network-telemetry-correlation.test.ts`
- `apps/api/src/network-telemetry/ntopng-collector.service.test.ts`
- `apps/api/scripts/run_ntopng_telemetry_collector.test.ts`
- `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- `npm run build --workspace=apps/api`

Result:

- ntopng client normalizes host rows and enforces auth/field validation
- correlation resolves official node/center ownership conservatively
- collector aggregates hosts into ingest payloads
- unmatched hosts are forwarded to external discovery with source `NTOPNG`
- runnable collector cycle posts normalized snapshots through the ingest contract

## Live Environment Verification

### Discovery scan executed

Command:

```bash
python3 apps/api/scripts/run_lan_orangutan_scan.py 192.168.1.0/24
```

Result:

- success: `true`
- scanner: `nmap+neighbor-enrichment`
- hosts found: `9`

Observed IPs:

- `192.168.1.1`
- `192.168.1.20`
- `192.168.1.96`
- `192.168.1.107`
- `192.168.1.126`
- `192.168.1.161`
- `192.168.1.192`
- `192.168.1.245`
- `192.168.1.252`

### Official node check

Official node:

- `NODO-CEL-001`
- `primaryIp = 192.168.1.6`

Database state on July 20, 2026:

- `Node.operativeState = OFFLINE`
- `NetworkTelemetrySnapshot` count = `0`

Interpretation:

- the official node `192.168.1.6` exists in SIGES
- it was not observed in the latest LAN discovery scan
- it currently has no telemetry snapshots persisted

## Current Blocker

`ntopng` is not installed or reachable on the SIGES host yet.

Observed state:

- no `ntopng` binary in `PATH`
- no active `ntopng` process
- no configured `NTOPNG_*` runtime values in the active local `.env`

Because of that:

- the new collector code is ready
- the ingest pipeline is ready
- Grafana dashboards are ready to consume telemetry
- but there is still no real traffic producer feeding `NetworkTelemetrySnapshot`

## What Must Happen Next

1. Install or run `ntopng` on the same SIGES host.
2. Point it at the real interface that sees the monitored traffic.
3. Configure:
   - `NTOPNG_BASE_URL`
   - `NTOPNG_USERNAME`
   - `NTOPNG_PASSWORD`
   - `NETWORK_TELEMETRY_INGEST_URL`
   - `NETWORK_TELEMETRY_INGEST_TOKEN`
4. Run:

```bash
npm run telemetry:collect --workspace=apps/api
```

5. Verify:
   - `NetworkTelemetrySnapshot` count increases
   - `/monitoring/network` shows non-empty throughput
   - Grafana global and node views stop rendering empty time-series

## Key Conclusion

The remaining gap is no longer application logic.

The remaining gap is infrastructure:

- real `ntopng` deployment
- real interface visibility
- real collector execution against that source
