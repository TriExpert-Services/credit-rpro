/**
 * Report Scheduler Service
 * 
 * Cron-based service that automatically pulls credit reports for clients
 * with auto-pull enabled. Runs as part of the backend process.
 * 
 * @module utils/reportScheduler
 */

const { query } = require('../config/database');
const { logger } = require('./logger');
const bureauService = require('./bureauService');

let schedulerInterval = null;

const reportScheduler = {
  /**
   * Start the auto-pull scheduler.
   * Checks every 15 minutes for clients whose pull is due.
   */
  start() {
    if (schedulerInterval) {
      logger.warn('Report scheduler already running');
      return;
    }

    const intervalMs = parseInt(process.env.SCHEDULER_INTERVAL_MS, 10) || 15 * 60 * 1000; // 15 min
    logger.info({ intervalMs }, 'Starting report auto-pull scheduler');

    // Run immediately on start, then on interval
    this.checkAndPull().catch((err) =>
      logger.error({ err: err.message }, 'Scheduler initial run failed')
    );

    schedulerInterval = setInterval(() => {
      this.checkAndPull().catch((err) =>
        logger.error({ err: err.message }, 'Scheduler run failed')
      );
    }, intervalMs);

    // Allow the interval to not keep the process open
    if (schedulerInterval.unref) {
      schedulerInterval.unref();
    }
  },

  /**
   * Stop the scheduler.
   */
  stop() {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
      logger.info('Report scheduler stopped');
    }
  },

  /**
   * Check for clients with due auto-pulls and execute them.
   */
  async checkAndPull() {
    try {
      // Find all enabled configs where next_pull_date <= NOW
      const { rows: dueConfigs } = await query(
        `SELECT apc.*, u.first_name, u.last_name, u.email, u.status as user_status,
                cp.subscription_status
         FROM bureau_auto_pull_config apc
         JOIN users u ON u.id = apc.client_id
         LEFT JOIN client_profiles cp ON cp.user_id = apc.client_id
         WHERE apc.enabled = true
           AND apc.next_pull_date <= NOW()
           AND apc.consecutive_failures < 3
           AND u.status = 'active'
           AND cp.subscription_status IN ('active', 'trial')
         ORDER BY apc.next_pull_date ASC
         LIMIT 10`
      );

      if (dueConfigs.length === 0) {
        return;
      }

      logger.info({ count: dueConfigs.length }, 'Processing due auto-pull clients');

      for (const config of dueConfigs) {
        await this.pullForClient(config);
      }
    } catch (error) {
      logger.error({ err: error.message }, 'checkAndPull failed');
    }
  },

  /**
   * Execute auto-pull for a single client config.
   */
  async pullForClient(config) {
    const { client_id: clientId, bureaus } = config;
    const bureauList = typeof bureaus === 'string' ? JSON.parse(bureaus) : bureaus;

    logger.info({ clientId, bureaus: bureauList }, 'Auto-pulling reports for client');

    let hasFailure = false;

    for (const bureau of bureauList) {
      try {
        await bureauService.pullReport(clientId, bureau, clientId, 'account_review');
        logger.info({ clientId, bureau }, 'Auto-pull succeeded');
      } catch (error) {
        hasFailure = true;
        logger.error({ clientId, bureau, err: error.message }, 'Auto-pull failed for bureau');
      }
    }

    // Update config: set next pull date and reset/increment failures
    const freqDays = { weekly: 7, biweekly: 14, monthly: 30, quarterly: 90 };
    const nextPull = new Date(Date.now() + (freqDays[config.frequency] || 30) * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE bureau_auto_pull_config
       SET last_pull_date = NOW(),
           next_pull_date = $2,
           consecutive_failures = CASE WHEN $3 THEN consecutive_failures + 1 ELSE 0 END,
           updated_at = NOW()
       WHERE client_id = $1`,
      [clientId, nextPull, hasFailure]
    );

    // If all bureaus pulled successfully, create a notification
    if (!hasFailure) {
      await query(
        `INSERT INTO notifications
         (recipient_id, notification_type, channel, subject, message)
         VALUES ($1, 'score_update', 'in_app', $2, $3)`,
        [
          clientId,
          'Credit reports updated automatically',
          `Your credit reports from ${bureauList.join(', ')} have been refreshed. Check your dashboard for any changes.`,
        ]
      );
    }
  },

  /**
   * Get scheduler status for monitoring.
   */
  getStatus() {
    return {
      running: schedulerInterval !== null,
      intervalMs: parseInt(process.env.SCHEDULER_INTERVAL_MS, 10) || 15 * 60 * 1000,
    };
  },

  /**
   * Manually trigger a check (for admin use).
   */
  async triggerManualCheck() {
    logger.info('Manual scheduler trigger requested');
    return this.checkAndPull();
  },
};

module.exports = reportScheduler;
