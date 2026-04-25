-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "image_tag" TEXT,
    "container_id" TEXT,
    "port" INTEGER,
    "live_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" SERIAL NOT NULL,
    "deployment_id" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "logs" ADD CONSTRAINT "logs_deployment_id_fkey" FOREIGN KEY ("deployment_id") REFERENCES "deployments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
