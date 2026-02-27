# Session Cleanup Setup

## The Problem

When users login, a session record is created in the database. When they:
- Force close the browser
- JWT expires (8 hours)
- Get logged out due to inactivity

The old session records **stay in the database** and accumulate over time.

## The Solution

Automatically delete expired sessions using a cron job.

## Setup Options

### Option 1: Vercel Cron Jobs (Recommended for Production)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Cron Jobs**
3. Click **Add Cron Job**
4. Configure:
   - **Path**: `/api/cron/cleanup-sessions`
   - **Schedule**: `0 * * * *` (every hour)
   - **Description**: Clean up expired sessions

5. Add environment variable (optional but recommended):
   - Key: `CRON_SECRET`
   - Value: Generate a random string (e.g., `openssl rand -base64 32`)

6. Save and deploy

### Option 2: External Cron Service (e.g., cron-job.org)

1. Go to [cron-job.org](https://cron-job.org) or similar service
2. Create a new cron job
3. URL: `https://your-domain.com/api/cron/cleanup-sessions`
4. Schedule: Every hour
5. Add header (if using CRON_SECRET):
   - Header: `Authorization`
   - Value: `Bearer your_secret_key`

### Option 3: Manual Cleanup (Development/Testing)

Call the endpoint manually:

```bash
# Without authentication
curl https://your-domain.com/api/cron/cleanup-sessions

# With authentication
curl -H "Authorization: Bearer your_secret_key" \
  https://your-domain.com/api/cron/cleanup-sessions
```

## Cron Schedule Examples

```
0 * * * *     - Every hour
*/30 * * * *  - Every 30 minutes
0 */6 * * *   - Every 6 hours
0 0 * * *     - Daily at midnight
0 2 * * *     - Daily at 2 AM
```

## What Gets Cleaned Up

The cron job deletes sessions where:
- `expires` < current time
- Session is no longer valid

Example:
```sql
DELETE FROM sessions 
WHERE expires < NOW();
```

## Automatic Cleanup on Logout

Sessions are also automatically deleted when users:
- Click "Sign Out" button
- Are force logged out by admin

This is handled in:
- `lib/actions/auth-actions.ts` → `signOutWithAudit()`
- `components/sidebar/nav-user.tsx` → `handleSignOut()`

## Monitoring

The cleanup endpoint returns:

```json
{
  "success": true,
  "message": "Cleaned up 42 expired sessions",
  "deletedCount": 42,
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

You can monitor this in:
- Vercel logs
- External cron service logs
- Your application monitoring tool

## Testing

Test the cleanup manually:

```bash
# 1. Login to create a session
# 2. Wait for session to expire (5 minutes)
# 3. Call cleanup endpoint
curl http://localhost:3000/api/cron/cleanup-sessions

# Expected response:
# {"success":true,"message":"Cleaned up 1 expired sessions","deletedCount":1}
```

## Security

The endpoint is protected by:
1. **Optional CRON_SECRET**: Set in environment variables
2. **Authorization header**: Must match `Bearer ${CRON_SECRET}`
3. **No sensitive data exposed**: Only returns count

If `CRON_SECRET` is not set, the endpoint is publicly accessible (fine for development).

## Recommended Schedule

For most applications:
- **Every hour** is sufficient
- Sessions expire after 5 minutes of inactivity
- Cleanup removes sessions older than 5 minutes

For high-traffic applications:
- **Every 30 minutes** to keep database lean
- Monitor database size and adjust as needed
