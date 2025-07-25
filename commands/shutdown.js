const Logs = require('../utils/Logs');

module.exports = {
  name: 'shutdown',
  description: 'Gracefully shutdown the server. Use "shutdown now" for immediate shutdown.',
  execute({ server, rl, args }) {
    const immediate = args[0]?.toLowerCase() === 'now';

    const shutdown = () => {
      process.stdout.write('\x1Bc');
      rl.close();
      server.close(() => process.exit(0));
    };

    if (immediate) {
      Logs.warn('Shutting down immediately...');
      return shutdown();
    }

    let countdown = 5;
    const interval = setInterval(() => {
      process.stdout.write('\x1Bc');

      if (countdown > 0) {
        Logs.info(`Shutting down server in ${countdown}s...`);
        countdown--;
      } else {
        clearInterval(interval);
        shutdown();
      }
    }, 1000);
  }
};
