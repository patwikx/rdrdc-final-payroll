-- Add FOR_REVIEW status to MRSRequestStatus enum
ALTER TYPE "MRSRequestStatus" ADD VALUE 'FOR_REVIEW' AFTER 'DRAFT';

-- Add store use review fields to material_requests table
ALTER TABLE "material_requests" ADD COLUMN "reviewerId" TEXT;
ALTER TABLE "material_requests" ADD COLUMN "reviewedAt" TIMESTAMP(3);
ALTER TABLE "material_requests" ADD COLUMN "reviewStatus" "ApprovalStatus";
ALTER TABLE "material_requests" ADD COLUMN "reviewRemarks" TEXT;

-- Add foreign key constraint for reviewer
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
