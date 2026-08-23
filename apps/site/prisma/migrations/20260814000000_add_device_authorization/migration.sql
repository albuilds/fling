CREATE TABLE "DeviceAuthorization" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "deviceName" TEXT,
    "UserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceAuthorization_deviceCodeHash_key" ON "DeviceAuthorization"("deviceCodeHash");
CREATE UNIQUE INDEX "DeviceAuthorization_userCode_key" ON "DeviceAuthorization"("userCode");
CREATE INDEX "DeviceAuthorization_UserId_idx" ON "DeviceAuthorization"("UserId");
CREATE INDEX "DeviceAuthorization_expiresAt_idx" ON "DeviceAuthorization"("expiresAt");

ALTER TABLE "DeviceAuthorization" ADD CONSTRAINT "DeviceAuthorization_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
