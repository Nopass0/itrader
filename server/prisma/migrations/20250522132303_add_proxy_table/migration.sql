-- CreateTable
CREATE TABLE "proxies" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "protocol" TEXT NOT NULL DEFAULT 'socks5',
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "country" TEXT,
    "source" TEXT,
    "response_time" INTEGER,
    "success_rate" DOUBLE PRECISION,
    "last_checked" TIMESTAMP(3),
    "last_used" TIMESTAMP(3),
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proxies_status_is_active_idx" ON "proxies"("status", "is_active");

-- CreateIndex
CREATE INDEX "proxies_last_checked_idx" ON "proxies"("last_checked");

-- CreateIndex
CREATE UNIQUE INDEX "proxies_host_port_key" ON "proxies"("host", "port");