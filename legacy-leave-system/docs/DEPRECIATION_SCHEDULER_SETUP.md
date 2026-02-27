# Depreciation Scheduler Setup for Self-Hosted Deployments

This guide explains how to set up automatic depreciation schedule execution for self-hosted deployments (Coolify, Docker, VPS, etc.).

## 🚀 Quick Setup

### 1. Environment Variables

Add these to your environment configuration in Coolify:

```bash
# Required for cron security
CRON_SECRET=your-super-secret-key-here-make-it-long-and-random

# Your existing variables
DATABASE_URL="your-database-url"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="https://yourdomain.com"
```

### 2. System Cron Job Setup

#### Option A: Coolify Server Cron (Recommended)

1. SSH into your Coolify server
2. Edit the crontab: `sudo crontab -e`
3. Add this line to run daily at 11:59 PM:

```bash
# Depreciation Schedules - Run daily at 11:59 PM
59 23 * * * curl -X POST -H "Authorization: Bearer your-super-secret-key-here-make-it-long-and-random" -H "Content-Type: application/json" https://yourdomain.com/api/cron/depreciation-schedules
```

#### Option B: External Cron Service

Use services like:
- **cron-job.org** (free)
- **EasyCron** 
- **Cronhub**

Configure them to make a POST request to:
- **URL**: `https://yourdomain.com/api/cron/depreciation-schedules`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer your-super-secret-key-here`
  - `Content-Type: application/json`
- **Schedule**: `59 23 * * *` (daily at 11:59 PM)

#### Option C: Docker Container Cron

If using Docker, add this to your Dockerfile or docker-compose:

```dockerfile
# Install cron in your container
RUN apt-get update && apt-get install -y cron

# Add cron job
RUN echo "59 23 * * * curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" -H \"Content-Type: application/json\" \$NEXTAUTH_URL/api/cron/depreciation-schedules" | crontab -

# Start cron service
RUN service cron start
```

### 3. Testing the Setup

#### Manual Test via UI
1. Go to `/asset-management/depreciation/schedules`
2. Click the **"Run Now"** button (Admin only)
3. Check the execution results

#### Manual Test via API
```bash
curl -X POST \
  -H "Authorization: Bearer your-super-secret-key-here" \
  -H "Content-Type: application/json" \
  https://yourdomain.com/api/cron/depreciation-schedules
```

#### Check Logs
Monitor your application logs to see:
```
🕐 Checking for scheduled depreciation executions...
📋 Found X schedules to execute
🚀 Executing schedule: Monthly Depreciation
✅ Schedule Monthly Depreciation completed successfully
```

## 📋 How It Works

### Daily Execution Flow
1. **Cron Trigger**: System cron calls your API endpoint daily
2. **Schedule Check**: System finds active schedules that should run today
3. **Asset Processing**: For each schedule:
   - Filters assets by category rules
   - Calculates depreciation amounts
   - Updates asset book values
   - Creates depreciation records
4. **Execution Tracking**: Results stored in database for history

### Schedule Types
- **Monthly**: Runs on specified day each month (e.g., Day 30)
- **Quarterly**: Runs on specified day of quarter-end months (Mar, Jun, Sep, Dec)
- **Annually**: Runs on specified day in December

## 🔧 Troubleshooting

### Check if Cron is Working
```bash
# Test the endpoint manually
curl -X GET https://yourdomain.com/api/cron/depreciation-schedules

# Should return:
{
  "message": "Depreciation schedule cron endpoint is active",
  "timestamp": "2024-01-15T23:59:00.000Z"
}
```

### Common Issues

1. **401 Unauthorized**: Check your `CRON_SECRET` environment variable
2. **No schedules found**: Ensure schedules are marked as "Active"
3. **Assets not processed**: Check category filters and asset depreciation settings

### Monitoring

- **Execution History**: View in `/asset-management/depreciation/history`
- **Application Logs**: Monitor for cron execution messages
- **Database**: Check `depreciation_executions` table

## 🎯 Your Current Setup

Based on your "Monthly Depreciation" schedule:
- ✅ **Runs**: 30th of each month at 11:59 PM
- ✅ **Processes**: All active assets (no category filters)
- ✅ **Method**: Straight-line depreciation
- ✅ **Tracking**: Full execution history and audit trail

## 🔒 Security Notes

- Keep your `CRON_SECRET` secure and long (32+ characters)
- Use HTTPS for all cron requests
- Monitor execution logs for unauthorized access attempts
- Consider IP whitelisting if using external cron services

## 📞 Support

If you encounter issues:
1. Check application logs for error messages
2. Test the manual "Run Now" button first
3. Verify environment variables are set correctly
4. Ensure your cron job has proper permissions