const Logs = require('../utils/Logs');

module.exports = {
    name: 'help',
    description: 'List all commands or show detailed help for a specific command.',
    execute({ args, Commands }) {
        if (args.length === 0) {
            Logs.info(`Available Commands:`);
            for (const [name, command] of Commands.entries()) {
                console.log(`   - ${name}: ${command.description || 'No Description'}`);
            }
            return;
        } else {
            const SUB_COMMAND_NAME = args[0].toLowerCase();
            const SUB_COMMAND = Commands.get(SUB_COMMAND_NAME);

            if (!SUB_COMMAND) {
                Logs.warn(`No help found for command: ${SUB_COMMAND_NAME}`);
                return;
            }

            Logs.info(`Help for '${SUB_COMMAND_NAME}':\n` +
                `- Name: ${SUB_COMMAND.name}\n` +
                `- Description: ${SUB_COMMAND.description || 'No description.'}\n` +
                `- Usage: ${SUB_COMMAND.usage || 'Not specified.'}`
            );
        }
    },
};