const os = require('os');
const axios = require('axios');
const { server, Connect } = require('./app');
const Logs = require('./utils/Logs');
require('dotenv').config();

const port = process.env.SERVER_PORT;

server.listen(port, async () => {
  const localhost = () => {
    const network = os.networkInterfaces();
    for (let name in network) {
      for (let address of network[name]) {
        if (address.family === 'IPv4' && !address.internal) {
          return address.address;
        }
      }
    }
  };

  const public = async () => {
    try {
      const res = await axios.get('https://api.ipify.org?format=json');
      return res.data.ip;
    } catch {
      return null;
    }
  };

  const publichost = await public();

  Logs.info(`Server Architecture: ${process.arch}`);
  Logs.info(`Server Platform: ${process.platform}`);
  Logs.info(`Server Uptime: ${Math.floor(process.uptime())} seconds`);
  Logs.info(`CPU Cores: ${os.cpus().length}`);
  Logs.info(`Total Memory: ${(os.totalmem() / (1024 ** 3)).toFixed(2)} GB`);
  Logs.info(`Free Memory: ${(os.freemem() / (1024 ** 3)).toFixed(2)} GB`);
  Logs.info(`Local Host: ${localhost()}`);
  Logs.info(`Public Host: ${publichost}`);
  Logs.info(`Port: ${port}`);

  await Connect();
});
