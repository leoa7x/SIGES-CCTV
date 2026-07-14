## Task 2: Add DTOs, Types, And Failing Telemetry Service Tests

**Files:**
- Create: `apps/api/src/network-telemetry/network-telemetry.ingest.dto.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.types.ts`
- Create: `apps/api/src/network-telemetry/network-telemetry.service.test.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes: Prisma model names from Task 1
- Produces:
  - `IngestNetworkTelemetryDto`
  - `NetworkTelemetryProtocolEntry`
  - `NetworkTelemetryDestinationEntry`
  - `NetworkTelemetryAssetEntry`
  - `npm run test:network-telemetry`

- [ ] **Step 1: Write DTO and helper types**

```ts
// apps/api/src/network-telemetry/network-telemetry.types.ts
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
```

```ts
// apps/api/src/network-telemetry/network-telemetry.ingest.dto.ts
import { Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from "class-validator";

class TotalsDto {
  @IsInt() @Min(0) bytesIn!: number;
  @IsInt() @Min(0) bytesOut!: number;
  @IsInt() @Min(0) activeHosts!: number;
  @IsInt() @Min(0) activeFlows!: number;
}

class ProtocolDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsInt() @Min(0) bytes!: number;
  @IsInt() @Min(0) flowCount!: number;
}

class DestinationDto {
  @IsString() @IsNotEmpty() target!: string;
  @IsString() @IsIn(["IP", "DOMAIN", "ASN", "UNKNOWN"]) kind!: "IP" | "DOMAIN" | "ASN" | "UNKNOWN";
  @IsInt() @Min(0) bytes!: number;
  @IsInt() @Min(0) flowCount!: number;
}

class AssetSampleDto {
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() mac?: string;
  @IsOptional() @IsString() hostname?: string;
  @IsInt() @Min(0) bytesIn!: number;
  @IsInt() @Min(0) bytesOut!: number;
  @IsInt() @Min(0) flowCount!: number;
  @IsISO8601() lastSeenAt!: string;
}

export class IngestNetworkTelemetryDto {
  @IsString() @IsNotEmpty() nodeId!: string;
  @IsString() @IsNotEmpty() collectorId!: string;
  @IsISO8601() capturedAt!: string;
  @IsInt() @Min(1) windowSeconds!: number;
  @ValidateNested() @Type(() => TotalsDto) totals!: TotalsDto;
  @IsArray() @ValidateNested({ each: true }) @Type(() => ProtocolDto) protocols!: ProtocolDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => DestinationDto) destinations!: DestinationDto[];
  @IsArray() @ValidateNested({ each: true }) @Type(() => AssetSampleDto) assets!: AssetSampleDto[];
}
```

- [ ] **Step 2: Add a failing telemetry service test file**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { NetworkTelemetryService } from "./network-telemetry.service";

test("ingestSnapshot correlates asset samples to official assets by MAC first", async () => {
  const service = new NetworkTelemetryService({
    node: { findUniqueOrThrow: async () => ({ id: "node-1" }) },
    nodeAsset: { findFirst: async ({ where }: { where: { mac?: string | undefined } }) => where.mac === "AA:BB" ? ({ id: "asset-1" }) : null },
    nodeDiscoveredDevice: { findFirst: async () => null },
    networkTelemetrySnapshot: { create: async () => ({ id: "snap-1" }) },
    networkTelemetryAssetSample: { createMany: async () => ({ count: 1 }) },
    networkTelemetryAlert: { upsert: async () => ({ id: "alert-1" }) },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  } as never);

  const result = await service.ingestSnapshot({
    nodeId: "node-1",
    collectorId: "sensor-a",
    capturedAt: "2026-07-13T20:01:00.000Z",
    windowSeconds: 60,
    totals: { bytesIn: 10, bytesOut: 20, activeHosts: 1, activeFlows: 2 },
    protocols: [],
    destinations: [],
    assets: [{ mac: "AA:BB", bytesIn: 10, bytesOut: 20, flowCount: 1, lastSeenAt: "2026-07-13T20:00:58.000Z" }],
  });

  assert.equal(result.snapshotId, "snap-1");
});
```

- [ ] **Step 3: Add the test script**

```json
"test:network-telemetry": "ts-node --project tsconfig.json src/network-telemetry/network-telemetry.service.test.ts"
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run test:network-telemetry --workspace=apps/api`

Expected: FAIL with `Cannot find module './network-telemetry.service'` or `Property 'ingestSnapshot' does not exist`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/network-telemetry apps/api/package.json
git commit -m "test(api): add failing network telemetry service tests"
```

