const Logs = require('../utils/Logs');

module.exports = {
    name: 'clear',
    description: 'Clears screen',
    execute({ server, rl }) {
        process.stdout.write('\x1Bc');
    }
}