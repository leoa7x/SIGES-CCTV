-- CreateEnum
CREATE TYPE "NetworkTelemetryClassificationSource" AS ENUM ('OFFICIAL', 'DISCOVERY', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "NetworkTelemetryAlertKind" AS ENUM ('NODE_SILENT', 'ASSET_SILENT', 'UNMATCHED_TRAFFIC', 'NEW_DESTINATION');

-- CreateEnum
CREATE TYPE "NetworkTelemetryAlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "NetworkTelemetrySnapshot" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "collectorId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "totalBytesIn" BIGINT NOT NULL,
    "totalBytesOut" BIGINT NOT NULL,
    "activeHosts" INTEGER NOT NULL,
    "activeFlows" INTEGER NOT NULL,
    "alertCount" INTEGER NOT NULL DEFAULT 0,
    "topProtocolsJson" JSONB NOT NULL,
    "topDestinationsJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkTelemetrySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkTelemetryAssetSample" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeAssetId" TEXT,
    "ip" TEXT,
    "mac" TEXT,
    "hostname" TEXT,
    "bytesIn" BIGINT NOT NULL,
    "bytesOut" BIGINT NOT NULL,
    "flowCount" INTEGER NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "classificationSource" "NetworkTelemetryClassificationSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkTelemetryAssetSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkTelemetryAlert" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "nodeAssetId" TEXT,
    "kind" "NetworkTelemetryAlertKind" NOT NULL,
    "severity" "NetworkTelemetryAlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "metadataJson" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkTelemetryAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkTelemetrySnapshot_nodeId_capturedAt_idx" ON "NetworkTelemetrySnapshot"("nodeId", "capturedAt");

-- CreateIndex
CREATE INDEX "NetworkTelemetryAssetSample_nodeId_createdAt_idx" ON "NetworkTelemetryAssetSample"("nodeId", "createdAt");

-- CreateIndex
CREATE INDEX "NetworkTelemetryAssetSample_nodeAssetId_idx" ON "NetworkTelemetryAssetSample"("nodeAssetId");

-- CreateIndex
CREATE INDEX "NetworkTelemetryAlert_nodeId_isActive_idx" ON "NetworkTelemetryAlert"("nodeId", "isActive");

-- CreateIndex
CREATE INDEX "NetworkTelemetryAlert_kind_isActive_idx" ON "NetworkTelemetryAlert"("kind", "isActive");

-- AddForeignKey
ALTER TABLE "NetworkTelemetrySnapshot" ADD CONSTRAINT "NetworkTelemetrySnapshot_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTelemetryAssetSample" ADD CONSTRAINT "NetworkTelemetryAssetSample_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "NetworkTelemetrySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTelemetryAssetSample" ADD CONSTRAINT "NetworkTelemetryAssetSample_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTelemetryAssetSample" ADD CONSTRAINT "NetworkTelemetryAssetSample_nodeAssetId_fkey" FOREIGN KEY ("nodeAssetId") REFERENCES "NodeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTelemetryAlert" ADD CONSTRAINT "NetworkTelemetryAlert_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTelemetryAlert" ADD CONSTRAINT "NetworkTelemetryAlert_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "NetworkTelemetrySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkTelemetryAlert" ADD CONSTRAINT "NetworkTelemetryAlert_nodeAssetId_fkey" FOREIGN KEY ("nodeAssetId") REFERENCES "NodeAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
