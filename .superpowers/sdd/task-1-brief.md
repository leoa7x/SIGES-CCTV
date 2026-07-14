## Task 1: Add Prisma Models For Telemetry

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_network_telemetry/migration.sql`

**Interfaces:**
- Consumes: existing `Node`, `NodeAsset`, `NodeDiscoveredDevice`
- Produces:
  - `NetworkTelemetrySnapshot`
  - `NetworkTelemetryAssetSample`
  - `NetworkTelemetryAlert`
  - enums `NetworkTelemetryClassificationSource`, `NetworkTelemetryAlertKind`, `NetworkTelemetryAlertSeverity`

- [ ] **Step 1: Write the failing schema additions in `apps/api/prisma/schema.prisma`**

```prisma
enum NetworkTelemetryClassificationSource {
  OFFICIAL
  DISCOVERY
  UNMATCHED
}

enum NetworkTelemetryAlertKind {
  NODE_SILENT
  ASSET_SILENT
  UNMATCHED_TRAFFIC
  NEW_DESTINATION
}

enum NetworkTelemetryAlertSeverity {
  INFO
  WARNING
  CRITICAL
}

model NetworkTelemetrySnapshot {
  id                  String   @id @default(uuid())
  nodeId              String
  node                Node     @relation(fields: [nodeId], references: [id])
  collectorId         String
  capturedAt          DateTime
  windowSeconds       Int
  totalBytesIn        BigInt
  totalBytesOut       BigInt
  activeHosts         Int
  activeFlows         Int
  alertCount          Int      @default(0)
  topProtocolsJson    Json
  topDestinationsJson Json
  assetSamples        NetworkTelemetryAssetSample[]
  alerts              NetworkTelemetryAlert[]
  createdAt           DateTime @default(now())

  @@index([nodeId, capturedAt])
}

model NetworkTelemetryAssetSample {
  id                   String                               @id @default(uuid())
  snapshotId           String
  snapshot             NetworkTelemetrySnapshot             @relation(fields: [snapshotId], references: [id])
  nodeId               String
  node                 Node                                 @relation(fields: [nodeId], references: [id])
  nodeAssetId          String?
  nodeAsset            NodeAsset?                           @relation(fields: [nodeAssetId], references: [id])
  ip                   String?
  mac                  String?
  hostname             String?
  bytesIn              BigInt
  bytesOut             BigInt
  flowCount            Int
  lastSeenAt           DateTime
  classificationSource NetworkTelemetryClassificationSource
  createdAt            DateTime                             @default(now())

  @@index([nodeId, createdAt])
  @@index([nodeAssetId])
}

model NetworkTelemetryAlert {
  id          String                        @id @default(uuid())
  nodeId      String
  node        Node                          @relation(fields: [nodeId], references: [id])
  snapshotId  String?
  snapshot    NetworkTelemetrySnapshot?     @relation(fields: [snapshotId], references: [id])
  nodeAssetId String?
  nodeAsset   NodeAsset?                    @relation(fields: [nodeAssetId], references: [id])
  kind        NetworkTelemetryAlertKind
  severity    NetworkTelemetryAlertSeverity
  title       String
  detail      String
  metadataJson Json?
  firstSeenAt DateTime
  lastSeenAt  DateTime
  isActive    Boolean                       @default(true)
  resolvedAt  DateTime?
  createdAt   DateTime                      @default(now())
  updatedAt   DateTime                      @updatedAt

  @@index([nodeId, isActive])
  @@index([kind, isActive])
}
```

- [ ] **Step 2: Run Prisma validation to verify the schema currently fails if references are incomplete**

Run: `cd apps/api && ../../node_modules/.bin/prisma validate`

Expected: either success or a concrete schema error that identifies missing back-relations

- [ ] **Step 3: Add missing back-relations to existing models**

```prisma
model Node {
  // existing fields...
  telemetrySnapshots NetworkTelemetrySnapshot[]
  telemetrySamples   NetworkTelemetryAssetSample[]
  telemetryAlerts    NetworkTelemetryAlert[]
}

model NodeAsset {
  // existing fields...
  telemetrySamples NetworkTelemetryAssetSample[]
  telemetryAlerts  NetworkTelemetryAlert[]
}
```

- [ ] **Step 4: Create the migration SQL**

Run: `cd apps/api && ../../node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_network_telemetry/migration.sql`

Expected: SQL file created with `CREATE TYPE` and `CREATE TABLE` statements for the new telemetry models

- [ ] **Step 5: Re-run Prisma validation**

Run: `cd apps/api && ../../node_modules/.bin/prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(api): add network telemetry prisma models"
```

