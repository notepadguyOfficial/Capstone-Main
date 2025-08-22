const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

class Utils {
  static USER_TYPES = {
    Admin: 0,
    Customer: 1,
    Owner: 2,
    Staff: 3,
  };

  static channels = [
    'LOGIN',
    'REGISTER',
    'CUSTOMER',
    'PRODUCT',
    'STAFF',
    'OWNER',
    'REFILLINGSTATION',
    'SALES',
  ];

  static parseIp(req) {
    let ip = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    if (ip === '::1') ip = '127.0.0.1';
    if (ip.startsWith('::ffff:')) ip = ip.split('::ffff:')[1];
    return ip;
  }

  static async FetchRequestData(req) {
    const ip = this.parseIp(req);

    if (ip === '127.0.0.1') {
      return {
        ip,
        geo: {
          country: 'Local',
          countryCode: 'LOCAL',
          region: 'Local',
          isp: 'Local ISP',
          as: 'Local AS',
          city: 'Localhost',
          lat: 0,
          lon: 0,
          timezone: 'UTC',
          org: 'Dev Machine',
        },
      };
    }

    try {
      const geo = await axios.get(`http://ip-api.com/json/${ip}`);
      return {
        ip,
        geo: {
          country: geo.data.country,
          countryCode: geo.data.countryCode,
          region: geo.data.region,
          isp: geo.data.isp,
          as: geo.data.as,
          city: geo.data.city,
          lat: geo.data.lat,
          lon: geo.data.lon,
          timezone: geo.data.timezone,
          org: geo.data.org,
        },
      };
    } catch (error) {
      return { ip, geo: null, error: error.message };
    }
  }

  static GenerateToken(id, type) {
    const payload = { id, type };
    return jwt.sign(payload, process.env.SECRET_TOKEN, { expiresIn: '1h' });
  }

  static getMulterUpload() {
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        let folder;

        switch (parseInt(req.body.type)) {
          case 0: folder = 'admin'; break;
          case 1: folder = 'customer'; break;
          case 2: folder = 'owner'; break;
          case 3: folder = 'staff'; break;
          default: folder = 'unknown';
        }

        const PROFILE_PATH = path.join(__dirname, '../profile/images/', folder);
        cb(null, PROFILE_PATH);
      },
      filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const filename = `profile_${req.body.id}${ext}`;
        cb(null, filename);
      },
    });

    return multer({ storage });
  }

  static getMemoryUpload() {
    return multer({ storage: multer.memoryStorage() });
  }

  static order_message_dir = path.join(__dirname, '../orders/');

  static ensure_order_directory() {
    if (!fs.existsSync(this.order_message_dir)) {
      fs.mkdirSync(this.order_message_dir, { recursive: true });
    }
  }

  static get_order_chat_file(order_id) {
    this.ensure_order_directory();
    return path.join(this.messagesDir, `order_${order_id}.json`);
  }

  static load_messages(order_id) {
    const file = this.get_order_chat_file(order_id);
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    return [];
  }

  static save_message(order_id, messages) {
    fs.writeFileSync(this.get_order_chat_file(order_id), JSON.stringify(messages, null, 2));
  }

  static add_message(order_id, sender, message) {
    if(!sender || !message) {
      throw new Error('Missing sender or text query parameters');
    }
    
    const messages = this.load_messages(order_id);

    const new_message = {
      id: messages.length + 1,
      sender,
      message,
      timestamp: new Date().toISOString(),
    };

    messages.push(new_message);
    this.save_message(order_id, messages);

    return new_message;
  }
}

module.exports = Utils;
