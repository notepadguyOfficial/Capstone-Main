const winston = require('winston');
const fs = require('fs');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');
const readline = require('readline');
require('dotenv').config();

let render = null;

function setRender(fn) {
    render = fn;
}

const LOG_LEVEL = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
        critical: 6,
        alert: 7,
        database: 8,
        websocket: 9
    },
    colors: {
        error: 'red',
        warn: 'magenta',
        info: 'green',
        http: 'blue',
        verbose: 'grey',
        debug: 'white',
        critical: 'yellow',
        alert: 'yellow',
        database: 'blue',
        websocket: 'magenta',
    },
};

winston.addColors(LOG_LEVEL.colors);

const DEFAULT_LOGS_PATH = path.join(__dirname, '../Logs');
const directory = process.env.LOGS_PATH && process.env.LOGS_PATH.trim() !== ''
    ? process.env.LOGS_PATH
    : DEFAULT_LOGS_PATH;

try {
    if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
    }
}
catch (error) {
    console.error('Error creating log directory:', error);
}

/**
 * Creates a filter for log levels.
 * 
 * @param {string|string[]} levels - The log level(s) to filter.
 * @returns {Function} A winston format function that filters log messages based on the specified levels.
 */
const createFilter = (levels) =>
    winston.format((info) => {
        if (Array.isArray(levels) ? levels.includes(info.level) : info.level === levels) {
            return info;
        }
        return false;
    })();

/**
 * Combines multiple winston format functions into a single format function.
 * 
 * @type {Format}
 */
const formatter = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss.SSS A' }),
    winston.format.errors({ stack: true }),
    winston.format.printf((info) => {
        const location = info.location ? `[${info.location}] ` : '';
        return `${location}[${info.level}] [${info.timestamp}]: ${info.message}`;
    })
);

/**
 * Creates a new DailyRotateFile transport for winston logger.
 * 
 * @param {string} filename - The base name of the log file.
 * @param {string} level - The log level for the transport.
 * @param {string|string[]} filtered - The log level(s) to filter.
 * @returns {DailyRotateFile} A new DailyRotateFile transport.
 */
const Transport = (filename, level, filtered) =>
    new DailyRotateFile({
        filename: path.join(directory, `${filename}_%DATE%.log`),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '14d',
        level,
        format: winston.format.combine(createFilter(filtered), formatter),
    });

/**
 * Creates a new winston logger with specified levels and transports.
 * 
 * @type {Logger}
 */

const Logs = winston.createLogger({
    levels: LOG_LEVEL.levels,
    level: 'websocket',
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize({ all: true }),
                formatter
            ),
            log(info, callback) {
                const readline = require('readline');
                const { format } = this;

                const formatted = format.transform(info, format.options);
                const message = formatted?.[Symbol.for('message')] || formatted?.message || '';

                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                process.stdout.write(`${message}\n`);

                if (render) {
                    setTimeout(render, 10);
                }

                callback();
            },
        }),
        Transport('App', 'debug', ['alert', 'debug', 'verbose', 'info']),
        Transport('Error', 'error', ['critical', 'warn', 'error']),
        Transport('DB', 'database', 'database'),
        Transport('HTTP', 'http', 'http'),
        Transport('WebSocket', 'websocket', 'websocket'),
    ],
});

for (const level of Object.keys(LOG_LEVEL.levels)) {
    const orig = Logs[level].bind(Logs);
    Logs[level] = (...args) => {
        const stack = new Error().stack?.split('\n') || [];
        const callerLine = stack.find(line =>
            !line.includes('node_modules') &&
            !line.includes('winston') &&
            !line.includes('internal') &&
            !line.includes('Logs.js') &&
            line.includes('.js:')
        );
        let location = '';
        if (callerLine) {
            const match = callerLine.match(/\(([^)]+)\)/) || callerLine.match(/at (.+)/);
            if (match && match[1]) {
                location = path.relative(process.cwd(), match[1]);
            }
        }
        if (typeof args[0] === 'object') {
            args[0].location = location;
        } else {
            args[0] = { message: args[0], location };
        }
        return orig(...args);
    };
}

module.exports = Logs;
module.exports.setRender = setRender;