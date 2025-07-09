const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const os = require('os');
const axios = require('axios');
const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const Logs = require('./utils/Logs');
const { type_enum, GenerateToken, channels } = require('./utils/lib');
const routes = require('./endpoints/routes.js');
const { db, Connect, Stop } = require('./config/database');
require('dotenv').config();

const port = process.env.SERVER_PORT;

const app = express();
const server = http.createServer(app);
const sockets = new WebSocket.Server({ noServer: true });

app.use(cors());
app.use(bodyParser.json());
app.set('trust proxy', true);

app.use(async (req, res, next) => {
  const raw = req.ip === '::1' ? '127.0.0.1' : req.ip;
  const ip = raw.includes('::ffff:') ? raw.split('::ffff:')[1] : raw;
  try {
    Logs.http(`${req.method} ${req.url} - IP: ${ip}`);
    const geo = await axios.get(`http://ip-api.com/json/${ip}`);
    Logs.http(`Geo Info: ${geo.data.country} (${geo.data.countryCode}) - Region ${geo.data.region} | ISP: ${geo.data.isp} | AS: ${geo.data.as}`);
    Logs.http(`Received ${req.method} request to ${req.url}`);
    next();
  } catch (error) {
    Logs.error(`Error processing IP: ${error}`);
    next();
  }
});

server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws')) {
    sockets.handleUpgrade(req, socket, head, (ws) => {
      sockets.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

sockets.on('connection', async (ws, req) => {
  Logs.http('WebSocket client connected.');

  const param = new URLSearchParams(req.url.split('?')[1]);
  const intent = param.get('intent');
  const token = param.get('token');

  if (intent === 'GetDataCount') {
    const push = async () => {
      try {
        const data = await GetDataCount();
        ws.send(JSON.stringify({ type: 'UserOnlineCount', data: data }));
      } catch (error) {
        Logs.error(`Error getting user count: ${error}`);
      }
    };

    await push();
    const interval = setInterval(push, 10000);

    ws.on('close', async () => {
      clearInterval(interval);
      Logs.http('WebSocket client disconnected.');
      if (sockets.clients.size === 0) {
        await Stop([channels]);
        Logs.http('Stopped listening to PostgreSQL because no clients are connected.');
      }
    });
  } else {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid intent' }));
    ws.close();
  }
});

async function GetDataCount() {
  const [GetOnlineUsers, GetCustomersCount, GetWrsCount] = await Promise.all([
    db('authentication').count('userid as count').where({ online: 1 }).first(),
    db('Customer').count('customer_id as count').first(),
    db('water_refilling_station').count('station_id as count').first(),
  ]);

  return {
    OnlineCount: GetOnlineUsers.count,
    CustomerCount: GetCustomersCount.count,
    WRSCount: GetWrsCount.count
  };
}

app.use('/', routes);

app.use((req, res) => {
  res.status(404).send();
});

server.listen(port, async () => {
  const localhost = () => {
    const network = os.networkInterfaces();
    for (let name in network) {
      for (let address of network[name]) {
        if (address.family == 'IPv4' && !address.internal) {
          return address.address;
        }
      }
    }
  };

  const public = async () => {
    try {
      const response = await axios.get('https://api.ipify.org?format=json');
      return response.data.ip;
    } catch (error) {
      return null;
    }
  };

  const publichost = await public();

  Logs.info(`Local Host: ${localhost()}`);
  Logs.info(`Public Host: ${publichost}`);
  Logs.info(`Port: ${port}`);

  await Connect(channels);
});
