const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const WebSocket = require('ws');
const cors = require('cors');
const http = require('http');
const Logs = require('./utils/Logs');

const Public = require('./endpoints/Public');
const Customer = require('./endpoints/Customers');
const Admin = require('./endpoints/Admin');

const { db, Connect, Stop } = require('./config/database');
require('dotenv').config();

const ADMIN_WEBSOCKET = require('./websockets/Admin');

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
  if (req.url.startsWith('/api/ws')) {
    sockets.handleUpgrade(req, socket, head, (ws) => {
      sockets.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

sockets.on('connection', async (ws, req) => {
  Logs.websokect('WebSocket client connected.');
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

app.use('/api', Public);
app.use('/api/Customer', Customer);
app.use('/api/Admin', Admin);

app.use((req, res) => res.status(404).send());

module.exports = { app, server, sockets, Connect, Stop };
