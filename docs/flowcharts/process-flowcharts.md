# Timekeeping, Payroll, Leave, and Overtime Process Flows

This document contains plain black-and-white Mermaid process flowcharts aligned with the current project behavior in `AGENTS.md` and `README.md`.

Swimlane variants are also available:

- `docs/flowcharts/timekeeping-payroll-swimlane-flow.mmd`
- `docs/flowcharts/leave-overtime-approval-swimlane-flow.mmd`

## 1) Timekeeping and Payroll Process

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "background": "#ffffff",
    "primaryColor": "#ffffff",
    "secondaryColor": "#ffffff",
    "tertiaryColor": "#ffffff",
    "primaryTextColor": "#000000",
    "secondaryTextColor": "#000000",
    "tertiaryTextColor": "#000000",
    "lineColor": "#000000",
    "primaryBorderColor": "#000000",
    "fontFamily": "Arial"
  }
}}%%
flowchart TD
  A[Capture Attendance Data\nBiometric Sync and Manual DTR Corrections]
  B[Validate Timekeeping Completeness\nPresence, Absence, Tardiness, Undertime, OT]
  C{Timekeeping Ready?}
  D[Resolve Attendance Issues\nCorrections and Revalidation]
  E[Create Payroll Run\nRegular or Bonus Type]
  F[Validate Payroll Run\nEmployee Readiness and Policy Checks]
  G{Validation Passed?}
  H[Fix Validation Findings\nThen Re-run Validation]
  I[Calculate Payroll]
  J[Compute Earnings\nBasic Pay, Leave Pay, OT, Night Differential]
  K[Compute Deductions\nStatutory, Recurring, Loans, Attendance-Based]
  L[Compute Net Pay and Persist Payslip Line Items]
  M[Review Payroll Register and Employee Results]
  N{Adjustments Needed?}
  O[Apply Manual Adjustments\nEarnings or Deductions]
  P[Generate Payslips\nPreview, Download, Email]
  Q[Close Payroll Run and Lock Pay Period]
  R[Generate Statutory Reports\nSSS, PhilHealth, Pag-IBIG, DOLE, BIR]
  S[End Payroll Cycle]

  A --> B --> C
  C -- No --> D --> B
  C -- Yes --> E --> F --> G
  G -- No --> H --> F
  G -- Yes --> I --> J --> K --> L --> M --> N
  N -- Yes --> O --> M
  N -- No --> P --> Q --> R --> S
```

## 2) Leave and Overtime Submission and Approval Process

```mermaid
%%{init: {
  "theme": "base",
  "themeVariables": {
    "background": "#ffffff",
    "primaryColor": "#ffffff",
    "secondaryColor": "#ffffff",
    "tertiaryColor": "#ffffff",
    "primaryTextColor": "#000000",
    "secondaryTextColor": "#000000",
    "tertiaryTextColor": "#000000",
    "lineColor": "#000000",
    "primaryBorderColor": "#000000",
    "fontFamily": "Arial"
  }
}}%%
flowchart TD
  A[Employee Submits Request\nLeave or Overtime]
  B[Validate Input, Company Scope, and Access]
  C{Request Type}

  D[Leave Request\nReserve Leave Credits on Submit]
  E[Overtime Request\nValidate Minimum Duration and Eligibility]

  F[Set Request Status to Pending Supervisor Approval]
  G[Supervisor Reviews Request]
  H{Supervisor Decision}
  I[Supervisor Rejects\nStatus Rejected and Notify Employee]
  J[Supervisor Approves\nStatus Supervisor Approved]

  K[Route to HR Final Approval Queue]
  L[HR Reviews with Required Remarks]
  M{HR Decision}

  N[HR Rejects\nStatus Rejected]
  O[HR Approves\nStatus Approved]

  P{Approved Request Type}
  Q[Leave Finalization\nConsume Reserved Credits and Update Leave Ledger]
  R[Overtime Finalization\nApply OT Pay or Convert to CTO Credits]

  S[If Rejected Leave\nRelease Reserved Leave Credits]
  T[Write Audit Log and Notify Employee]
  U[End]

  A --> B --> C
  C -- Leave --> D --> F
  C -- Overtime --> E --> F

  F --> G --> H
  H -- Reject --> I --> S --> T --> U
  H -- Approve --> J --> K --> L --> M

  M -- Reject --> N --> S --> T --> U
  M -- Approve --> O --> P
  P -- Leave --> Q --> T --> U
  P -- Overtime --> R --> T --> U
```
