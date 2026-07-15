-- CreateTable
CREATE TABLE "CenterAsset" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "assetType" "NodeAssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "ip" TEXT,
    "mac" TEXT,
    "vendor" TEXT,
    "model" TEXT,
    "hostname" TEXT,
    "operativeState" "NodeState" NOT NULL DEFAULT 'ONLINE',
    "source" "NodeAssetSource" NOT NULL DEFAULT 'MANUAL',
    "lastSeenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CenterAsset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CenterAsset"
ADD CONSTRAINT "CenterAsset_centerId_fkey"
FOREIGN KEY ("centerId") REFERENCES "MonitoringCenter"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
