DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'User'
      AND column_name = 'isLeaveApprover'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "isLeaveApprover" TO "isRequestApprover";
  END IF;
END $$;
