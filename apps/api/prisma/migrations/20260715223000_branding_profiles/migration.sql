CREATE TABLE "BrandingProfile" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cityId" TEXT NOT NULL,
  "logoUrl" TEXT,
  "loginMessage" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BrandingProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BrandingProfile"
ADD CONSTRAINT "BrandingProfile_cityId_fkey"
FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
