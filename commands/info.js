const Logs = require('../utils/Logs');
const os = require('os');

module.exports = {
    name: 'info',
    description: 'Displays server information and stats.',
    async execute({ args }) {
        const sub = args[0]?.toLowerCase();

        switch (sub) {
            case 'uptime':
                return Logs.info(`Uptime: ${formatUptime(process.uptime())}`);

            case 'memory':
                const mem = process.memoryUsage();
                return Logs.info(`Memory Usage:
                    RSS       : ${(mem.rss / 1024 / 1024).toFixed(2)} MB
                    Heap Used : ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB
                    Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`
                );

            case 'cpu':
                const cpus = os.cpus();
                return Logs.info(`CPU Info: ${cpus[0].model} (${cpus.length} cores)`);

            case 'os':
                return Logs.info(`Operating System: ${os.type()} ${os.release()} (${os.platform()})`);

            case 'all':
                Logs.info(`
                    Uptime     : ${formatUptime(process.uptime())}
                    Memory     : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB
                    CPU        : ${os.cpus()[0].model}
                    Platform   : ${os.platform()} - ${os.release()}`
                );
                return;

            case 'help':
            default:
                Logs.info(`Available info commands:
                    info uptime   - Show server uptime
                    info memory   - Show memory usage
                    info cpu      - Show CPU details
                    info os       - Show OS info
                    info all      - Show all of the above
                `);
        }
    }
};

function formatUptime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
}
