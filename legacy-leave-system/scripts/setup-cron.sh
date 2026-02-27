#!/bin/bash

# Depreciation Scheduler Cron Setup Script
# Usage: ./scripts/setup-cron.sh <your-domain> <cron-secret>

set -e

DOMAIN=${1:-"localhost:3000"}
CRON_SECRET=${2:-""}
PROTOCOL="https"

# Check if running on localhost
if [[ $DOMAIN == *"localhost"* ]]; then
    PROTOCOL="http"
fi

if [ -z "$CRON_SECRET" ]; then
    echo "❌ Error: CRON_SECRET is required"
    echo "Usage: $0 <domain> <cron-secret>"
    echo "Example: $0 yourdomain.com your-super-secret-key"
    exit 1
fi

echo "🚀 Setting up Depreciation Scheduler Cron Job"
echo "Domain: $DOMAIN"
echo "Protocol: $PROTOCOL"
echo ""

# Test the health endpoint first
echo "🔍 Testing health endpoint..."
HEALTH_URL="$PROTOCOL://$DOMAIN/api/health/depreciation"
if curl -s -f "$HEALTH_URL" > /dev/null; then
    echo "✅ Health endpoint is accessible"
else
    echo "❌ Health endpoint is not accessible at $HEALTH_URL"
    echo "Please ensure your application is running and accessible"
    exit 1
fi

# Test the cron endpoint
echo "🔍 Testing cron endpoint..."
CRON_URL="$PROTOCOL://$DOMAIN/api/cron/depreciation-schedules"
RESPONSE=$(curl -s -X POST \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    "$CRON_URL")

if echo "$RESPONSE" | grep -q "success"; then
    echo "✅ Cron endpoint is working"
else
    echo "❌ Cron endpoint test failed"
    echo "Response: $RESPONSE"
    exit 1
fi

# Generate cron job command
CRON_COMMAND="59 23 * * * curl -X POST -H \"Authorization: Bearer $CRON_SECRET\" -H \"Content-Type: application/json\" $CRON_URL"

echo ""
echo "✅ Setup Complete!"
echo ""
echo "📋 Add this line to your crontab (run 'crontab -e'):"
echo ""
echo "$CRON_COMMAND"
echo ""
echo "🔧 Or use one of these methods:"
echo ""
echo "1. System Cron (recommended for VPS/dedicated servers):"
echo "   sudo crontab -e"
echo "   Add the line above"
echo ""
echo "2. External Cron Service (cron-job.org, EasyCron, etc.):"
echo "   URL: $CRON_URL"
echo "   Method: POST"
echo "   Headers: Authorization: Bearer $CRON_SECRET"
echo "   Schedule: 59 23 * * * (daily at 11:59 PM)"
echo ""
echo "3. Test manually anytime:"
echo "   curl -X POST -H \"Authorization: Bearer $CRON_SECRET\" $CRON_URL"
echo ""
echo "📊 Monitor executions at: $PROTOCOL://$DOMAIN/asset-management/depreciation/history"
echo ""
echo "🎯 Your schedules will now run automatically every day at 11:59 PM!"