-- CreateTable
CREATE TABLE "oauth_configs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_secret" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "oauth_configs_user_id_idx" ON "oauth_configs"("user_id");

-- AddForeignKey
ALTER TABLE "oauth_configs" ADD CONSTRAINT "oauth_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
