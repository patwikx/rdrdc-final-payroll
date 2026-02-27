# Optional: Add cron to your existing Dockerfile for container-based cron
# This is useful if you want to run cron inside your application container

# Add these lines to your main Dockerfile:

# Install cron
RUN apt-get update && apt-get install -y cron && rm -rf /var/lib/apt/lists/*

# Create cron job file
RUN echo "59 23 * * * curl -X POST -H \"Authorization: Bearer \$CRON_SECRET\" -H \"Content-Type: application/json\" \$NEXTAUTH_URL/api/cron/depreciation-schedules" > /etc/cron.d/depreciation-scheduler

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/depreciation-scheduler

# Apply cron job
RUN crontab /etc/cron.d/depreciation-scheduler

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

# Add to your start script or CMD:
# service cron start && your-normal-start-command