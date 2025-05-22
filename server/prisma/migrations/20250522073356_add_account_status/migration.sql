/*
  Warnings:

  - You are about to drop the column `apiKey` on the `bybit_credentials` table. All the data in the column will be lost.
  - You are about to drop the column `apiSecret` on the `bybit_credentials` table. All the data in the column will be lost.
  - Added the required column `api_key` to the `bybit_credentials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `api_secret` to the `bybit_credentials` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bybit_credentials" DROP COLUMN "apiKey",
DROP COLUMN "apiSecret",
ADD COLUMN     "api_key" TEXT NOT NULL,
ADD COLUMN     "api_secret" TEXT NOT NULL,
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "last_check_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'initializing';

-- AlterTable
ALTER TABLE "gate_credentials" ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "last_check_at" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'initializing';
