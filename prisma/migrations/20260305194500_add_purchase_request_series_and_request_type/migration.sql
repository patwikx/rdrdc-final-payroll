-- Add Material Request parity fields to Purchase Request.
ALTER TABLE "PurchaseRequest"
ADD COLUMN "series" "MaterialRequestSeries" NOT NULL DEFAULT 'PO',
ADD COLUMN "requestType" "MaterialRequestType" NOT NULL DEFAULT 'ITEM';

CREATE INDEX "PurchaseRequest_series_idx" ON "PurchaseRequest"("series");
CREATE INDEX "PurchaseRequest_requestType_idx" ON "PurchaseRequest"("requestType");
