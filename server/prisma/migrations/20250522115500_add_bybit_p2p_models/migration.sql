-- AddColumn
ALTER TABLE "bybit_credentials" ADD COLUMN "account_info" JSONB;

-- CreateTable
CREATE TABLE "bybit_p2p_balances" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "coin" TEXT NOT NULL,
    "balance" TEXT NOT NULL,
    "frozen" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bybit_p2p_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bybit_p2p_ads" (
    "bybit_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "side" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "currency_id" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "min_amount" TEXT NOT NULL,
    "max_amount" TEXT NOT NULL,
    "payment_methods" JSONB NOT NULL,
    "remark" TEXT,
    "status" TEXT NOT NULL,
    "completed_order_num" INTEGER NOT NULL,
    "completed_rate" TEXT NOT NULL,
    "avg_release_time" TEXT NOT NULL,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bybit_p2p_ads_pkey" PRIMARY KEY ("bybit_id")
);

-- CreateTable
CREATE TABLE "bybit_p2p_orders" (
    "bybit_order_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order_status" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "token_id" TEXT NOT NULL,
    "currency_id" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "payment_method" JSONB NOT NULL,
    "counter_party_id" TEXT NOT NULL,
    "counter_party_nick_name" TEXT NOT NULL,
    "ad_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "last_update_time" TIMESTAMP(3) NOT NULL,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bybit_p2p_orders_pkey" PRIMARY KEY ("bybit_order_id")
);

-- CreateTable
CREATE TABLE "bybit_p2p_chat_messages" (
    "bybit_message_id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "order_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "from_user_id" TEXT NOT NULL,
    "file_url" TEXT,
    "raw_data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bybit_p2p_chat_messages_pkey" PRIMARY KEY ("bybit_message_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bybit_p2p_balances_user_id_coin_key" ON "bybit_p2p_balances"("user_id", "coin");

-- AddForeignKey
ALTER TABLE "bybit_p2p_balances" ADD CONSTRAINT "bybit_p2p_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bybit_p2p_ads" ADD CONSTRAINT "bybit_p2p_ads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bybit_p2p_orders" ADD CONSTRAINT "bybit_p2p_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bybit_p2p_chat_messages" ADD CONSTRAINT "bybit_p2p_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;