# Hybrid Session Management (Option 3)

## Overview

This application implements a **hybrid session management approach** that combines JWT authentication with database session tracking. This gives you the benefits of both worlds:

- ✅ Works with NextAuth Credentials provider
- ✅ Precise session expiration control (60 seconds)
- ✅ Force logout capability from database
- ✅ Session monitoring and tracking
- ✅ No OAuth provider required

## Architecture

### 1. JWT Authentication (Primary)
- NextAuth uses JWT strategy for authentication
- JWT tokens contain user credentials and session metadata
- Tokens are signed and secure

### 2. Database Session Tracking (Secondary)
- Each login creates a session record in the database
- Sessions have a 60-second expiration time
- Sessions are refreshed on user activity
- Sessions can be forcefully deleted for instant logout

## How It Works

### Login Flow
```
1. User submits credentials
2. NextAuth validates credentials (auth.config.ts)
3. Check if user account is active
4. Create JWT token with user data
5. Generate unique session token (UUID)
6. Store session in database with 60s expiration
7. Add session token to JWT
8. Update user's lastLoginAt timestamp
9. Log login event to audit logs
```

### Session Validation Flow
```
1. Client-side SessionMonitor checks every 30 seconds
2. Calls /api/auth/validate-session endpoint
3. Server checks if database session exists and is not expired
4. If valid: refresh session expiration by 60 seconds
5. If invalid: force logout and redirect to sign-in
```

### Logout Flow
```
1. User clicks logout
2. Delete all database sessions for user
3. NextAuth signs out (clears JWT)
4. Log logout event to audit logs
5. Redirect to sign-in page
```

## Key Components

### 1. Authentication Configuration

**auth.ts**
- Configures NextAuth with JWT strategy
- Implements signIn, jwt, and session callbacks
- Creates database session on login
- Updates user login timestamp

**auth.config.ts**
- Defines Credentials provider
- Validates username/password
- Checks if user account is active
- Returns user data for JWT

### 2. Session Management Actions

**lib/actions/session-management-actions.ts**
- `createSessionRecord()` - Create new session with 60s expiration
- `validateSession()` - Check if session is still valid
- `refreshSession()` - Extend session by 60 seconds
- `deleteUserSessions()` - Force logout by deleting sessions
- `cleanupExpiredSessions()` - Remove old sessions (cron job)
- `getUserActiveSessions()` - Get user's active sessions
- `getAllActiveSessions()` - Admin view of all sessions

### 3. Client-Side Monitoring

**components/auth/session-monitor.tsx**
- Runs in the background on all dashboard pages
- Checks session validity every 30 seconds
- Automatically logs out if session expired
- Shows error message on forced logout

### 4. API Endpoint

**app/api/auth/validate-session/route.ts**
- GET endpoint for session validation
- Returns 401 if session invalid
- Refreshes session on successful validation
- Handles errors gracefully

### 5. Database Schema

**prisma/schema.prisma**
```prisma
model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

## Configuration

### Session Expiration Time
Default: 60 seconds

To change, modify in `lib/actions/session-management-actions.ts`:
```typescript
const expiresAt = new Date();
expiresAt.setSeconds(expiresAt.getSeconds() + 60); // Change 60 to desired seconds
```

### Client Check Interval
Default: 30 seconds

To change, modify in `app/(dashboard)/layout.tsx`:
```typescript
<SessionMonitor checkInterval={30000} /> // Change 30000 to desired milliseconds
```

## Admin Features

### View Active Sessions
```typescript
import { getAllActiveSessions } from "@/lib/actions/session-management-actions";

const sessions = await getAllActiveSessions(businessUnitId);
```

### Force Logout User
```typescript
import { deleteUserSessions } from "@/lib/actions/session-management-actions";

await deleteUserSessions(userId);
```

### Cleanup Expired Sessions
```typescript
import { cleanupExpiredSessions } from "@/lib/actions/session-management-actions";

const result = await cleanupExpiredSessions();
console.log(`Deleted ${result.deletedCount} expired sessions`);
```

## Security Considerations

1. **Session Tokens are Unique**: Each login generates a new UUID
2. **Cascade Delete**: Sessions are deleted when user is deleted
3. **Automatic Cleanup**: Expired sessions should be cleaned periodically
4. **Inactive User Check**: Prevents deactivated users from logging in
5. **Audit Logging**: All login/logout events are tracked

## Troubleshooting

### Sessions Not Expiring
- Check if SessionMonitor is mounted in layout
- Verify API endpoint is accessible
- Check browser console for errors

### Users Getting Logged Out Too Quickly
- Increase session expiration time
- Decrease client check interval
- Verify refreshSession is working

### Database Sessions Piling Up
- Set up cron job to run cleanupExpiredSessions()
- Check for errors in session creation

## Type Safety

All components are fully typed with TypeScript:
- No `any` types used
- Proper NextAuth type extensions in `next-auth.d.ts`
- Type-safe session callbacks
- Strict null checks enabled

## Future Enhancements

- [ ] Add session device/IP tracking
- [ ] Implement "Remember Me" functionality
- [ ] Add session activity logs
- [ ] Create admin dashboard for session management
- [ ] Add WebSocket for real-time session invalidation
