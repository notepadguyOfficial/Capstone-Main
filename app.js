const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Logs = require('./utils/Logs');
const { setRender } = require('./utils/Logs');
const Public = require('./endpoints/Public');
const Customer = require('./endpoints/Customers');
const Admin = require('./endpoints/Admin');
const { db, Connect, Stop } = require('./config/database');
require('dotenv').config();
const ADMIN_WEBSOCKET = require('./websockets/Admin');
const Utils = require('./utils/lib');
const readline = require('readline');

// #region Command Handler
const Commands = new Map();

fs.readdirSync(path.join(__dirname, 'commands')).forEach(file => {
  if (file.endsWith('.js')) {
    const command = require(`./commands/${file}`);
    Commands.set(command.name, command);
  }
});

let rl = null;
const prompt = "[CMD] >> ";

function render() {
  if (!rl) return;
  rl.setPrompt(prompt);
  rl.resume();
  rl.prompt(true);
}

setRender(render);
console.clear();

if (process.stdin.isTTY) {
  try {
    if (typeof process.stdin.setRawMode === 'function' && process.stdin.isTTY) {
        process.stdin.setRawMode(true);
    }

    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    render();

    rl.on('line', async (input) => {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);

      const [cmd, ...args] = input.trim().split(/ +/);
      const command = Commands.get(cmd.toLowerCase());

      if (!command) {
        Logs.warn(`Unknown command: ${cmd}`);
        return;
      }

      try {
        rl.pause();
        await command.execute({ app, server, rl, args, Commands });
      } catch (error) {
        Logs.error(`Error executing command ${COMMAND_NAME}: ${error.message}`);
      } finally {
        render();
      }
    });
  }catch (e) {
    Logs.warn(`Interactive CLI is not available in this environment: ${e.message}`);
  }
}

// #endregion

// #region Express Handle

const app = express();
const server = http.createServer(app);
const sockets = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(bodyParser.json());
app.set('trust proxy', true);

app.use(async (req, res, next) => {
  const { ip, geo, error } = await Utils.FetchRequestData(req);

  Logs.http(`${req.method} ${req.url} - IP: ${ip}`);

  if (geo) {
    Logs.http(`Geo Info: ${geo.country} (${geo.countryCode}) - Region ${geo.region} | ISP: ${geo.isp} | AS: ${geo.as}`);
  } else {
    Logs.warn(`Failed to fetch geo info for IP ${ip}: ${error}`);
  }
  next();
});

app.use('/api', Public);
app.use('/api/Customer', Customer);
app.use('/api/Admin', Admin);

app.use((req, res) => res.status(404).send());
// #endregion


// #region Websocket Handle

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/api/ws')) {
    sockets.handleUpgrade(req, socket, head, (ws) => {
      sockets.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

sockets.on('connection', async (ws, req) => {
  const { ip } = await Utils.FetchRequestData(req);

  Logs.websocket(`WebSocket connection established from IP: ${ip}`);

  const params = new URLSearchParams(req.url.split('?')[1]);
  const intent = params.get('intent');

  switch (intent) {
    case 'Admin':
      return ADMIN_WEBSOCKET(ws, req, params);
    default:
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid intent' }));
      return ws.close();
  }
});

// #endregion

module.exports = { app, server, sockets, Connect, Stop };
