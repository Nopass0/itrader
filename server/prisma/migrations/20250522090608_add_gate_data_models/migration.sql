-- CreateTable
CREATE TABLE "gate_transactions" (
    "id" SERIAL NOT NULL,
    "gate_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "status_text" TEXT,
    "amount" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount_usdt" TEXT,
    "fee" TEXT,
    "fee_usdt" TEXT,
    "wallet" TEXT,
    "from_address" TEXT,
    "to_address" TEXT,
    "tx_hash" TEXT,
    "network" TEXT,
    "memo" TEXT,
    "description" TEXT,
    "raw_data" JSONB NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_sms" (
    "id" SERIAL NOT NULL,
    "gate_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "from" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "status_text" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "parsed" JSONB,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_sms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_push" (
    "id" SERIAL NOT NULL,
    "gate_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "package_name" TEXT NOT NULL,
    "title" TEXT,
    "text" TEXT,
    "status" INTEGER NOT NULL,
    "status_text" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "parsed" JSONB,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_push_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_dashboard_stats" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "step_type" TEXT NOT NULL,
    "step_value" INTEGER NOT NULL,
    "graph_data" JSONB NOT NULL,
    "avg_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gate_dashboard_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gate_transactions_gate_id_key" ON "gate_transactions"("gate_id");

-- CreateIndex
CREATE UNIQUE INDEX "gate_sms_gate_id_key" ON "gate_sms"("gate_id");

-- CreateIndex
CREATE UNIQUE INDEX "gate_push_gate_id_key" ON "gate_push"("gate_id");

-- AddForeignKey
ALTER TABLE "gate_transactions" ADD CONSTRAINT "gate_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_sms" ADD CONSTRAINT "gate_sms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_push" ADD CONSTRAINT "gate_push_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_dashboard_stats" ADD CONSTRAINT "gate_dashboard_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
