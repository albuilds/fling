-- CreateEnum
CREATE TYPE "CaptureType" AS ENUM ('SCREENSHOT', 'VIDEO');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "name" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capture" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceTokenId" TEXT,
    "publicId" TEXT NOT NULL,
    "type" "CaptureType" NOT NULL,
    "title" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_tokenHash_key" ON "DeviceToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceToken_accountId_idx" ON "DeviceToken"("accountId");

-- CreateIndex
CREATE INDEX "DeviceToken_revokedAt_idx" ON "DeviceToken"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Capture_publicId_key" ON "Capture"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "Capture_storageKey_key" ON "Capture"("storageKey");

-- CreateIndex
CREATE INDEX "Capture_accountId_createdAt_idx" ON "Capture"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "Capture_accountId_type_idx" ON "Capture"("accountId", "type");

-- CreateIndex
CREATE INDEX "Capture_expiresAt_idx" ON "Capture"("expiresAt");

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_deviceTokenId_fkey" FOREIGN KEY ("deviceTokenId") REFERENCES "DeviceToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
