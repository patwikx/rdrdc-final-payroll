# Native Android Workspace

This folder contains the full native Employee Portal Android app scaffold (Kotlin + Jetpack Compose).

Current state:

- Migration planning is complete in `docs/native-android-migration-plan.md`.
- Capacitor remains active as temporary production shell.
- Native project shell is initialized and builds successfully (`:app:assembleDebug`).
- Auth/session/API foundation is wired:
  - DataStore-backed token session store
  - Retrofit + OkHttp API client
  - Compose auth screen + ViewModel + repository

## Structure

```text
native-android/
  build.gradle
  settings.gradle
  gradle.properties
  gradle/wrapper/*
  gradlew
  app/
    build.gradle
    src/main/AndroidManifest.xml
    src/main/java/com/rdhardware/employeeportal/
      EmployeePortalApp.kt
      MainActivity.kt
      EmployeePortalRoot.kt
      core/
        data/
        designsystem/
        domain/
        navigation/
        util/
      feature/
        auth/
        dashboard/
        leaves/
        overtime/
        payslips/
        profile/
        materialrequests/
          request/
          approvals/
          processing/
          posting/
```

## Build Commands

- Local command:
  - `JAVA_HOME=$HOME/.local/jdk/21 ANDROID_SDK_ROOT=$HOME/.local/android-sdk PATH=$HOME/.local/jdk/21/bin:$HOME/.local/android-sdk/platform-tools:$PATH ./gradlew :app:assembleDebug`
- Output APK:
  - `native-android/app/build/outputs/apk/debug/app-debug.apk`

## NPM Helper Scripts (repo root)

- `npm run -s native:android:build:debug`
- `npm run -s native:android:test:unit`

## Auth API Contract (initial)

- `POST /api/mobile/v1/auth/login`
- `POST /api/mobile/v1/auth/refresh`
- `GET /api/mobile/v1/auth/session`
- `POST /api/mobile/v1/auth/logout`
- `GET /api/mobile/v1/employee-portal/bootstrap`
- `GET /api/mobile/v1/employee-portal/leaves`
- `POST /api/mobile/v1/employee-portal/leaves`
- `PATCH /api/mobile/v1/employee-portal/leaves/{requestId}`
- `POST /api/mobile/v1/employee-portal/leaves/{requestId}/cancel`
- `GET /api/mobile/v1/employee-portal/overtime`
- `POST /api/mobile/v1/employee-portal/overtime`
- `PATCH /api/mobile/v1/employee-portal/overtime/{requestId}`
- `POST /api/mobile/v1/employee-portal/overtime/{requestId}/cancel`
- `GET /api/mobile/v1/employee-portal/payslips`
- `GET /api/mobile/v1/employee-portal/profile`
- `PUT /api/mobile/v1/employee-portal/profile`

Compatibility aliases also exist at `/api/mobile/auth/*` for transition.
Compatibility aliases also exist at `/api/mobile/employee-portal/*` for transition.

Base URL comes from `BuildConfig.EMPLOYEE_PORTAL_API_BASE_URL` (defaults to `https://hris.rdhardware.com`).

## Rules

- Do not remove Capacitor files until native parity + UAT sign-off.
- Keep feature behavior aligned with existing employee-portal domain rules.
- Keep authentication and tenant/company authorization strict by design.
