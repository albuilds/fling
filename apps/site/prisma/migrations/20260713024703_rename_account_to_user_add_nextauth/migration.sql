/*
  Warnings:

  - You are about to drop the column `accountId` on the `Capture` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `DeviceToken` table. All the data in the column will be lost.
  - You are about to drop the `Account` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `UserId` to the `Capture` table without a default value. This is not possible if the table is not empty.
  - Added the required column `UserId` to the `DeviceToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Capture" DROP CONSTRAINT "Capture_accountId_fkey";

-- DropForeignKey
ALTER TABLE "DeviceToken" DROP CONSTRAINT "DeviceToken_accountId_fkey";

-- DropIndex
DROP INDEX "Capture_accountId_createdAt_idx";

-- DropIndex
DROP INDEX "Capture_accountId_type_idx";

-- DropIndex
DROP INDEX "DeviceToken_accountId_idx";

-- AlterTable
ALTER TABLE "Capture" DROP COLUMN "accountId",
ADD COLUMN     "UserId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "DeviceToken" DROP COLUMN "accountId",
ADD COLUMN     "UserId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Account";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Capture_UserId_createdAt_idx" ON "Capture"("UserId", "createdAt");

-- CreateIndex
CREATE INDEX "Capture_UserId_type_idx" ON "Capture"("UserId", "type");

-- CreateIndex
CREATE INDEX "DeviceToken_UserId_idx" ON "DeviceToken"("UserId");

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
