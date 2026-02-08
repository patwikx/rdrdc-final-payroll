-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GLAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COST_CENTER', 'PROFIT_CENTER', 'REVENUE_CENTER');

-- CreateEnum
CREATE TYPE "GLAccountClass" AS ENUM ('DIRECT', 'INDIRECT', 'FIXED', 'VARIABLE', 'OPERATING', 'NON_OPERATING');

-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'REST_DAY', 'SUSPENDED', 'AWOL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING', 'SUPERVISOR_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED', 'FOR_CANCELLATION');

-- CreateEnum
CREATE TYPE "SeparationStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "CivilStatus" AS ENUM ('SINGLE', 'MARRIED', 'WIDOWED', 'SEPARATED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "Religion" AS ENUM ('ROMAN_CATHOLIC', 'ISLAM', 'INC', 'CHRISTIAN', 'BUDDHISM', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodType" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG', 'AB_POS', 'AB_NEG');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('MOBILE', 'LANDLINE', 'FAX');

-- CreateEnum
CREATE TYPE "EmailType" AS ENUM ('PERSONAL', 'WORK', 'OTHER');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('HOME', 'PERMANENT', 'PROVINCIAL', 'MAIN', 'BRANCH', 'WAREHOUSE');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('ELEMENTARY', 'HIGH_SCHOOL', 'VOCATIONAL', 'COLLEGE', 'POST_GRADUATE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BIRTH_CERT', 'MARRIAGE_CERT', 'DIPLOMA', 'TRANSCRIPT', 'NBI_CLEARANCE', 'POLICE_CLEARANCE', 'BARANGAY_CLEARANCE', 'MEDICAL_CERT', 'EMPLOYMENT_CERT', 'TIN_ID', 'SSS_ID', 'PHILHEALTH_ID', 'PAGIBIG_ID', 'DRIVERS_LICENSE', 'PASSPORT', 'VOTERS_ID', 'POSTAL_ID', 'UMID', 'PRC_LICENSE', 'CONTRACT', 'MEMO', 'PERFORMANCE_EVAL', 'TRAINING_CERT', 'OTHER');

-- CreateEnum
CREATE TYPE "IdType" AS ENUM ('SSS', 'PHILHEALTH', 'PAGIBIG', 'TIN', 'UMID', 'PASSPORT', 'DRIVERS_LICENSE', 'PRC', 'VOTERS_ID', 'POSTAL_ID', 'SENIOR_ID', 'PWD_ID', 'NBI_CLEARANCE', 'POLICE_CLEARANCE', 'BARANGAY_CLEARANCE');

-- CreateEnum
CREATE TYPE "SalaryRateType" AS ENUM ('MONTHLY', 'DAILY', 'HOURLY');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('S', 'S1', 'S2', 'S3', 'S4', 'ME', 'ME1', 'ME2', 'ME3', 'ME4', 'Z');

-- CreateEnum
CREATE TYPE "TaxTableType" AS ENUM ('MONTHLY', 'SEMI_MONTHLY', 'WEEKLY', 'DAILY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "DtrSource" AS ENUM ('BIOMETRIC', 'WEB', 'MOBILE', 'MANUAL');

-- CreateEnum
CREATE TYPE "DtrApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('FIXED', 'FLEXIBLE', 'SHIFTING', 'COMPRESSED', 'PART_TIME', 'ON_CALL');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('REGULAR', 'SPECIAL_NON_WORKING', 'SPECIAL_WORKING', 'LOCAL', 'COMPANY', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('SAVINGS', 'CHECKING', 'PAYROLL');

-- CreateEnum
CREATE TYPE "PayrollRunType" AS ENUM ('REGULAR', 'THIRTEENTH_MONTH', 'MID_YEAR_BONUS', 'TRIAL_RUN', 'FINAL_PAY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'VALIDATING', 'PROCESSING', 'COMPUTED', 'FOR_REVIEW', 'APPROVED', 'FOR_PAYMENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ACTIVE', 'PAID', 'FULLY_PAID', 'RESTRUCTURED', 'WRITTEN_OFF', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SeparationTypeCode" AS ENUM ('RESIGNATION', 'TERMINATION_WITHOUT_CAUSE', 'TERMINATION_WITH_CAUSE', 'RETIREMENT', 'END_OF_CONTRACT');

-- CreateEnum
CREATE TYPE "SeparationReasonCode" AS ENUM ('RESIGNATION_PERSONAL', 'RESIGNATION_HEALTH', 'RESIGNATION_CAREER', 'TERMINATION_PERFORMANCE', 'TERMINATION_MISCONDUCT', 'REDUNDANCY', 'RETIREMENT', 'END_OF_CONTRACT', 'AWOL', 'OTHER');

-- CreateEnum
CREATE TYPE "OvertimeTypeCode" AS ENUM ('REGULAR_OT', 'REST_DAY_OT', 'SPECIAL_HOLIDAY_OT', 'REGULAR_HOLIDAY_OT', 'REST_DAY_HOLIDAY_OT', 'NIGHT_DIFF');

-- CreateEnum
CREATE TYPE "LoanApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED', 'DISBURSED');

-- CreateEnum
CREATE TYPE "LoanDisbursementMethod" AS ENUM ('CASH', 'CHECK', 'BANK_TRANSFER', 'PAYROLL_CREDIT');

-- CreateEnum
CREATE TYPE "LoanPaymentSource" AS ENUM ('PAYROLL', 'CASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "LoanPaymentStatus" AS ENUM ('SCHEDULED', 'DEDUCTED', 'PAID', 'MISSED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "RecurringDeductionStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LoanTypeCategory" AS ENUM ('SSS', 'PAGIBIG', 'COMPANY', 'CASH_ADVANCE');

-- CreateEnum
CREATE TYPE "LoanInterestType" AS ENUM ('FIXED', 'DIMINISHING', 'ZERO');

-- CreateEnum
CREATE TYPE "PayFrequencyType" AS ENUM ('MONTHLY', 'SEMI_MONTHLY', 'BI_WEEKLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PayPeriodStatus" AS ENUM ('OPEN', 'PROCESSING', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "CompanyIndustry" AS ENUM ('TECHNOLOGY', 'MANUFACTURING', 'FINANCIAL', 'HEALTHCARE', 'RETAIL', 'EDUCATION', 'GOVERNMENT', 'HOSPITALITY', 'LOGISTICS', 'AGRICULTURE', 'CONSTRUCTION', 'ENERGY', 'REAL_ESTATE', 'PROFESSIONAL_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PhilHealthMemberType" AS ENUM ('DIRECT_CONTRIBUTOR', 'INDIRECT_CONTRIBUTOR', 'LIFETIME_MEMBER', 'SENIOR_CITIZEN', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxExemptionStatus" AS ENUM ('NONE', 'FULL', 'PARTIAL');

-- CreateEnum
CREATE TYPE "SocialMediaPlatform" AS ENUM ('FACEBOOK', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'TIKTOK', 'OTHER');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('PROFESSIONAL', 'DRIVERS', 'TECHNICAL', 'BUSINESS', 'OTHER');

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('TECHNOLOGY', 'MANUFACTURING', 'FINANCIAL', 'HEALTHCARE', 'RETAIL', 'EDUCATION', 'GOVERNMENT', 'HOSPITALITY', 'LOGISTICS', 'AGRICULTURE', 'CONSTRUCTION', 'ENERGY', 'REAL_ESTATE', 'PROFESSIONAL_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "LeavingReason" AS ENUM ('RESIGNATION', 'TERMINATION', 'RETIREMENT', 'END_OF_CONTRACT', 'LAYOFF', 'AWOL', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryAdjustmentType" AS ENUM ('INCREASE', 'DECREASE', 'PROMOTION', 'DEMOTION', 'MARKET_ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeMovementType" AS ENUM ('PROMOTION', 'TRANSFER', 'DEMOTION', 'LATERAL');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'STANDARD');

-- CreateEnum
CREATE TYPE "CompanyRole" AS ENUM ('COMPANY_ADMIN', 'HR_ADMIN', 'PAYROLL_ADMIN', 'APPROVER', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "PayPeriodHalf" AS ENUM ('FIRST', 'SECOND');

-- CreateEnum
CREATE TYPE "PayrollProcessStepStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LeaveBalanceTransactionType" AS ENUM ('ACCRUAL', 'USAGE', 'FORFEITURE', 'CONVERSION', 'CARRY_OVER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "EmailAuditEventType" AS ENUM ('EMAIL_SENT', 'EMAIL_FAILED', 'EMAIL_RESEND', 'PAYSLIP_ACCESSED', 'BATCH_EMAIL_SENT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "SeparationAuditAction" AS ENUM ('CREATED', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PayrollProcessStepName" AS ENUM ('CREATE_RUN', 'IMPORT_ATTENDANCE', 'VALIDATE_DATA', 'CALCULATE_PAYROLL', 'REVIEW_ADJUST', 'APPROVE', 'GENERATE_PAYSLIPS', 'PROCESS_PAYMENT', 'CLOSE_RUN');

-- CreateEnum
CREATE TYPE "BiometricSyncStatus" AS ENUM ('STARTED', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AttendanceDeductionRuleType" AS ENUM ('TARDINESS', 'UNDERTIME', 'ABSENCE');

-- CreateEnum
CREATE TYPE "AttendanceDeductionBasis" AS ENUM ('PER_MINUTE', 'PER_15_MINS', 'PER_30_MINS', 'PER_HOUR', 'DAILY_RATE');

-- CreateEnum
CREATE TYPE "LoanDocumentType" AS ENUM ('APPLICATION_FORM', 'PROMISSORY_NOTE', 'COLLATERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurringDeductionType" AS ENUM ('UNION_DUES', 'COOP_SHARES', 'INSURANCE', 'HMO', 'SAVINGS', 'GARNISHMENT');

-- CreateEnum
CREATE TYPE "ContributionType" AS ENUM ('SSS', 'PHILHEALTH', 'PAGIBIG', 'TAX');

-- CreateEnum
CREATE TYPE "ConfigDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'DATE');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('PHP', 'USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 'SGD');

-- CreateEnum
CREATE TYPE "EarningCalculationMethod" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA', 'MANUAL');

-- CreateEnum
CREATE TYPE "EarningFrequency" AS ENUM ('PER_PAYROLL', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "DeductionCalculationMethod" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'FORMULA', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeaveAccrualMethod" AS ENUM ('UPFRONT', 'MONTHLY', 'QUARTERLY', 'PER_PAYROLL');

-- CreateEnum
CREATE TYPE "LeaveProrationMethod" AS ENUM ('FULL', 'PRORATED_MONTH', 'PRORATED_DAY');

-- CreateTable
CREATE TABLE "AccountCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountType" "GLAccountType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "AccountCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GLAccount" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountType" "GLAccountType" NOT NULL,
    "accountCategoryId" TEXT,
    "accountClass" "GLAccountClass",
    "level" INTEGER NOT NULL DEFAULT 0,
    "parentId" TEXT,
    "normalBalance" "NormalBalance" NOT NULL DEFAULT 'DEBIT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPosting" BOOLEAN NOT NULL DEFAULT true,
    "isReconciled" BOOLEAN NOT NULL DEFAULT false,
    "budgetAmount" DECIMAL(15,2),
    "budgetPeriod" "BudgetPeriod",
    "allowNegative" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approvalThreshold" DECIMAL(15,2),
    "externalCode" TEXT,
    "taxCode" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "notes" TEXT,
    "tags" JSONB,
    "customFields" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "GLAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleTypeCode" "ScheduleType" NOT NULL DEFAULT 'FIXED',
    "workStartTime" TIME NOT NULL,
    "workEndTime" TIME NOT NULL,
    "breakStartTime" TIME,
    "breakEndTime" TIME,
    "breakDurationMins" INTEGER NOT NULL DEFAULT 60,
    "gracePeriodMins" INTEGER NOT NULL DEFAULT 0,
    "requiredHoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "restDays" JSONB,
    "dayOverrides" JSONB,
    "flexibleStartTime" TIME,
    "flexibleEndTime" TIME,
    "coreHoursStart" TIME,
    "coreHoursEnd" TIME,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "holidayDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "holidayTypeCode" "HolidayType" NOT NULL DEFAULT 'REGULAR',
    "payMultiplier" DECIMAL(4,2) NOT NULL,
    "applicability" TEXT NOT NULL DEFAULT 'NATIONWIDE',
    "region" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRate" (
    "id" TEXT NOT NULL,
    "overtimeTypeCode" "OvertimeTypeCode" NOT NULL,
    "description" TEXT,
    "rateMultiplier" DECIMAL(4,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricDevice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deviceModel" TEXT NOT NULL,
    "serialNumber" TEXT,
    "firmwareVersion" TEXT,
    "ipAddress" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 4370,
    "timeout" INTEGER NOT NULL DEFAULT 5000,
    "inport" INTEGER,
    "username" TEXT,
    "password" TEXT,
    "locationName" TEXT,
    "branchId" TEXT,
    "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "lastSyncRecordCount" INTEGER NOT NULL DEFAULT 0,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastOnlineAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "BiometricDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricSyncLog" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "syncStartedAt" TIMESTAMP(3) NOT NULL,
    "syncCompletedAt" TIMESTAMP(3),
    "status" "BiometricSyncStatus" NOT NULL,
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsCreated" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "recordsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorDetails" JSONB,
    "syncType" TEXT NOT NULL DEFAULT 'MANUAL',
    "triggeredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTimeRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "attendanceDate" DATE NOT NULL,
    "scheduledTimeIn" TIME,
    "scheduledTimeOut" TIME,
    "actualTimeIn" TIMESTAMP(3),
    "actualTimeOut" TIMESTAMP(3),
    "timeInSourceCode" "DtrSource",
    "timeOutSourceCode" "DtrSource",
    "breakOut" TIMESTAMP(3),
    "breakIn" TIMESTAMP(3),
    "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "hoursWorked" DECIMAL(5,2),
    "tardinessMins" INTEGER NOT NULL DEFAULT 0,
    "undertimeMins" INTEGER NOT NULL DEFAULT 0,
    "overtimeHours" DECIMAL(5,2),
    "nightDiffHours" DECIMAL(5,2),
    "remarks" TEXT,
    "approvalStatusCode" "DtrApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "overtimeDate" DATE NOT NULL,
    "startTime" TIME NOT NULL,
    "endTime" TIME NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "reason" TEXT,
    "statusCode" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "supervisorApproverId" TEXT,
    "supervisorApprovedAt" TIMESTAMP(3),
    "supervisorApprovalRemarks" TEXT,
    "hrApproverId" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrApprovalRemarks" TEXT,
    "hrRejectionReason" TEXT,
    "hrRejectedAt" TIMESTAMP(3),
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalRemarks" TEXT,
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDeductionRule" (
    "id" TEXT NOT NULL,
    "ruleType" "AttendanceDeductionRuleType" NOT NULL,
    "calculationBasis" "AttendanceDeductionBasis" NOT NULL,
    "thresholdMins" INTEGER NOT NULL DEFAULT 0,
    "deductionRate" DECIMAL(10,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceDeductionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "CompanyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "tradeName" TEXT,
    "abbreviation" TEXT,
    "secDtiNumber" TEXT,
    "dateOfIncorporation" TIMESTAMP(3),
    "tinNumber" TEXT,
    "rdoCode" TEXT,
    "sssEmployerNumber" TEXT,
    "sssBranchCode" TEXT,
    "philHealthEmployerNumber" TEXT,
    "pagIbigEmployerNumber" TEXT,
    "industryCode" "CompanyIndustry",
    "companySizeCode" "CompanySize",
    "statusCode" "CompanyStatus",
    "companyGroupId" TEXT,
    "parentCompanyId" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "payslipWatermarkText" TEXT,
    "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'PHP',
    "minimumWageRegion" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyAddress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "addressTypeId" "AddressType" NOT NULL,
    "street" TEXT,
    "barangay" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Philippines',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyContact" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactTypeId" "ContactType" NOT NULL,
    "countryCode" TEXT DEFAULT '+63',
    "areaCode" TEXT,
    "number" TEXT NOT NULL,
    "extension" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyEmail" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "emailTypeId" "EmailType" NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCompanyAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "CompanyRole" NOT NULL DEFAULT 'EMPLOYEE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCompanyAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "isIncludedInGross" BOOLEAN NOT NULL DEFAULT true,
    "isIncludedIn13thMonth" BOOLEAN NOT NULL DEFAULT false,
    "isDeMinimis" BOOLEAN NOT NULL DEFAULT false,
    "deMinimisLimit" DECIMAL(15,2),
    "calculationMethodCode" "EarningCalculationMethod",
    "calculationFormula" TEXT,
    "frequencyCode" "EarningFrequency",
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "expenseAccountId" TEXT,

    CONSTRAINT "EarningType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeductionType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "isPreTax" BOOLEAN NOT NULL DEFAULT true,
    "hasEmployerShare" BOOLEAN NOT NULL DEFAULT false,
    "payPeriodApplicability" TEXT NOT NULL DEFAULT 'EVERY_PAYROLL',
    "calculationMethodCode" "DeductionCalculationMethod",
    "calculationFormula" TEXT,
    "percentageBase" TEXT NOT NULL DEFAULT 'GROSS',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "maxDeductionLimit" DECIMAL(15,2),
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "liabilityAccountId" TEXT,
    "expenseAccountId" TEXT,

    CONSTRAINT "DeductionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalary" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "salaryRateTypeCode" "SalaryRateType" NOT NULL DEFAULT 'MONTHLY',
    "salaryGrade" TEXT,
    "salaryBand" TEXT,
    "monthlyDivisor" INTEGER NOT NULL DEFAULT 365,
    "hoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "dailyRate" DECIMAL(15,4),
    "hourlyRate" DECIMAL(15,4),
    "minimumWageRegion" TEXT,
    "isMinimumWageCompliant" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSalary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEarning" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "earningTypeId" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "frequency" "EarningFrequency" NOT NULL,
    "prorationRule" TEXT,
    "isTaxableOverride" BOOLEAN,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "approvalStatus" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSSContributionTable" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "salaryBracketMin" DECIMAL(15,2) NOT NULL,
    "salaryBracketMax" DECIMAL(15,2) NOT NULL,
    "monthlySalaryCredit" DECIMAL(15,2) NOT NULL,
    "employeeShare" DECIMAL(15,2) NOT NULL,
    "employerShare" DECIMAL(15,2) NOT NULL,
    "ecContribution" DECIMAL(15,2) NOT NULL,
    "totalContribution" DECIMAL(15,2) NOT NULL,
    "wispEmployee" DECIMAL(15,2),
    "wispEmployer" DECIMAL(15,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SSSContributionTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhilHealthContributionTable" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "premiumRate" DECIMAL(5,4) NOT NULL,
    "monthlyFloor" DECIMAL(15,2) NOT NULL,
    "monthlyCeiling" DECIMAL(15,2) NOT NULL,
    "employeeSharePercent" DECIMAL(5,4) NOT NULL,
    "employerSharePercent" DECIMAL(5,4) NOT NULL,
    "membershipCategory" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhilHealthContributionTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagIBIGContributionTable" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "salaryBracketMin" DECIMAL(15,2) NOT NULL,
    "salaryBracketMax" DECIMAL(15,2) NOT NULL,
    "employeeRatePercent" DECIMAL(5,4) NOT NULL,
    "employerRatePercent" DECIMAL(5,4) NOT NULL,
    "maxMonthlyCompensation" DECIMAL(15,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagIBIGContributionTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxTable" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "taxTableTypeCode" "TaxTableType" NOT NULL,
    "bracketOver" DECIMAL(15,2) NOT NULL,
    "bracketNotOver" DECIMAL(15,2) NOT NULL,
    "baseTax" DECIMAL(15,2) NOT NULL,
    "taxRatePercent" DECIMAL(5,4) NOT NULL,
    "excessOver" DECIMAL(15,2) NOT NULL,
    "effectiveYear" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeYTDContribution" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "contributionType" "ContributionType" NOT NULL,
    "totalEmployee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalEmployer" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalContribution" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeYTDContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "dataType" "ConfigDataType" NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isEditable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryRecord" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sentBy" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "deliveryStatus" "EmailDeliveryStatus" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "resendMessageId" TEXT NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailAuditLog" (
    "id" TEXT NOT NULL,
    "eventType" "EmailAuditEventType" NOT NULL,
    "userId" TEXT,
    "payslipId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "companyAssignmentDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeNumber" TEXT NOT NULL,
    "biometricId" TEXT,
    "rfidNumber" TEXT,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "maidenName" TEXT,
    "nickname" TEXT,
    "birthDate" DATE NOT NULL,
    "birthPlace" TEXT,
    "birthCity" TEXT,
    "birthProvince" TEXT,
    "birthCountry" TEXT DEFAULT 'Philippines',
    "genderId" "Gender",
    "civilStatusId" "CivilStatus",
    "nationality" TEXT DEFAULT 'Filipino',
    "citizenship" TEXT DEFAULT 'Filipino',
    "religionId" "Religion",
    "bloodTypeId" "BloodType",
    "heightCm" DECIMAL(5,2),
    "weightKg" DECIMAL(5,2),
    "photoUrl" TEXT,
    "signatureUrl" TEXT,
    "employmentStatusId" TEXT,
    "employmentClassId" TEXT,
    "employmentTypeId" TEXT,
    "applicationDate" DATE,
    "interviewDate" DATE,
    "jobOfferDate" DATE,
    "hireDate" DATE NOT NULL,
    "probationStartDate" DATE,
    "probationEndDate" DATE,
    "regularizationDate" DATE,
    "contractStartDate" DATE,
    "contractEndDate" DATE,
    "separationDate" DATE,
    "lastWorkingDay" DATE,
    "separationReasonCode" "SeparationReasonCode",
    "isRehireEligible" BOOLEAN,
    "rehireNotes" TEXT,
    "positionId" TEXT,
    "positionCode" TEXT,
    "positionLevel" TEXT,
    "jobGrade" TEXT,
    "jobFamily" TEXT,
    "departmentId" TEXT,
    "departmentCode" TEXT,
    "divisionId" TEXT,
    "sectionTeam" TEXT,
    "branchId" TEXT,
    "costCenterId" TEXT,
    "profitCenterId" TEXT,
    "rankId" TEXT,
    "reportingManagerId" TEXT,
    "dottedLineManagerId" TEXT,
    "hrBusinessPartnerId" TEXT,
    "workScheduleId" TEXT,
    "isNightDiffEligible" BOOLEAN NOT NULL DEFAULT false,
    "isOvertimeEligible" BOOLEAN NOT NULL DEFAULT true,
    "isWfhEligible" BOOLEAN NOT NULL DEFAULT false,
    "wfhSchedule" TEXT,
    "taxStatusId" "TaxStatus",
    "numberOfDependents" INTEGER NOT NULL DEFAULT 0,
    "taxExemptionStatusCode" "TaxExemptionStatus",
    "isSubstitutedFiling" BOOLEAN NOT NULL DEFAULT false,
    "previousEmployerIncome" DECIMAL(15,2),
    "previousEmployerTaxWithheld" DECIMAL(15,2),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "deletedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "payPeriodPatternId" TEXT,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAddress" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "addressTypeId" "AddressType" NOT NULL,
    "street" TEXT,
    "barangay" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Philippines',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeContact" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contactTypeId" "ContactType" NOT NULL,
    "countryCode" TEXT DEFAULT '+63',
    "areaCode" TEXT,
    "number" TEXT NOT NULL,
    "extension" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEmail" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "emailTypeId" "EmailType" NOT NULL,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSocialMedia" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "platformCode" "SocialMediaPlatform" NOT NULL,
    "handle" TEXT NOT NULL,
    "profileUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSocialMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeGovernmentId" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "idTypeId" "IdType" NOT NULL,
    "idNumberEncrypted" TEXT NOT NULL,
    "idNumberMasked" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "issuingAuthority" TEXT,
    "placeOfIssue" TEXT,
    "documentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeGovernmentId_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBank" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT,
    "branchName" TEXT,
    "branchCode" TEXT,
    "accountNumberEncrypted" TEXT NOT NULL,
    "accountNumberMasked" TEXT,
    "accountName" TEXT NOT NULL,
    "accountTypeId" "BankAccountType" NOT NULL,
    "currencyCode" "CurrencyCode" NOT NULL DEFAULT 'PHP',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "allocationPercent" DECIMAL(5,2),
    "allocationAmount" DECIMAL(15,2),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDependent" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "relationshipId" "RelationshipType" NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "suffix" TEXT,
    "maidenName" TEXT,
    "birthDate" DATE,
    "birthPlace" TEXT,
    "gender" TEXT,
    "occupation" TEXT,
    "employerName" TEXT,
    "employerAddress" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "tin" TEXT,
    "monthlyIncome" DECIMAL(15,2),
    "marriageDate" DATE,
    "marriagePlace" TEXT,
    "schoolName" TEXT,
    "schoolLevel" TEXT,
    "isTaxDependent" BOOLEAN NOT NULL DEFAULT false,
    "isPwd" BOOLEAN NOT NULL DEFAULT false,
    "pwdId" TEXT,
    "isLiving" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDependent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEmergencyContact" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationshipId" "RelationshipType" NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "mobileNumber" TEXT,
    "landlineNumber" TEXT,
    "email" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBeneficiary" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationshipId" "RelationshipType" NOT NULL,
    "birthDate" DATE,
    "percentage" DECIMAL(5,2) NOT NULL,
    "street" TEXT,
    "city" TEXT,
    "province" TEXT,
    "contactNumber" TEXT,
    "benefitType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBeneficiary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEducation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "educationLevelId" "EducationLevel" NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolAddress" TEXT,
    "course" TEXT,
    "major" TEXT,
    "yearStarted" INTEGER,
    "yearGraduated" INTEGER,
    "isGraduated" BOOLEAN NOT NULL DEFAULT false,
    "isOngoing" BOOLEAN NOT NULL DEFAULT false,
    "honors" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLicense" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "licenseTypeCode" "LicenseType" NOT NULL,
    "licenseNumber" TEXT NOT NULL,
    "issuingBody" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "documentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCertification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issuingOrganization" TEXT,
    "credentialId" TEXT,
    "issueDate" DATE,
    "expiryDate" DATE,
    "documentUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeTraining" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "trainingName" TEXT NOT NULL,
    "provider" TEXT,
    "trainingDate" DATE,
    "trainingEndDate" DATE,
    "durationHours" DECIMAL(6,2),
    "location" TEXT,
    "certificateUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeTraining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSkill" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "proficiencyLevel" TEXT,
    "yearsExperience" DECIMAL(4,1),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePreviousEmployment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT,
    "industryCode" "IndustryType",
    "position" TEXT,
    "department" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "reasonForLeavingCode" "LeavingReason",
    "lastSalary" DECIMAL(15,2),
    "lastBenefits" TEXT,
    "supervisorName" TEXT,
    "supervisorContact" TEXT,
    "referenceCheckStatus" TEXT,
    "referenceCheckNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeePreviousEmployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatusHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousStatusId" TEXT,
    "newStatusId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "remarks" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeePositionHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousPositionId" TEXT,
    "newPositionId" TEXT NOT NULL,
    "previousDepartmentId" TEXT,
    "newDepartmentId" TEXT,
    "previousBranchId" TEXT,
    "newBranchId" TEXT,
    "movementType" "EmployeeMovementType" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "remarks" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeePositionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeSalaryHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousSalary" DECIMAL(15,2),
    "newSalary" DECIMAL(15,2) NOT NULL,
    "adjustmentTypeCode" "SalaryAdjustmentType",
    "adjustmentPercent" DECIMAL(5,2),
    "adjustmentAmount" DECIMAL(15,2),
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "remarks" TEXT,
    "approvalStatus" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeSalaryHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeScheduleHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousScheduleId" TEXT,
    "newScheduleId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeScheduleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRankHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousRankId" TEXT,
    "newRankId" TEXT NOT NULL,
    "movementType" "EmployeeMovementType" NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT,
    "remarks" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeRankHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "colorCode" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "payPercentage" DECIMAL(5,2) NOT NULL DEFAULT 100,
    "isConvertibleToCash" BOOLEAN NOT NULL DEFAULT false,
    "cashConversionRate" DECIMAL(5,2),
    "isCarriedOver" BOOLEAN NOT NULL DEFAULT false,
    "maxCarryOverDays" DECIMAL(5,2),
    "carryOverExpiryMonths" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "requiresDocuments" BOOLEAN NOT NULL DEFAULT false,
    "requiredDocumentTypes" TEXT,
    "minConsecutiveDays" DECIMAL(5,2),
    "maxConsecutiveDays" DECIMAL(5,2),
    "advanceNoticeDays" INTEGER,
    "allowHalfDay" BOOLEAN NOT NULL DEFAULT true,
    "allowHourly" BOOLEAN NOT NULL DEFAULT false,
    "genderApplicability" TEXT NOT NULL DEFAULT 'ALL',
    "statusApplicability" TEXT NOT NULL DEFAULT 'ALL',
    "minTenureMonths" INTEGER,
    "affectsAttendance" BOOLEAN NOT NULL DEFAULT true,
    "isCTO" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "employmentStatusId" TEXT NOT NULL,
    "annualEntitlement" DECIMAL(5,2) NOT NULL,
    "accrualMethodCode" "LeaveAccrualMethod" NOT NULL DEFAULT 'UPFRONT',
    "accrualRate" DECIMAL(5,4),
    "prorationMethodCode" "LeaveProrationMethod" NOT NULL DEFAULT 'PRORATED_MONTH',
    "tenureIncrements" JSONB,
    "maxAccumulation" DECIMAL(5,2),
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalance" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "openingBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "creditsEarned" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "creditsUsed" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "creditsForfeited" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "creditsConverted" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "creditsCarriedOver" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "pendingRequests" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveBalanceTransaction" (
    "id" TEXT NOT NULL,
    "leaveBalanceId" TEXT NOT NULL,
    "transactionType" "LeaveBalanceTransactionType" NOT NULL,
    "amount" DECIMAL(6,2) NOT NULL,
    "runningBalance" DECIMAL(6,2) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "remarks" TEXT,
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveBalanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "numberOfDays" DECIMAL(5,2) NOT NULL,
    "isHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "halfDayPeriod" TEXT,
    "numberOfHours" DECIMAL(5,2),
    "reason" TEXT,
    "handoverNotes" TEXT,
    "statusCode" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "supervisorApproverId" TEXT,
    "supervisorApprovedAt" TIMESTAMP(3),
    "supervisorApprovalRemarks" TEXT,
    "hrApproverId" TEXT,
    "hrApprovedAt" TIMESTAMP(3),
    "hrApprovalRemarks" TEXT,
    "hrRejectionReason" TEXT,
    "hrRejectedAt" TIMESTAMP(3),
    "approverId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalRemarks" TEXT,
    "rejectionReason" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequestAttachment" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveRequestAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryCode" "LoanTypeCategory",
    "maxLoanAmount" DECIMAL(15,2),
    "maxTermMonths" INTEGER,
    "interestTypeCode" "LoanInterestType" NOT NULL DEFAULT 'FIXED',
    "defaultInterestRate" DECIMAL(5,4),
    "requiresCollateral" BOOLEAN NOT NULL DEFAULT false,
    "requiresCoMaker" BOOLEAN NOT NULL DEFAULT false,
    "minTenureMonths" INTEGER,
    "eligibleStatuses" JSONB,
    "deductionPriority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "loanNumber" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "loanTypeId" TEXT NOT NULL,
    "applicationDate" TIMESTAMP(3) NOT NULL,
    "requestedAmount" DECIMAL(15,2) NOT NULL,
    "requestedTermMonths" INTEGER NOT NULL,
    "purpose" TEXT,
    "applicationStatusCode" "LoanApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalRemarks" TEXT,
    "rejectionReason" TEXT,
    "approvedAmount" DECIMAL(15,2),
    "approvedTermMonths" INTEGER,
    "interestRate" DECIMAL(5,4),
    "totalInterest" DECIMAL(15,2),
    "totalAmountPayable" DECIMAL(15,2),
    "periodicAmortization" DECIMAL(15,2),
    "disbursementDate" TIMESTAMP(3),
    "disbursementMethodCode" "LoanDisbursementMethod",
    "disbursementReference" TEXT,
    "amortizationStartDate" TIMESTAMP(3),
    "maturityDate" TIMESTAMP(3),
    "coMakerId" TEXT,
    "statusCode" "LoanStatus" NOT NULL DEFAULT 'PENDING',
    "principalBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "interestBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "totalBalance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanAmortization" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "principalAmount" DECIMAL(15,2) NOT NULL,
    "interestAmount" DECIMAL(15,2) NOT NULL,
    "totalPayment" DECIMAL(15,2) NOT NULL,
    "runningBalance" DECIMAL(15,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TIMESTAMP(3),
    "paidAmount" DECIMAL(15,2),
    "isDeferred" BOOLEAN NOT NULL DEFAULT false,
    "deferredToDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanAmortization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanPayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amountPaid" DECIMAL(15,2) NOT NULL,
    "principalPaid" DECIMAL(15,2) NOT NULL,
    "interestPaid" DECIMAL(15,2) NOT NULL,
    "balanceAfter" DECIMAL(15,2) NOT NULL,
    "paymentSourceCode" "LoanPaymentSource" NOT NULL DEFAULT 'PAYROLL',
    "payrollRunId" TEXT,
    "statusCode" "LoanPaymentStatus" NOT NULL DEFAULT 'PAID',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanDocument" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "documentType" "LoanDocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringDeduction" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deductionTypeId" TEXT NOT NULL,
    "deductionTypeCode" "RecurringDeductionType" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "isPercentage" BOOLEAN NOT NULL DEFAULT false,
    "percentageRate" DECIMAL(5,4),
    "frequency" TEXT NOT NULL DEFAULT 'PER_PAYROLL',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "statusCode" "RecurringDeductionStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalDeducted" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMedicalRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "examYear" INTEGER NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "examType" TEXT NOT NULL DEFAULT 'APE',
    "clinicName" TEXT,
    "physician" TEXT,
    "findings" TEXT,
    "remarks" TEXT,
    "result" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "EmployeeMedicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeMedicalAttachment" (
    "id" TEXT NOT NULL,
    "medicalRecordId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "description" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,

    CONSTRAINT "EmployeeMedicalAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "documentTypeId" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "uploadedById" TEXT,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "managerId" TEXT,
    "costCenterId" TEXT,
    "profitCenterId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jobFamily" TEXT,
    "jobGrade" TEXT,
    "salaryGradeMin" DECIMAL(15,2),
    "salaryGradeMax" DECIMAL(15,2),
    "level" INTEGER NOT NULL DEFAULT 0,
    "minExperienceYears" INTEGER,
    "educationRequired" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "street" TEXT,
    "barangay" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "province" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Philippines',
    "phone" TEXT,
    "email" TEXT,
    "minimumWageRegion" TEXT,
    "managerId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "headId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Division_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentStatus" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowsPayroll" BOOLEAN NOT NULL DEFAULT true,
    "allowsLeave" BOOLEAN NOT NULL DEFAULT true,
    "allowsLoans" BOOLEAN NOT NULL DEFAULT true,
    "triggersOffboarding" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "EmploymentStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "hasBenefits" BOOLEAN NOT NULL DEFAULT true,
    "hasLeaveCredits" BOOLEAN NOT NULL DEFAULT true,
    "has13thMonth" BOOLEAN NOT NULL DEFAULT true,
    "hasMandatoryDeductions" BOOLEAN NOT NULL DEFAULT true,
    "maxContractMonths" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "EmploymentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentClass" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standardHoursPerDay" DECIMAL(4,2) NOT NULL DEFAULT 8,
    "standardDaysPerWeek" INTEGER NOT NULL DEFAULT 5,
    "isOvertimeEligible" BOOLEAN NOT NULL DEFAULT true,
    "isHolidayPayEligible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "EmploymentClass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rank" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "parentId" TEXT,
    "salaryGradeMin" DECIMAL(15,2),
    "salaryGradeMax" DECIMAL(15,2),
    "promotionPaths" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "Rank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPeriodPattern" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "payFrequencyCode" "PayFrequencyType" NOT NULL DEFAULT 'SEMI_MONTHLY',
    "periodsPerYear" INTEGER NOT NULL DEFAULT 24,
    "paymentDayOffset" INTEGER NOT NULL DEFAULT 0,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPeriodPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayPeriod" (
    "id" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "periodHalf" "PayPeriodHalf" NOT NULL,
    "cutoffStartDate" DATE NOT NULL,
    "cutoffEndDate" DATE NOT NULL,
    "paymentDate" DATE NOT NULL,
    "workingDays" INTEGER,
    "statusCode" "PayPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "runNumber" TEXT NOT NULL,
    "payPeriodId" TEXT NOT NULL,
    "runTypeCode" "PayrollRunType" NOT NULL DEFAULT 'REGULAR',
    "statusCode" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "currentStepNumber" INTEGER NOT NULL DEFAULT 1,
    "currentStepName" TEXT NOT NULL DEFAULT 'CREATE_RUN',
    "isStepLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidById" TEXT,
    "totalEmployees" INTEGER NOT NULL DEFAULT 0,
    "totalGrossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalNetPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEmployerCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalEmployerContributions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPostedToGL" BOOLEAN NOT NULL DEFAULT false,
    "postedToGLAt" TIMESTAMP(3),
    "postedToGLById" TEXT,
    "glBatchNumber" TEXT,
    "glPostingNotes" TEXT,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollProcessStep" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "stepName" "PayrollProcessStepName" NOT NULL,
    "stepDescription" TEXT,
    "status" "PayrollProcessStepStatus" NOT NULL DEFAULT 'PENDING',
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "validationErrors" JSONB,
    "validationWarnings" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollProcessStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payslipNumber" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "baseSalary" DECIMAL(15,2) NOT NULL,
    "dailyRate" DECIMAL(15,4) NOT NULL,
    "hourlyRate" DECIMAL(15,4) NOT NULL,
    "workingDays" DECIMAL(5,2) NOT NULL,
    "daysWorked" DECIMAL(5,2) NOT NULL,
    "daysAbsent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "hoursWorked" DECIMAL(6,2),
    "overtimeHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "tardinessMins" INTEGER NOT NULL DEFAULT 0,
    "undertimeMins" INTEGER NOT NULL DEFAULT 0,
    "nightDiffHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "basicPay" DECIMAL(15,2) NOT NULL,
    "grossPay" DECIMAL(15,2) NOT NULL,
    "totalEarnings" DECIMAL(15,2) NOT NULL,
    "totalDeductions" DECIMAL(15,2) NOT NULL,
    "netPay" DECIMAL(15,2) NOT NULL,
    "sssEmployee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sssEmployer" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "philHealthEmployee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "philHealthEmployer" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pagIbigEmployee" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "pagIbigEmployer" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "withholdingTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "ytdGrossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ytdTaxableIncome" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ytdTaxWithheld" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ytdSSS" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ytdPhilHealth" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ytdPagIbig" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ytdNetPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipEarning" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "earningTypeId" TEXT NOT NULL,
    "description" TEXT,
    "hours" DECIMAL(6,2),
    "days" DECIMAL(5,2),
    "rate" DECIMAL(15,4),
    "amount" DECIMAL(15,2) NOT NULL,
    "isTaxable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipDeduction" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "deductionTypeId" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "employerShare" DECIMAL(15,2),
    "referenceType" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeparationRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "separationTypeCode" "SeparationTypeCode" NOT NULL,
    "separationReasonCode" "SeparationReasonCode" NOT NULL,
    "requestedSeparationDate" DATE NOT NULL,
    "lastWorkingDay" DATE NOT NULL,
    "noticePeriodInDays" INTEGER NOT NULL,
    "status" "SeparationStatus" NOT NULL,
    "isRehireEligible" BOOLEAN NOT NULL DEFAULT true,
    "rehireNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "SeparationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinalPayCalculation" (
    "id" TEXT NOT NULL,
    "separationRequestId" TEXT NOT NULL,
    "lastSalary" DECIMAL(15,2) NOT NULL,
    "unpaidOvertime" DECIMAL(15,2) NOT NULL,
    "vacationLeaveConversion" DECIMAL(15,2) NOT NULL,
    "sickLeaveConversion" DECIMAL(15,2) NOT NULL,
    "proRata13thMonth" DECIMAL(15,2) NOT NULL,
    "separationPay" DECIMAL(15,2) NOT NULL,
    "otherEarnings" DECIMAL(15,2) NOT NULL,
    "totalEarnings" DECIMAL(15,2) NOT NULL,
    "outstandingLoans" DECIMAL(15,2) NOT NULL,
    "outstandingAdvances" DECIMAL(15,2) NOT NULL,
    "equipmentCharges" DECIMAL(15,2) NOT NULL,
    "otherDeductions" DECIMAL(15,2) NOT NULL,
    "totalDeductions" DECIMAL(15,2) NOT NULL,
    "netFinalPay" DECIMAL(15,2) NOT NULL,
    "earningsBreakdown" JSONB NOT NULL,
    "deductionsBreakdown" JSONB NOT NULL,
    "calculatedBy" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "FinalPayCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeparationAuditLog" (
    "id" TEXT NOT NULL,
    "separationRequestId" TEXT NOT NULL,
    "action" "SeparationAuditAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "previousState" JSONB,
    "newState" JSONB,
    "notes" TEXT,

    CONSTRAINT "SeparationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetup" (
    "id" TEXT NOT NULL,
    "isInitialized" BOOLEAN NOT NULL DEFAULT false,
    "setupCompletedAt" TIMESTAMP(3),
    "setupCompletedById" TEXT,
    "adminUserCreated" BOOLEAN NOT NULL DEFAULT false,
    "companyCreated" BOOLEAN NOT NULL DEFAULT false,
    "governmentIdsSet" BOOLEAN NOT NULL DEFAULT false,
    "payPeriodConfigured" BOOLEAN NOT NULL DEFAULT false,
    "workScheduleConfigured" BOOLEAN NOT NULL DEFAULT false,
    "contributionTablesLoaded" BOOLEAN NOT NULL DEFAULT false,
    "taxTablesLoaded" BOOLEAN NOT NULL DEFAULT false,
    "defaultLookupsCreated" BOOLEAN NOT NULL DEFAULT false,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'STANDARD',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "isRequestApprover" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "selectedCompanyId" TEXT,
    "preferredTimezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
    "lastCompanySwitchedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "fieldName" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountCategory_code_idx" ON "AccountCategory"("code");

-- CreateIndex
CREATE INDEX "AccountCategory_companyId_idx" ON "AccountCategory"("companyId");

-- CreateIndex
CREATE INDEX "AccountCategory_accountType_idx" ON "AccountCategory"("accountType");

-- CreateIndex
CREATE INDEX "AccountCategory_isActive_idx" ON "AccountCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCategory_companyId_code_key" ON "AccountCategory"("companyId", "code");

-- CreateIndex
CREATE INDEX "GLAccount_code_idx" ON "GLAccount"("code");

-- CreateIndex
CREATE INDEX "GLAccount_companyId_idx" ON "GLAccount"("companyId");

-- CreateIndex
CREATE INDEX "GLAccount_accountType_idx" ON "GLAccount"("accountType");

-- CreateIndex
CREATE INDEX "GLAccount_accountCategoryId_idx" ON "GLAccount"("accountCategoryId");

-- CreateIndex
CREATE INDEX "GLAccount_accountClass_idx" ON "GLAccount"("accountClass");

-- CreateIndex
CREATE INDEX "GLAccount_level_idx" ON "GLAccount"("level");

-- CreateIndex
CREATE INDEX "GLAccount_parentId_idx" ON "GLAccount"("parentId");

-- CreateIndex
CREATE INDEX "GLAccount_isActive_idx" ON "GLAccount"("isActive");

-- CreateIndex
CREATE INDEX "GLAccount_isPosting_idx" ON "GLAccount"("isPosting");

-- CreateIndex
CREATE UNIQUE INDEX "GLAccount_companyId_code_key" ON "GLAccount"("companyId", "code");

-- CreateIndex
CREATE INDEX "WorkSchedule_code_idx" ON "WorkSchedule"("code");

-- CreateIndex
CREATE INDEX "WorkSchedule_isActive_idx" ON "WorkSchedule"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_companyId_code_key" ON "WorkSchedule"("companyId", "code");

-- CreateIndex
CREATE INDEX "Holiday_holidayDate_idx" ON "Holiday"("holidayDate");

-- CreateIndex
CREATE INDEX "Holiday_holidayTypeCode_idx" ON "Holiday"("holidayTypeCode");

-- CreateIndex
CREATE INDEX "Holiday_companyId_idx" ON "Holiday"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_holidayDate_applicability_region_companyId_key" ON "Holiday"("holidayDate", "applicability", "region", "companyId");

-- CreateIndex
CREATE INDEX "OvertimeRate_overtimeTypeCode_idx" ON "OvertimeRate"("overtimeTypeCode");

-- CreateIndex
CREATE INDEX "OvertimeRate_effectiveFrom_idx" ON "OvertimeRate"("effectiveFrom");

-- CreateIndex
CREATE INDEX "BiometricDevice_companyId_idx" ON "BiometricDevice"("companyId");

-- CreateIndex
CREATE INDEX "BiometricDevice_ipAddress_idx" ON "BiometricDevice"("ipAddress");

-- CreateIndex
CREATE INDEX "BiometricDevice_isActive_idx" ON "BiometricDevice"("isActive");

-- CreateIndex
CREATE INDEX "BiometricDevice_isOnline_idx" ON "BiometricDevice"("isOnline");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricDevice_companyId_code_key" ON "BiometricDevice"("companyId", "code");

-- CreateIndex
CREATE INDEX "BiometricSyncLog_deviceId_idx" ON "BiometricSyncLog"("deviceId");

-- CreateIndex
CREATE INDEX "BiometricSyncLog_syncStartedAt_idx" ON "BiometricSyncLog"("syncStartedAt");

-- CreateIndex
CREATE INDEX "BiometricSyncLog_status_idx" ON "BiometricSyncLog"("status");

-- CreateIndex
CREATE INDEX "DailyTimeRecord_employeeId_idx" ON "DailyTimeRecord"("employeeId");

-- CreateIndex
CREATE INDEX "DailyTimeRecord_attendanceDate_idx" ON "DailyTimeRecord"("attendanceDate");

-- CreateIndex
CREATE INDEX "DailyTimeRecord_attendanceStatus_idx" ON "DailyTimeRecord"("attendanceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTimeRecord_employeeId_attendanceDate_key" ON "DailyTimeRecord"("employeeId", "attendanceDate");

-- CreateIndex
CREATE UNIQUE INDEX "OvertimeRequest_requestNumber_key" ON "OvertimeRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_overtimeDate_idx" ON "OvertimeRequest"("overtimeDate");

-- CreateIndex
CREATE INDEX "OvertimeRequest_statusCode_idx" ON "OvertimeRequest"("statusCode");

-- CreateIndex
CREATE INDEX "OvertimeRequest_supervisorApproverId_idx" ON "OvertimeRequest"("supervisorApproverId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_hrApproverId_idx" ON "OvertimeRequest"("hrApproverId");

-- CreateIndex
CREATE INDEX "OvertimeRequest_employeeId_statusCode_idx" ON "OvertimeRequest"("employeeId", "statusCode");

-- CreateIndex
CREATE INDEX "OvertimeRequest_overtimeDate_statusCode_idx" ON "OvertimeRequest"("overtimeDate", "statusCode");

-- CreateIndex
CREATE INDEX "AttendanceDeductionRule_ruleType_idx" ON "AttendanceDeductionRule"("ruleType");

-- CreateIndex
CREATE INDEX "AttendanceDeductionRule_effectiveFrom_idx" ON "AttendanceDeductionRule"("effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyGroup_code_key" ON "CompanyGroup"("code");

-- CreateIndex
CREATE INDEX "CompanyGroup_code_idx" ON "CompanyGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_code_idx" ON "Company"("code");

-- CreateIndex
CREATE INDEX "Company_companyGroupId_idx" ON "Company"("companyGroupId");

-- CreateIndex
CREATE INDEX "Company_parentCompanyId_idx" ON "Company"("parentCompanyId");

-- CreateIndex
CREATE INDEX "Company_isActive_idx" ON "Company"("isActive");

-- CreateIndex
CREATE INDEX "CompanyAddress_companyId_idx" ON "CompanyAddress"("companyId");

-- CreateIndex
CREATE INDEX "CompanyAddress_addressTypeId_idx" ON "CompanyAddress"("addressTypeId");

-- CreateIndex
CREATE INDEX "CompanyContact_companyId_idx" ON "CompanyContact"("companyId");

-- CreateIndex
CREATE INDEX "CompanyContact_contactTypeId_idx" ON "CompanyContact"("contactTypeId");

-- CreateIndex
CREATE INDEX "CompanyEmail_companyId_idx" ON "CompanyEmail"("companyId");

-- CreateIndex
CREATE INDEX "CompanyEmail_email_idx" ON "CompanyEmail"("email");

-- CreateIndex
CREATE INDEX "UserCompanyAccess_userId_idx" ON "UserCompanyAccess"("userId");

-- CreateIndex
CREATE INDEX "UserCompanyAccess_companyId_idx" ON "UserCompanyAccess"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCompanyAccess_userId_companyId_key" ON "UserCompanyAccess"("userId", "companyId");

-- CreateIndex
CREATE INDEX "EarningType_code_idx" ON "EarningType"("code");

-- CreateIndex
CREATE INDEX "EarningType_companyId_idx" ON "EarningType"("companyId");

-- CreateIndex
CREATE INDEX "EarningType_isActive_idx" ON "EarningType"("isActive");

-- CreateIndex
CREATE INDEX "EarningType_expenseAccountId_idx" ON "EarningType"("expenseAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "EarningType_companyId_code_key" ON "EarningType"("companyId", "code");

-- CreateIndex
CREATE INDEX "DeductionType_code_idx" ON "DeductionType"("code");

-- CreateIndex
CREATE INDEX "DeductionType_companyId_idx" ON "DeductionType"("companyId");

-- CreateIndex
CREATE INDEX "DeductionType_isActive_idx" ON "DeductionType"("isActive");

-- CreateIndex
CREATE INDEX "DeductionType_priority_idx" ON "DeductionType"("priority");

-- CreateIndex
CREATE INDEX "DeductionType_liabilityAccountId_idx" ON "DeductionType"("liabilityAccountId");

-- CreateIndex
CREATE INDEX "DeductionType_expenseAccountId_idx" ON "DeductionType"("expenseAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "DeductionType_companyId_code_key" ON "DeductionType"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeSalary_employeeId_key" ON "EmployeeSalary"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalary_employeeId_idx" ON "EmployeeSalary"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalary_effectiveDate_idx" ON "EmployeeSalary"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeEarning_employeeId_idx" ON "EmployeeEarning"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_earningTypeId_idx" ON "EmployeeEarning"("earningTypeId");

-- CreateIndex
CREATE INDEX "EmployeeEarning_effectiveFrom_idx" ON "EmployeeEarning"("effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeEarning_isActive_idx" ON "EmployeeEarning"("isActive");

-- CreateIndex
CREATE INDEX "SSSContributionTable_version_idx" ON "SSSContributionTable"("version");

-- CreateIndex
CREATE INDEX "SSSContributionTable_effectiveFrom_idx" ON "SSSContributionTable"("effectiveFrom");

-- CreateIndex
CREATE INDEX "SSSContributionTable_salaryBracketMin_salaryBracketMax_idx" ON "SSSContributionTable"("salaryBracketMin", "salaryBracketMax");

-- CreateIndex
CREATE INDEX "PhilHealthContributionTable_version_idx" ON "PhilHealthContributionTable"("version");

-- CreateIndex
CREATE INDEX "PhilHealthContributionTable_effectiveFrom_idx" ON "PhilHealthContributionTable"("effectiveFrom");

-- CreateIndex
CREATE INDEX "PagIBIGContributionTable_version_idx" ON "PagIBIGContributionTable"("version");

-- CreateIndex
CREATE INDEX "PagIBIGContributionTable_effectiveFrom_idx" ON "PagIBIGContributionTable"("effectiveFrom");

-- CreateIndex
CREATE INDEX "PagIBIGContributionTable_salaryBracketMin_salaryBracketMax_idx" ON "PagIBIGContributionTable"("salaryBracketMin", "salaryBracketMax");

-- CreateIndex
CREATE INDEX "TaxTable_version_idx" ON "TaxTable"("version");

-- CreateIndex
CREATE INDEX "TaxTable_taxTableTypeCode_idx" ON "TaxTable"("taxTableTypeCode");

-- CreateIndex
CREATE INDEX "TaxTable_effectiveYear_idx" ON "TaxTable"("effectiveYear");

-- CreateIndex
CREATE INDEX "TaxTable_effectiveFrom_idx" ON "TaxTable"("effectiveFrom");

-- CreateIndex
CREATE INDEX "TaxTable_bracketOver_bracketNotOver_idx" ON "TaxTable"("bracketOver", "bracketNotOver");

-- CreateIndex
CREATE INDEX "EmployeeYTDContribution_employeeId_idx" ON "EmployeeYTDContribution"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeYTDContribution_year_idx" ON "EmployeeYTDContribution"("year");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeYTDContribution_employeeId_year_contributionType_key" ON "EmployeeYTDContribution"("employeeId", "year", "contributionType");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_key_key" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_key_idx" ON "SystemConfig"("key");

-- CreateIndex
CREATE INDEX "SystemConfig_category_idx" ON "SystemConfig"("category");

-- CreateIndex
CREATE UNIQUE INDEX "AccessToken_token_key" ON "AccessToken"("token");

-- CreateIndex
CREATE INDEX "AccessToken_token_idx" ON "AccessToken"("token");

-- CreateIndex
CREATE INDEX "AccessToken_payslipId_idx" ON "AccessToken"("payslipId");

-- CreateIndex
CREATE INDEX "AccessToken_expiresAt_idx" ON "AccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailDeliveryRecord_payslipId_idx" ON "EmailDeliveryRecord"("payslipId");

-- CreateIndex
CREATE INDEX "EmailDeliveryRecord_deliveryStatus_idx" ON "EmailDeliveryRecord"("deliveryStatus");

-- CreateIndex
CREATE INDEX "EmailDeliveryRecord_resendMessageId_idx" ON "EmailDeliveryRecord"("resendMessageId");

-- CreateIndex
CREATE INDEX "EmailDeliveryRecord_sentAt_idx" ON "EmailDeliveryRecord"("sentAt");

-- CreateIndex
CREATE INDEX "EmailAuditLog_eventType_idx" ON "EmailAuditLog"("eventType");

-- CreateIndex
CREATE INDEX "EmailAuditLog_payslipId_idx" ON "EmailAuditLog"("payslipId");

-- CreateIndex
CREATE INDEX "EmailAuditLog_timestamp_idx" ON "EmailAuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "EmailAuditLog_userId_idx" ON "EmailAuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE INDEX "Employee_employeeNumber_idx" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_lastName_firstName_idx" ON "Employee"("lastName", "firstName");

-- CreateIndex
CREATE INDEX "Employee_departmentId_idx" ON "Employee"("departmentId");

-- CreateIndex
CREATE INDEX "Employee_branchId_idx" ON "Employee"("branchId");

-- CreateIndex
CREATE INDEX "Employee_employmentStatusId_idx" ON "Employee"("employmentStatusId");

-- CreateIndex
CREATE INDEX "Employee_hireDate_idx" ON "Employee"("hireDate");

-- CreateIndex
CREATE INDEX "Employee_isActive_idx" ON "Employee"("isActive");

-- CreateIndex
CREATE INDEX "Employee_reportingManagerId_idx" ON "Employee"("reportingManagerId");

-- CreateIndex
CREATE INDEX "Employee_companyId_isActive_idx" ON "Employee"("companyId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_departmentId_isActive_idx" ON "Employee"("departmentId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_employmentStatusId_isActive_idx" ON "Employee"("employmentStatusId", "isActive");

-- CreateIndex
CREATE INDEX "Employee_branchId_isActive_idx" ON "Employee"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_employeeNumber_key" ON "Employee"("companyId", "employeeNumber");

-- CreateIndex
CREATE INDEX "EmployeeAddress_employeeId_idx" ON "EmployeeAddress"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeAddress_addressTypeId_idx" ON "EmployeeAddress"("addressTypeId");

-- CreateIndex
CREATE INDEX "EmployeeContact_employeeId_idx" ON "EmployeeContact"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeContact_contactTypeId_idx" ON "EmployeeContact"("contactTypeId");

-- CreateIndex
CREATE INDEX "EmployeeEmail_employeeId_idx" ON "EmployeeEmail"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEmail_email_idx" ON "EmployeeEmail"("email");

-- CreateIndex
CREATE INDEX "EmployeeSocialMedia_employeeId_idx" ON "EmployeeSocialMedia"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeGovernmentId_employeeId_idx" ON "EmployeeGovernmentId"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeGovernmentId_idTypeId_idx" ON "EmployeeGovernmentId"("idTypeId");

-- CreateIndex
CREATE INDEX "EmployeeGovernmentId_expiryDate_idx" ON "EmployeeGovernmentId"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeGovernmentId_employeeId_idTypeId_key" ON "EmployeeGovernmentId"("employeeId", "idTypeId");

-- CreateIndex
CREATE INDEX "EmployeeBank_employeeId_idx" ON "EmployeeBank"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeBank_isPrimary_idx" ON "EmployeeBank"("isPrimary");

-- CreateIndex
CREATE INDEX "EmployeeBank_isActive_idx" ON "EmployeeBank"("isActive");

-- CreateIndex
CREATE INDEX "EmployeeBank_isPrimary_isActive_idx" ON "EmployeeBank"("isPrimary", "isActive");

-- CreateIndex
CREATE INDEX "EmployeeDependent_employeeId_idx" ON "EmployeeDependent"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDependent_relationshipId_idx" ON "EmployeeDependent"("relationshipId");

-- CreateIndex
CREATE INDEX "EmployeeEmergencyContact_employeeId_idx" ON "EmployeeEmergencyContact"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEmergencyContact_priority_idx" ON "EmployeeEmergencyContact"("priority");

-- CreateIndex
CREATE INDEX "EmployeeEmergencyContact_relationshipId_idx" ON "EmployeeEmergencyContact"("relationshipId");

-- CreateIndex
CREATE INDEX "EmployeeBeneficiary_employeeId_idx" ON "EmployeeBeneficiary"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeBeneficiary_relationshipId_idx" ON "EmployeeBeneficiary"("relationshipId");

-- CreateIndex
CREATE INDEX "EmployeeEducation_employeeId_idx" ON "EmployeeEducation"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEducation_educationLevelId_idx" ON "EmployeeEducation"("educationLevelId");

-- CreateIndex
CREATE INDEX "EmployeeLicense_employeeId_idx" ON "EmployeeLicense"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeLicense_expiryDate_idx" ON "EmployeeLicense"("expiryDate");

-- CreateIndex
CREATE INDEX "EmployeeLicense_licenseTypeCode_idx" ON "EmployeeLicense"("licenseTypeCode");

-- CreateIndex
CREATE INDEX "EmployeeCertification_employeeId_idx" ON "EmployeeCertification"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeCertification_expiryDate_idx" ON "EmployeeCertification"("expiryDate");

-- CreateIndex
CREATE INDEX "EmployeeTraining_employeeId_idx" ON "EmployeeTraining"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSkill_employeeId_idx" ON "EmployeeSkill"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeePreviousEmployment_employeeId_idx" ON "EmployeePreviousEmployment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeePreviousEmployment_industryCode_idx" ON "EmployeePreviousEmployment"("industryCode");

-- CreateIndex
CREATE INDEX "EmployeePreviousEmployment_reasonForLeavingCode_idx" ON "EmployeePreviousEmployment"("reasonForLeavingCode");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_employeeId_idx" ON "EmployeeStatusHistory"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_effectiveDate_idx" ON "EmployeeStatusHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_previousStatusId_idx" ON "EmployeeStatusHistory"("previousStatusId");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_newStatusId_idx" ON "EmployeeStatusHistory"("newStatusId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_employeeId_idx" ON "EmployeePositionHistory"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_effectiveDate_idx" ON "EmployeePositionHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_previousPositionId_idx" ON "EmployeePositionHistory"("previousPositionId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_newPositionId_idx" ON "EmployeePositionHistory"("newPositionId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_previousDepartmentId_idx" ON "EmployeePositionHistory"("previousDepartmentId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_newDepartmentId_idx" ON "EmployeePositionHistory"("newDepartmentId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_previousBranchId_idx" ON "EmployeePositionHistory"("previousBranchId");

-- CreateIndex
CREATE INDEX "EmployeePositionHistory_newBranchId_idx" ON "EmployeePositionHistory"("newBranchId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryHistory_employeeId_idx" ON "EmployeeSalaryHistory"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeSalaryHistory_effectiveDate_idx" ON "EmployeeSalaryHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeScheduleHistory_employeeId_idx" ON "EmployeeScheduleHistory"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeScheduleHistory_effectiveDate_idx" ON "EmployeeScheduleHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeRankHistory_employeeId_idx" ON "EmployeeRankHistory"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRankHistory_effectiveDate_idx" ON "EmployeeRankHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "EmployeeRankHistory_previousRankId_idx" ON "EmployeeRankHistory"("previousRankId");

-- CreateIndex
CREATE INDEX "EmployeeRankHistory_newRankId_idx" ON "EmployeeRankHistory"("newRankId");

-- CreateIndex
CREATE INDEX "EmployeeRankHistory_movementType_idx" ON "EmployeeRankHistory"("movementType");

-- CreateIndex
CREATE INDEX "LeaveType_code_idx" ON "LeaveType"("code");

-- CreateIndex
CREATE INDEX "LeaveType_companyId_idx" ON "LeaveType"("companyId");

-- CreateIndex
CREATE INDEX "LeaveType_isActive_idx" ON "LeaveType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_companyId_code_key" ON "LeaveType"("companyId", "code");

-- CreateIndex
CREATE INDEX "LeavePolicy_leaveTypeId_idx" ON "LeavePolicy"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeavePolicy_employmentStatusId_idx" ON "LeavePolicy"("employmentStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "LeavePolicy_leaveTypeId_employmentStatusId_effectiveFrom_key" ON "LeavePolicy"("leaveTypeId", "employmentStatusId", "effectiveFrom");

-- CreateIndex
CREATE INDEX "LeaveBalance_employeeId_idx" ON "LeaveBalance"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveBalance_leaveTypeId_idx" ON "LeaveBalance"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveBalance_year_idx" ON "LeaveBalance"("year");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveBalance_employeeId_leaveTypeId_year_key" ON "LeaveBalance"("employeeId", "leaveTypeId", "year");

-- CreateIndex
CREATE INDEX "LeaveBalanceTransaction_leaveBalanceId_idx" ON "LeaveBalanceTransaction"("leaveBalanceId");

-- CreateIndex
CREATE INDEX "LeaveBalanceTransaction_transactionType_idx" ON "LeaveBalanceTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "LeaveBalanceTransaction_createdAt_idx" ON "LeaveBalanceTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_requestNumber_key" ON "LeaveRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_idx" ON "LeaveRequest"("employeeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_statusCode_idx" ON "LeaveRequest"("statusCode");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_endDate_idx" ON "LeaveRequest"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_requestNumber_idx" ON "LeaveRequest"("requestNumber");

-- CreateIndex
CREATE INDEX "LeaveRequest_supervisorApproverId_idx" ON "LeaveRequest"("supervisorApproverId");

-- CreateIndex
CREATE INDEX "LeaveRequest_hrApproverId_idx" ON "LeaveRequest"("hrApproverId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeId_statusCode_idx" ON "LeaveRequest"("employeeId", "statusCode");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveTypeId_statusCode_idx" ON "LeaveRequest"("leaveTypeId", "statusCode");

-- CreateIndex
CREATE INDEX "LeaveRequestAttachment_leaveRequestId_idx" ON "LeaveRequestAttachment"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LoanType_code_idx" ON "LoanType"("code");

-- CreateIndex
CREATE INDEX "LoanType_companyId_idx" ON "LoanType"("companyId");

-- CreateIndex
CREATE INDEX "LoanType_categoryCode_idx" ON "LoanType"("categoryCode");

-- CreateIndex
CREATE UNIQUE INDEX "LoanType_companyId_code_key" ON "LoanType"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Loan_loanNumber_key" ON "Loan"("loanNumber");

-- CreateIndex
CREATE INDEX "Loan_employeeId_idx" ON "Loan"("employeeId");

-- CreateIndex
CREATE INDEX "Loan_loanTypeId_idx" ON "Loan"("loanTypeId");

-- CreateIndex
CREATE INDEX "Loan_loanNumber_idx" ON "Loan"("loanNumber");

-- CreateIndex
CREATE INDEX "Loan_statusCode_idx" ON "Loan"("statusCode");

-- CreateIndex
CREATE INDEX "Loan_applicationStatusCode_idx" ON "Loan"("applicationStatusCode");

-- CreateIndex
CREATE INDEX "LoanAmortization_loanId_idx" ON "LoanAmortization"("loanId");

-- CreateIndex
CREATE INDEX "LoanAmortization_dueDate_idx" ON "LoanAmortization"("dueDate");

-- CreateIndex
CREATE INDEX "LoanAmortization_isPaid_idx" ON "LoanAmortization"("isPaid");

-- CreateIndex
CREATE UNIQUE INDEX "LoanAmortization_loanId_periodNumber_key" ON "LoanAmortization"("loanId", "periodNumber");

-- CreateIndex
CREATE INDEX "LoanPayment_loanId_idx" ON "LoanPayment"("loanId");

-- CreateIndex
CREATE INDEX "LoanPayment_paymentDate_idx" ON "LoanPayment"("paymentDate");

-- CreateIndex
CREATE INDEX "LoanPayment_payrollRunId_idx" ON "LoanPayment"("payrollRunId");

-- CreateIndex
CREATE INDEX "LoanDocument_loanId_idx" ON "LoanDocument"("loanId");

-- CreateIndex
CREATE INDEX "RecurringDeduction_employeeId_idx" ON "RecurringDeduction"("employeeId");

-- CreateIndex
CREATE INDEX "RecurringDeduction_deductionTypeCode_idx" ON "RecurringDeduction"("deductionTypeCode");

-- CreateIndex
CREATE INDEX "RecurringDeduction_statusCode_idx" ON "RecurringDeduction"("statusCode");

-- CreateIndex
CREATE INDEX "RecurringDeduction_effectiveFrom_idx" ON "RecurringDeduction"("effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeMedicalRecord_employeeId_examYear_idx" ON "EmployeeMedicalRecord"("employeeId", "examYear");

-- CreateIndex
CREATE INDEX "EmployeeMedicalRecord_examYear_idx" ON "EmployeeMedicalRecord"("examYear");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeMedicalRecord_employeeId_examYear_key" ON "EmployeeMedicalRecord"("employeeId", "examYear");

-- CreateIndex
CREATE INDEX "EmployeeMedicalAttachment_medicalRecordId_idx" ON "EmployeeMedicalAttachment"("medicalRecordId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_documentTypeId_idx" ON "EmployeeDocument"("documentTypeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_expiryDate_idx" ON "EmployeeDocument"("expiryDate");

-- CreateIndex
CREATE INDEX "EmployeeDocument_isActive_idx" ON "EmployeeDocument"("isActive");

-- CreateIndex
CREATE INDEX "Department_code_idx" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_companyId_idx" ON "Department"("companyId");

-- CreateIndex
CREATE INDEX "Department_parentId_idx" ON "Department"("parentId");

-- CreateIndex
CREATE INDEX "Department_managerId_idx" ON "Department"("managerId");

-- CreateIndex
CREATE INDEX "Department_isActive_idx" ON "Department"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Department_companyId_code_key" ON "Department"("companyId", "code");

-- CreateIndex
CREATE INDEX "Position_code_idx" ON "Position"("code");

-- CreateIndex
CREATE INDEX "Position_companyId_idx" ON "Position"("companyId");

-- CreateIndex
CREATE INDEX "Position_isActive_idx" ON "Position"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Position_companyId_code_key" ON "Position"("companyId", "code");

-- CreateIndex
CREATE INDEX "Branch_code_idx" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE INDEX "Branch_managerId_idx" ON "Branch"("managerId");

-- CreateIndex
CREATE INDEX "Branch_isActive_idx" ON "Branch"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_code_key" ON "Branch"("companyId", "code");

-- CreateIndex
CREATE INDEX "Division_code_idx" ON "Division"("code");

-- CreateIndex
CREATE INDEX "Division_companyId_idx" ON "Division"("companyId");

-- CreateIndex
CREATE INDEX "Division_parentId_idx" ON "Division"("parentId");

-- CreateIndex
CREATE INDEX "Division_headId_idx" ON "Division"("headId");

-- CreateIndex
CREATE INDEX "Division_isActive_idx" ON "Division"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Division_companyId_code_key" ON "Division"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentStatus_code_key" ON "EmploymentStatus"("code");

-- CreateIndex
CREATE INDEX "EmploymentStatus_code_idx" ON "EmploymentStatus"("code");

-- CreateIndex
CREATE INDEX "EmploymentStatus_isActive_idx" ON "EmploymentStatus"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentType_code_key" ON "EmploymentType"("code");

-- CreateIndex
CREATE INDEX "EmploymentType_code_idx" ON "EmploymentType"("code");

-- CreateIndex
CREATE INDEX "EmploymentType_isActive_idx" ON "EmploymentType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "EmploymentClass_code_key" ON "EmploymentClass"("code");

-- CreateIndex
CREATE INDEX "EmploymentClass_code_idx" ON "EmploymentClass"("code");

-- CreateIndex
CREATE INDEX "EmploymentClass_isActive_idx" ON "EmploymentClass"("isActive");

-- CreateIndex
CREATE INDEX "Rank_code_idx" ON "Rank"("code");

-- CreateIndex
CREATE INDEX "Rank_companyId_idx" ON "Rank"("companyId");

-- CreateIndex
CREATE INDEX "Rank_level_idx" ON "Rank"("level");

-- CreateIndex
CREATE INDEX "Rank_category_idx" ON "Rank"("category");

-- CreateIndex
CREATE INDEX "Rank_parentId_idx" ON "Rank"("parentId");

-- CreateIndex
CREATE INDEX "Rank_isActive_idx" ON "Rank"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Rank_companyId_code_key" ON "Rank"("companyId", "code");

-- CreateIndex
CREATE INDEX "PayPeriodPattern_code_idx" ON "PayPeriodPattern"("code");

-- CreateIndex
CREATE INDEX "PayPeriodPattern_companyId_idx" ON "PayPeriodPattern"("companyId");

-- CreateIndex
CREATE INDEX "PayPeriodPattern_payFrequencyCode_idx" ON "PayPeriodPattern"("payFrequencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "PayPeriodPattern_companyId_code_key" ON "PayPeriodPattern"("companyId", "code");

-- CreateIndex
CREATE INDEX "PayPeriod_year_periodNumber_idx" ON "PayPeriod"("year", "periodNumber");

-- CreateIndex
CREATE INDEX "PayPeriod_cutoffStartDate_cutoffEndDate_idx" ON "PayPeriod"("cutoffStartDate", "cutoffEndDate");

-- CreateIndex
CREATE INDEX "PayPeriod_statusCode_idx" ON "PayPeriod"("statusCode");

-- CreateIndex
CREATE INDEX "PayPeriod_cutoffStartDate_cutoffEndDate_statusCode_idx" ON "PayPeriod"("cutoffStartDate", "cutoffEndDate", "statusCode");

-- CreateIndex
CREATE UNIQUE INDEX "PayPeriod_patternId_year_periodNumber_key" ON "PayPeriod"("patternId", "year", "periodNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_runNumber_key" ON "PayrollRun"("runNumber");

-- CreateIndex
CREATE INDEX "PayrollRun_payPeriodId_idx" ON "PayrollRun"("payPeriodId");

-- CreateIndex
CREATE INDEX "PayrollRun_runNumber_idx" ON "PayrollRun"("runNumber");

-- CreateIndex
CREATE INDEX "PayrollRun_statusCode_idx" ON "PayrollRun"("statusCode");

-- CreateIndex
CREATE INDEX "PayrollRun_runTypeCode_idx" ON "PayrollRun"("runTypeCode");

-- CreateIndex
CREATE INDEX "PayrollRun_currentStepNumber_idx" ON "PayrollRun"("currentStepNumber");

-- CreateIndex
CREATE INDEX "PayrollRun_isPostedToGL_idx" ON "PayrollRun"("isPostedToGL");

-- CreateIndex
CREATE INDEX "PayrollProcessStep_payrollRunId_idx" ON "PayrollProcessStep"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollProcessStep_stepNumber_idx" ON "PayrollProcessStep"("stepNumber");

-- CreateIndex
CREATE INDEX "PayrollProcessStep_status_idx" ON "PayrollProcessStep"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProcessStep_payrollRunId_stepNumber_key" ON "PayrollProcessStep"("payrollRunId", "stepNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payslipNumber_key" ON "Payslip"("payslipNumber");

-- CreateIndex
CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip"("payrollRunId");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE INDEX "Payslip_payslipNumber_idx" ON "Payslip"("payslipNumber");

-- CreateIndex
CREATE INDEX "Payslip_payrollRunId_employeeId_idx" ON "Payslip"("payrollRunId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollRunId_employeeId_key" ON "Payslip"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayslipEarning_payslipId_idx" ON "PayslipEarning"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipEarning_earningTypeId_idx" ON "PayslipEarning"("earningTypeId");

-- CreateIndex
CREATE INDEX "PayslipDeduction_payslipId_idx" ON "PayslipDeduction"("payslipId");

-- CreateIndex
CREATE INDEX "PayslipDeduction_deductionTypeId_idx" ON "PayslipDeduction"("deductionTypeId");

-- CreateIndex
CREATE INDEX "SeparationRequest_employeeId_idx" ON "SeparationRequest"("employeeId");

-- CreateIndex
CREATE INDEX "SeparationRequest_status_idx" ON "SeparationRequest"("status");

-- CreateIndex
CREATE INDEX "SeparationRequest_lastWorkingDay_idx" ON "SeparationRequest"("lastWorkingDay");

-- CreateIndex
CREATE INDEX "SeparationRequest_separationTypeCode_idx" ON "SeparationRequest"("separationTypeCode");

-- CreateIndex
CREATE INDEX "SeparationRequest_createdById_idx" ON "SeparationRequest"("createdById");

-- CreateIndex
CREATE INDEX "SeparationRequest_approvedById_idx" ON "SeparationRequest"("approvedById");

-- CreateIndex
CREATE INDEX "SeparationRequest_rejectedById_idx" ON "SeparationRequest"("rejectedById");

-- CreateIndex
CREATE INDEX "SeparationRequest_cancelledById_idx" ON "SeparationRequest"("cancelledById");

-- CreateIndex
CREATE INDEX "SeparationRequest_createdAt_idx" ON "SeparationRequest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FinalPayCalculation_separationRequestId_key" ON "FinalPayCalculation"("separationRequestId");

-- CreateIndex
CREATE INDEX "FinalPayCalculation_separationRequestId_idx" ON "FinalPayCalculation"("separationRequestId");

-- CreateIndex
CREATE INDEX "FinalPayCalculation_calculatedBy_idx" ON "FinalPayCalculation"("calculatedBy");

-- CreateIndex
CREATE INDEX "FinalPayCalculation_approvedBy_idx" ON "FinalPayCalculation"("approvedBy");

-- CreateIndex
CREATE INDEX "SeparationAuditLog_separationRequestId_idx" ON "SeparationAuditLog"("separationRequestId");

-- CreateIndex
CREATE INDEX "SeparationAuditLog_performedBy_idx" ON "SeparationAuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "SeparationAuditLog_performedAt_idx" ON "SeparationAuditLog"("performedAt");

-- CreateIndex
CREATE INDEX "SeparationAuditLog_action_idx" ON "SeparationAuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_selectedCompanyId_idx" ON "User"("selectedCompanyId");

-- CreateIndex
CREATE INDEX "AuditLog_tableName_recordId_idx" ON "AuditLog"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "AccountCategory" ADD CONSTRAINT "AccountCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCategory" ADD CONSTRAINT "AccountCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountCategory" ADD CONSTRAINT "AccountCategory_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_accountCategoryId_fkey" FOREIGN KEY ("accountCategoryId") REFERENCES "AccountCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GLAccount" ADD CONSTRAINT "GLAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkSchedule" ADD CONSTRAINT "WorkSchedule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricDevice" ADD CONSTRAINT "BiometricDevice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricSyncLog" ADD CONSTRAINT "BiometricSyncLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "BiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTimeRecord" ADD CONSTRAINT "DailyTimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_supervisorApproverId_fkey" FOREIGN KEY ("supervisorApproverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_hrApproverId_fkey" FOREIGN KEY ("hrApproverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyGroup" ADD CONSTRAINT "CompanyGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyGroup" ADD CONSTRAINT "CompanyGroup_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_companyGroupId_fkey" FOREIGN KEY ("companyGroupId") REFERENCES "CompanyGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentCompanyId_fkey" FOREIGN KEY ("parentCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyAddress" ADD CONSTRAINT "CompanyAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyContact" ADD CONSTRAINT "CompanyContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyEmail" ADD CONSTRAINT "CompanyEmail_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyAccess" ADD CONSTRAINT "UserCompanyAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCompanyAccess" ADD CONSTRAINT "UserCompanyAccess_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningType" ADD CONSTRAINT "EarningType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningType" ADD CONSTRAINT "EarningType_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionType" ADD CONSTRAINT "DeductionType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionType" ADD CONSTRAINT "DeductionType_liabilityAccountId_fkey" FOREIGN KEY ("liabilityAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeductionType" ADD CONSTRAINT "DeductionType_expenseAccountId_fkey" FOREIGN KEY ("expenseAccountId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalary" ADD CONSTRAINT "EmployeeSalary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEarning" ADD CONSTRAINT "EmployeeEarning_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEarning" ADD CONSTRAINT "EmployeeEarning_earningTypeId_fkey" FOREIGN KEY ("earningTypeId") REFERENCES "EarningType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeYTDContribution" ADD CONSTRAINT "EmployeeYTDContribution_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemConfig" ADD CONSTRAINT "SystemConfig_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessToken" ADD CONSTRAINT "AccessToken_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryRecord" ADD CONSTRAINT "EmailDeliveryRecord_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employmentStatusId_fkey" FOREIGN KEY ("employmentStatusId") REFERENCES "EmploymentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employmentClassId_fkey" FOREIGN KEY ("employmentClassId") REFERENCES "EmploymentClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_employmentTypeId_fkey" FOREIGN KEY ("employmentTypeId") REFERENCES "EmploymentType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_reportingManagerId_fkey" FOREIGN KEY ("reportingManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_dottedLineManagerId_fkey" FOREIGN KEY ("dottedLineManagerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_hrBusinessPartnerId_fkey" FOREIGN KEY ("hrBusinessPartnerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "WorkSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_payPeriodPatternId_fkey" FOREIGN KEY ("payPeriodPatternId") REFERENCES "PayPeriodPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAddress" ADD CONSTRAINT "EmployeeAddress_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeContact" ADD CONSTRAINT "EmployeeContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEmail" ADD CONSTRAINT "EmployeeEmail_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSocialMedia" ADD CONSTRAINT "EmployeeSocialMedia_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeGovernmentId" ADD CONSTRAINT "EmployeeGovernmentId_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBank" ADD CONSTRAINT "EmployeeBank_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDependent" ADD CONSTRAINT "EmployeeDependent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEmergencyContact" ADD CONSTRAINT "EmployeeEmergencyContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBeneficiary" ADD CONSTRAINT "EmployeeBeneficiary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEducation" ADD CONSTRAINT "EmployeeEducation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLicense" ADD CONSTRAINT "EmployeeLicense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCertification" ADD CONSTRAINT "EmployeeCertification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeTraining" ADD CONSTRAINT "EmployeeTraining_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSkill" ADD CONSTRAINT "EmployeeSkill_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePreviousEmployment" ADD CONSTRAINT "EmployeePreviousEmployment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_previousStatusId_fkey" FOREIGN KEY ("previousStatusId") REFERENCES "EmploymentStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_newStatusId_fkey" FOREIGN KEY ("newStatusId") REFERENCES "EmploymentStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_previousPositionId_fkey" FOREIGN KEY ("previousPositionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_newPositionId_fkey" FOREIGN KEY ("newPositionId") REFERENCES "Position"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_previousDepartmentId_fkey" FOREIGN KEY ("previousDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_newDepartmentId_fkey" FOREIGN KEY ("newDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_previousBranchId_fkey" FOREIGN KEY ("previousBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_newBranchId_fkey" FOREIGN KEY ("newBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeSalaryHistory" ADD CONSTRAINT "EmployeeSalaryHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeScheduleHistory" ADD CONSTRAINT "EmployeeScheduleHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRankHistory" ADD CONSTRAINT "EmployeeRankHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRankHistory" ADD CONSTRAINT "EmployeeRankHistory_previousRankId_fkey" FOREIGN KEY ("previousRankId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRankHistory" ADD CONSTRAINT "EmployeeRankHistory_newRankId_fkey" FOREIGN KEY ("newRankId") REFERENCES "Rank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_employmentStatusId_fkey" FOREIGN KEY ("employmentStatusId") REFERENCES "EmploymentStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveBalanceTransaction" ADD CONSTRAINT "LeaveBalanceTransaction_leaveBalanceId_fkey" FOREIGN KEY ("leaveBalanceId") REFERENCES "LeaveBalance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_supervisorApproverId_fkey" FOREIGN KEY ("supervisorApproverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_hrApproverId_fkey" FOREIGN KEY ("hrApproverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequestAttachment" ADD CONSTRAINT "LeaveRequestAttachment_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanType" ADD CONSTRAINT "LoanType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_loanTypeId_fkey" FOREIGN KEY ("loanTypeId") REFERENCES "LoanType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_coMakerId_fkey" FOREIGN KEY ("coMakerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanAmortization" ADD CONSTRAINT "LoanAmortization_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanPayment" ADD CONSTRAINT "LoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanDocument" ADD CONSTRAINT "LoanDocument_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDeduction" ADD CONSTRAINT "RecurringDeduction_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringDeduction" ADD CONSTRAINT "RecurringDeduction_deductionTypeId_fkey" FOREIGN KEY ("deductionTypeId") REFERENCES "DeductionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMedicalRecord" ADD CONSTRAINT "EmployeeMedicalRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeMedicalAttachment" ADD CONSTRAINT "EmployeeMedicalAttachment_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "EmployeeMedicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_profitCenterId_fkey" FOREIGN KEY ("profitCenterId") REFERENCES "GLAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Division"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Division" ADD CONSTRAINT "Division_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentStatus" ADD CONSTRAINT "EmploymentStatus_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentStatus" ADD CONSTRAINT "EmploymentStatus_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentType" ADD CONSTRAINT "EmploymentType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentType" ADD CONSTRAINT "EmploymentType_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentClass" ADD CONSTRAINT "EmploymentClass_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentClass" ADD CONSTRAINT "EmploymentClass_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Rank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rank" ADD CONSTRAINT "Rank_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPeriodPattern" ADD CONSTRAINT "PayPeriodPattern_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPeriod" ADD CONSTRAINT "PayPeriod_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "PayPeriodPattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayPeriod" ADD CONSTRAINT "PayPeriod_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_payPeriodId_fkey" FOREIGN KEY ("payPeriodId") REFERENCES "PayPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_postedToGLById_fkey" FOREIGN KEY ("postedToGLById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollProcessStep" ADD CONSTRAINT "PayrollProcessStep_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipEarning" ADD CONSTRAINT "PayslipEarning_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipEarning" ADD CONSTRAINT "PayslipEarning_earningTypeId_fkey" FOREIGN KEY ("earningTypeId") REFERENCES "EarningType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipDeduction" ADD CONSTRAINT "PayslipDeduction_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipDeduction" ADD CONSTRAINT "PayslipDeduction_deductionTypeId_fkey" FOREIGN KEY ("deductionTypeId") REFERENCES "DeductionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationRequest" ADD CONSTRAINT "SeparationRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationRequest" ADD CONSTRAINT "SeparationRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationRequest" ADD CONSTRAINT "SeparationRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationRequest" ADD CONSTRAINT "SeparationRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationRequest" ADD CONSTRAINT "SeparationRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPayCalculation" ADD CONSTRAINT "FinalPayCalculation_separationRequestId_fkey" FOREIGN KEY ("separationRequestId") REFERENCES "SeparationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPayCalculation" ADD CONSTRAINT "FinalPayCalculation_calculatedBy_fkey" FOREIGN KEY ("calculatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinalPayCalculation" ADD CONSTRAINT "FinalPayCalculation_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationAuditLog" ADD CONSTRAINT "SeparationAuditLog_separationRequestId_fkey" FOREIGN KEY ("separationRequestId") REFERENCES "SeparationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeparationAuditLog" ADD CONSTRAINT "SeparationAuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_selectedCompanyId_fkey" FOREIGN KEY ("selectedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

