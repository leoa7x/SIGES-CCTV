-- Add persisted RTSP preview configuration without storing plaintext passwords.
CREATE TYPE "CameraTransport" AS ENUM ('TCP', 'UDP');

ALTER TABLE "Camera"
    ADD COLUMN "streamUrl" TEXT,
    ADD COLUMN "streamUsername" TEXT,
    ADD COLUMN "streamPasswordEncrypted" TEXT,
    ADD COLUMN "streamTransport" "CameraTransport" NOT NULL DEFAULT 'TCP',
    ADD COLUMN "previewEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "onvifUrl" TEXT,
    ADD COLUMN "lastPreviewCheckAt" TIMESTAMP(3),
    ADD COLUMN "lastPreviewStatus" TEXT;

-- Remove historical plaintext passwords from URLs. Existing cameras with an
-- embedded password must be reconfigured with the separately encrypted field.
UPDATE "Camera"
SET
    "streamUsername" = COALESCE("streamUsername", substring("streamUrl" FROM '^rtsps?://([^:@/?#]+)')),
    "streamUrl" = regexp_replace("streamUrl", '^(rtsps?://)[^@/?#]*@', '\1', 'i')
WHERE "streamUrl" ~* '^rtsps?://[^@/?#]*@';
