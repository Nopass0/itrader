-- AlterTable
ALTER TABLE "gate_credentials" ADD COLUMN     "next_update_at" TIMESTAMP(3),
ADD COLUMN     "user_data" JSONB;

-- AlterTable
ALTER TABLE "gate_sessions" ADD COLUMN     "access_token" TEXT,
ADD COLUMN     "expires_at" TIMESTAMP(3);
