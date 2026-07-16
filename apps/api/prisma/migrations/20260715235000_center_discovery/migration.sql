ALTER TABLE "MonitoringCenter"
ADD COLUMN "primaryIp" TEXT,
ADD COLUMN "scanSubnetCidr" TEXT;

CREATE TABLE "CenterDiscoveryJob" (
  "id" TEXT NOT NULL,
  "centerId" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "status" "NodeDiscoveryStatus" NOT NULL,
  "targetIp" TEXT,
  "targetSubnetCidr" TEXT,
  "rawSummary" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CenterDiscoveryJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CenterDiscoveredDevice" (
  "id" TEXT NOT NULL,
  "centerDiscoveryJobId" TEXT NOT NULL,
  "matchedAssetId" TEXT,
  "candidateType" "NodeAssetType",
  "name" TEXT,
  "ip" TEXT,
  "mac" TEXT,
  "vendor" TEXT,
  "model" TEXT,
  "hostname" TEXT,
  "discoveryConfidence" INTEGER NOT NULL DEFAULT 50,
  "rawPayload" JSONB NOT NULL,
  "status" "NodeDiscoveredDeviceStatus" NOT NULL DEFAULT 'DISCOVERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CenterDiscoveredDevice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CenterDiscoveryJob"
ADD CONSTRAINT "CenterDiscoveryJob_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "MonitoringCenter"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CenterDiscoveryJob"
ADD CONSTRAINT "CenterDiscoveryJob_requestedByUserId_fkey"
FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "CenterDiscoveredDevice"
ADD CONSTRAINT "CenterDiscoveredDevice_centerDiscoveryJobId_fkey"
FOREIGN KEY ("centerDiscoveryJobId") REFERENCES "CenterDiscoveryJob"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "CenterDiscoveredDevice"
ADD CONSTRAINT "CenterDiscoveredDevice_matchedAssetId_fkey"
FOREIGN KEY ("matchedAssetId") REFERENCES "CenterAsset"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
