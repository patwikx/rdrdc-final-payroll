-- DropForeignKey
ALTER TABLE "EmployeePositionHistory" DROP CONSTRAINT "EmployeePositionHistory_newPositionId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeRankHistory" DROP CONSTRAINT "EmployeeRankHistory_newRankId_fkey";

-- DropForeignKey
ALTER TABLE "EmployeeStatusHistory" DROP CONSTRAINT "EmployeeStatusHistory_newStatusId_fkey";

-- DropIndex
DROP INDEX "DeductionType_reportingContributionType_idx";

-- DropIndex
DROP INDEX "MaterialRequest_requiresReceiptAcknowledgment_idx";

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_newStatusId_fkey" FOREIGN KEY ("newStatusId") REFERENCES "EmploymentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_newPositionId_fkey" FOREIGN KEY ("newPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRankHistory" ADD CONSTRAINT "EmployeeRankHistory_newRankId_fkey" FOREIGN KEY ("newRankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DepartmentMaterialRequestApprovalFlowStep_flowId_stepNumber_app" RENAME TO "DepartmentMaterialRequestApprovalFlowStep_flowId_stepNumber_key";

-- RenameIndex
ALTER INDEX "MaterialRequest_companyId_status_processingStatus_requesterAckn" RENAME TO "MaterialRequest_companyId_status_processingStatus_requester_idx";

-- RenameIndex
ALTER INDEX "MaterialRequestApprovalStep_materialRequestId_stepNumber_approv" RENAME TO "MaterialRequestApprovalStep_materialRequestId_stepNumber_ap_key";

-- RenameIndex
ALTER INDEX "MaterialRequestApprovalStep_materialRequestId_stepNumber_status" RENAME TO "MaterialRequestApprovalStep_materialRequestId_stepNumber_st_idx";

-- RenameIndex
ALTER INDEX "MaterialRequestReceivingReportItem_receivingReportId_lineNumber" RENAME TO "MaterialRequestReceivingReportItem_receivingReportId_lineNu_idx";

-- RenameIndex
ALTER INDEX "MaterialRequestReceivingReportItem_receivingReportId_materialRe" RENAME TO "MaterialRequestReceivingReportItem_receivingReportId_materi_key";

-- RenameIndex
ALTER INDEX "PurchaseOrderLine_purchaseOrderId_sourcePurchaseRequestItemId_k" RENAME TO "PurchaseOrderLine_purchaseOrderId_sourcePurchaseRequestItem_key";
