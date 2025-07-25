const Logs = require('../utils/Logs');
const { db } = require('../config/database');
const os = require('os');

module.exports = {
  name: 'database',
  description: 'Displays server information.',
  usage: 'database [info|uptime|env]',
  async execute({ args }) {
    const sub = args[0]?.toLowerCase();

    switch (sub) {
      case 'info': {
        const config = db.client.config.connection;

        Logs.database(
          '================ PostgreSQL Connection Info ================\n' +
          `Host:     ${config.host}\n` +
          `Port:     ${config.port}\n` +
          `Database: ${config.database}\n` +
          `User:     ${config.user}`
        );

        break;
      }

      case 'uptime': {
        try {
          const result = await db.raw("SELECT now() - pg_postmaster_start_time() AS uptime");
          const interval = result.rows?.[0]?.uptime;

          const parts = [];
          if (interval.years) parts.push(`${interval.years}y`);
          if (interval.months) parts.push(`${interval.months}mo`);
          if (interval.days) parts.push(`${interval.days}d`);
          if (interval.hours) parts.push(`${interval.hours}h`);
          if (interval.minutes) parts.push(`${interval.minutes}m`);
          if (interval.seconds) parts.push(`${Math.floor(interval.seconds)}s`);

          const formatted = parts.join(' ') || 'Unavailable';

          Logs.database(`PostgreSQL Uptime: ${formatted}`);
        } catch (err) {
          Logs.error(`Failed to get PostgreSQL uptime: ${err.message}`);
        }
        break;
      }
      case 'env': {
        Logs.info(`
          Environment: ${process.env.NODE_ENV || 'development'}
          Platform: ${os.platform()} ${os.arch()}
          Node Version: ${process.version}`
        );
        break;
      }

      default:
        Logs.warn('Invalid or missing subcommand. Use: database info | uptime | env');
    }
  },
};
