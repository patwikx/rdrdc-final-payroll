-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutionAssetStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED', 'FULLY_DEPRECIATED', 'NO_SETUP');

-- CreateTable
CREATE TABLE "depreciation_schedules" (
    "id" TEXT NOT NULL,
    "business_unit_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "schedule_type" "ScheduleType" NOT NULL DEFAULT 'MONTHLY',
    "execution_day" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "include_categories" TEXT[],
    "exclude_categories" TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depreciation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_executions" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "business_unit_id" TEXT NOT NULL,
    "execution_date" TIMESTAMP(3) NOT NULL,
    "scheduled_date" TIMESTAMP(3) NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "total_assets_processed" INTEGER NOT NULL DEFAULT 0,
    "successful_calculations" INTEGER NOT NULL DEFAULT 0,
    "failed_calculations" INTEGER NOT NULL DEFAULT 0,
    "total_depreciation_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "execution_duration_ms" INTEGER,
    "error_message" TEXT,
    "execution_summary" JSONB,
    "executed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "depreciation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_execution_assets" (
    "id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "depreciation_record_id" TEXT,
    "status" "ExecutionAssetStatus" NOT NULL,
    "depreciation_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "book_value_before" DECIMAL(12,2) NOT NULL,
    "book_value_after" DECIMAL(12,2) NOT NULL,
    "error_message" TEXT,
    "calculation_details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciation_execution_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "depreciation_schedules_business_unit_id_idx" ON "depreciation_schedules"("business_unit_id");

-- CreateIndex
CREATE INDEX "depreciation_schedules_is_active_idx" ON "depreciation_schedules"("is_active");

-- CreateIndex
CREATE INDEX "depreciation_schedules_schedule_type_idx" ON "depreciation_schedules"("schedule_type");

-- CreateIndex
CREATE INDEX "depreciation_executions_schedule_id_idx" ON "depreciation_executions"("schedule_id");

-- CreateIndex
CREATE INDEX "depreciation_executions_business_unit_id_idx" ON "depreciation_executions"("business_unit_id");

-- CreateIndex
CREATE INDEX "depreciation_executions_execution_date_idx" ON "depreciation_executions"("execution_date");

-- CreateIndex
CREATE INDEX "depreciation_executions_status_idx" ON "depreciation_executions"("status");

-- CreateIndex
CREATE INDEX "depreciation_executions_scheduled_date_idx" ON "depreciation_executions"("scheduled_date");

-- CreateIndex
CREATE INDEX "depreciation_execution_assets_execution_id_idx" ON "depreciation_execution_assets"("execution_id");

-- CreateIndex
CREATE INDEX "depreciation_execution_assets_asset_id_idx" ON "depreciation_execution_assets"("asset_id");

-- CreateIndex
CREATE INDEX "depreciation_execution_assets_status_idx" ON "depreciation_execution_assets"("status");

-- AddForeignKey
ALTER TABLE "depreciation_schedules" ADD CONSTRAINT "depreciation_schedules_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_schedules" ADD CONSTRAINT "depreciation_schedules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_executions" ADD CONSTRAINT "depreciation_executions_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "depreciation_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_executions" ADD CONSTRAINT "depreciation_executions_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "BusinessUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_executions" ADD CONSTRAINT "depreciation_executions_executed_by_fkey" FOREIGN KEY ("executed_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_execution_assets" ADD CONSTRAINT "depreciation_execution_assets_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "depreciation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_execution_assets" ADD CONSTRAINT "depreciation_execution_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_execution_assets" ADD CONSTRAINT "depreciation_execution_assets_depreciation_record_id_fkey" FOREIGN KEY ("depreciation_record_id") REFERENCES "asset_depreciations"("id") ON DELETE SET NULL ON UPDATE CASCADE;