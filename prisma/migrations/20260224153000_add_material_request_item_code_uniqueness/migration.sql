BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaterialRequestItem_materialRequestId_itemCode_key'
  ) THEN
    ALTER TABLE "MaterialRequestItem"
      ADD CONSTRAINT "MaterialRequestItem_materialRequestId_itemCode_key"
      UNIQUE ("materialRequestId", "itemCode");
  END IF;
END $$;

COMMIT;
