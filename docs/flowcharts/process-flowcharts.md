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
  A[Collect and Finalize Attendance Inputs\nBiometric Data and Manual Corrections]
  B[Check Timekeeping Readiness\nAttendance, Leaves, Overtime, and Required Inputs]
  C{Timekeeping Ready?}
  D[Resolve Missing or Incorrect Records\nThen Recheck]
  E[Create Payroll Run for Selected Period and Employee Scope]
  F[Run Pre-Calculation Validation]
  G{Validation Passed?}
  H[Fix Validation Findings\nThen Validate Again]
  I[Proceed to Payroll Calculation]
  J[System Calculates Payroll Values]
  K{Calculation Successful?}
  L[Review Calculation Issue\nReturn to Validation or Recalculation]
  M[HR Reviews Payroll Register and Employee Results]
  N{Adjustments Needed?}
  O[Apply Approved Adjustments\nThen Recalculate]
  P[Generate Payslips]
  Q[Release or Send Payslips to Employees]
  R[Close Payroll Run]
  S{Regular Payroll Period?}
  T[Lock Pay Period]
  U[Keep Pay Period Open]
  V{Need to Reopen for Corrections?}
  W[Reopen Payroll Run and Return to Review]
  X[Generate Statutory Reports and Exports\nSSS, PhilHealth, Pag-IBIG, DOLE, BIR]
  Y[End Payroll Cycle]

  A --> B --> C
  C -- No --> D --> B
  C -- Yes --> E --> F --> G
  G -- No --> H --> F
  G -- Yes --> I --> J --> K
  K -- No --> L --> I
  K -- Yes --> M --> N
  N -- Yes --> O --> J
  N -- No --> P --> Q --> R --> S
  S -- Yes --> T --> V
  S -- No --> U --> V
  V -- Yes --> W --> M
  V -- No --> X --> Y
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
  A[Employee Submits Leave or Overtime Request]
  B[System Checks Request Details and Employee Eligibility]
  C[Route Request to Immediate Supervisor]
  D{Employee Updates Request Before Supervisor Action?}
  E[Employee Edits Request]
  F[Employee Withdraws Request]
  G[Supervisor Reviews Request]
  H{Supervisor Decision}
  I[Supervisor Rejects Request]
  J[Supervisor Approves and Routes to HR]
  K[HR Final Review]
  L{HR Decision}
  M[HR Rejects Request]
  N[HR Approves Request]
  O{Request Type}
  P[Leave: Apply Final Leave Balance Movement]
  Q[Overtime: Apply Final Overtime Outcome\nPayroll OT or CTO Based on Policy]
  R[Record Decision and Notify Employee]
  S[End]

  A --> B --> C --> D
  D -- Edit --> E --> B
  D -- Withdraw --> F --> R --> S
  D -- No --> G --> H
  H -- Reject --> I --> R --> S
  H -- Approve --> J --> K --> L
  L -- Reject --> M --> R --> S
  L -- Approve --> N --> O
  O -- Leave --> P --> R --> S
  O -- Overtime --> Q --> R --> S
```
