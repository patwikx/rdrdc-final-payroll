# Native Android Migration Plan

Last updated: 2026-02-18

## Goal

Build a fully native Android app for Employee Portal (Kotlin + Jetpack Compose) with feature parity to the current employee portal web experience, then phase out the Capacitor wrapper after native parity is accepted in UAT.

## Delivery Strategy

- Keep Capacitor app active during migration for business continuity.
- Build native app in parallel and release by phased feature enablement.
- Cut over users to native only after feature parity + stability targets are met.

## Target Scope (V1 Native)

- Authentication and session management.
- Employee dashboard.
- Leave requests + leave approvals.
- Overtime requests + overtime approvals.
- Payslip listing + payslip detail + PDF download.
- Profile read/update (contact, emergency, docs links).
- Material requests:
  - Request log/create/edit/detail
  - Approval queue/history/detail
  - Processing queue/detail/actions
  - Posting queue/detail/actions

## Non-Goals (V1)

- Rebuilding admin/settings modules inside mobile app.
- Offline-first workflows for complex approval transactions.
- Replacing backend domain logic currently in server actions.

## Architecture Decisions

- Language/UI:
  - Kotlin
  - Jetpack Compose + Material 3
- Pattern:
  - Clean-ish modular architecture (feature modules + shared core modules)
  - MVI-style UI state with ViewModel + `StateFlow`
- Networking:
  - Retrofit + OkHttp + Kotlinx Serialization (or Moshi, pick one and standardize)
  - Typed API layer separate from UI
- Persistence:
  - Room for cached read models
  - DataStore for secure app settings flags and lightweight preferences
- Background:
  - WorkManager for sync/retry jobs
- Quality:
  - Unit tests for domain/use-cases
  - Compose UI tests for critical screens
  - Crash reporting + analytics instrumentation

## Proposed Repository Layout

The native app should live in a dedicated folder at repo root:

```text
native-android/
  settings.gradle.kts
  build.gradle.kts
  gradle.properties
  gradle/wrapper/*
  app/
    build.gradle.kts
    src/main/
      AndroidManifest.xml
      java/com/rdhardware/employeeportal/
        App.kt
        MainActivity.kt
        core/
          designsystem/
          navigation/
          network/
          data/
          domain/
          util/
        feature/
          auth/
          dashboard/
          leaves/
          overtime/
          payslips/
          profile/
          material_requests/
            request/
            approvals/
            processing/
            posting/
      res/
```

## Backend/API Work Required

Current portal behavior depends heavily on server actions and server-rendered workflows. Native requires stable API endpoints.

Required backend tracks:

- Create mobile-auth compatible API flow (token/session strategy).
- Expose employee-portal domain endpoints currently hidden behind server actions.
- Ensure strict tenant/company access checks on every endpoint.
- Add endpoint-level pagination/sorting/filter contracts matching current portal behavior.
- Add API versioning and error contract consistency.

## Execution Phases

### Phase 0: API Contract and Technical Foundation (Week 1-2)

- Finalize mobile auth/session protocol.
- Enumerate all employee portal server actions and map to REST endpoints.
- Produce OpenAPI contract for mobile-consumed endpoints.
- Decide error schema, pagination schema, and date/time conventions.

### Phase 1: App Shell + Core Infrastructure (Week 2-4)

- Create native Android project under `native-android/`.
- Build app theme, typography, spacing tokens, and component primitives.
- Implement navigation graph and session gate.
- Add logging, crash reporting, and build flavors (dev/staging/prod).

### Phase 2: Core Employee Features (Week 4-8)

- Dashboard, profile, leaves, overtime, payslips.
- Build tablet-responsive Compose layouts (list/detail, adaptive panes).
- Add download/open behavior for payslip PDFs.

### Phase 3: Material Request Features (Week 8-12)

- Request list/create/edit/detail.
- Approval queue/history + decision flow.
- Processing + posting flows with action dialogs and safeguards.

### Phase 4: Hardening, UAT, and Rollout (Week 12-16)

- Regression testing against existing web behavior.
- Performance tuning and animation polish.
- Pilot release to limited employee group.
- Full rollout and post-rollout monitoring.

## Detailed Checklist

## Program Setup

- [ ] Assign owners: Android, backend API, QA.
- [ ] Define environments (dev/staging/prod) and release cadence.
- [ ] Finalize Play Console package name, signing, and CI secrets plan.

## API Readiness

- [ ] Publish OpenAPI spec for all employee portal mobile endpoints.
- [ ] Add auth refresh/token lifecycle endpoints.
- [ ] Add parity endpoints for leave/overtime/material-request actions.
- [ ] Add standardized error response model.
- [ ] Add pagination/filter contracts for queue/history screens.

## Native App Foundation

- [ ] Initialize `native-android` project with Compose + modular packages.
- [ ] Implement auth/session storage and automatic refresh handling.
- [ ] Implement shared error/loading/empty-state composables.
- [ ] Implement safe-area/system-bar handling to avoid status-bar overlap.
- [ ] Add network observability (request IDs, retry policy, timeout policy).

## Feature Buildout

- [ ] Dashboard + profile read/update.
- [ ] Leaves module (requests + approvals).
- [ ] Overtime module (requests + approvals).
- [ ] Payslips module (list/detail/download).
- [ ] Material request requester flow.
- [ ] Material request approvals flow.
- [ ] Material request processing + posting flow.

## Quality and Release

- [ ] Unit test suite for use-cases and validators.
- [ ] UI tests for critical employee flows.
- [ ] Internal QA checklist completed.
- [ ] UAT sign-off from operations.
- [ ] Production rollout plan and rollback plan documented.

## Cutover Plan (Capacitor Decommission)

- [ ] Confirm native parity checklist complete.
- [ ] Freeze Capacitor changes except urgent hotfixes.
- [ ] Release native as primary app channel.
- [ ] Monitor crash-free sessions and API error rates for 2 weeks.
- [ ] Remove Capacitor-specific files in a dedicated cleanup PR/commit.

## Risks and Mitigations

- API parity delay:
  - Mitigation: prioritize API track first; do not overbuild UI before contracts are stable.
- Behavior mismatch with existing server actions:
  - Mitigation: define domain acceptance tests against web behavior.
- Timeline expansion from scope creep:
  - Mitigation: lock V1 scope; defer non-critical enhancements to V1.1.

## Definition of Done (Native Cutover)

- All V1 scope features available in native app.
- Zero blocker defects in UAT.
- Crash-free rate and API error rates within agreed SLO.
- Operational sign-off from HR/payroll stakeholders.
