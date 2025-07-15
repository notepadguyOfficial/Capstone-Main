const express = require('express');
const router = express.Router();
const Logs = require('../utils/Logs');
const { db } = require('../config/database');
const fs = require('fs');
const { GenerateToken, upload } = require('../utils/lib');
const bcrypt = require('bcrypt');
const axios = require('axios');
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// #region Register

router.post('/register', async (req, res) => {
  const { fname, lname, phone, gender, username, password, birth } = req.body;

  const container = {
      table: 'Customer',
      folder: 'customer',
      data: {
        customer_fname: fname,
        customer_lname: lname,
        customer_phone_num: phone,
        customer_gender: gender,
        customer_username: username,
        customer_password: null,
        customer_dateofbirth: birth,
      },
      field: 'customer_id',
  };

  try {
    container.data.customer_password  = await bcrypt.hash(password, 10);

    const [user] = await db(container.table)
      .insert(container.data)
      .returning([container.field]);

    const token = GenerateToken(user[container.field], 1);

    await db('authentication')
      .insert({ userid: user[container.field], token, online: 1 })
      .onConflict('userid')
      .merge({ token, created_at: db.fn.now(), updated_at: db.fn.now(), online: 1 });

    const payload = {
      ID: user[container.field],
      Fname: fname,
      Lname: lname,
      Phone: phone,
      Username: username,
      Birth: birth ?? null,
      Type: type,
      Token: token,
      ProfilePicture: null
    };

    Logs.http(`Response being sent: User Registered Successfully! User ID: ${user[container.field]} | Token: ${token}`);
    res.status(200).json({ message: 'User Registered Successfully!', data: payload });

  } catch (error) {
    Logs.error(`Response being sent: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// #endregion


// #region profile
router.post('/user/edit/profile', upload.single('image'),  async (req, res) => {
  const { id, fname, lname, phone, birth } = req.body;

  const PROFILE_DIR  = path.join(__dirname, '../profile/images/customer');
  const PROFILE_PATH = path.join(PROFILE_DIR, `profile_${id}.png`);
  try {

    if(!fs.existsSync(PROFILE_DIR)) {
      fs.mkdirSync(PROFILE_DIR, { recursive: true });
    }

    if(req.file) {
      await sharp(req.file.buffer)
      .png()
      .toFile(PROFILE_PATH);
    }

    const phoneExists = await db('Customer')
      .where('customer_phone_num', phone)
      .andWhereNot('customer_id', id)
      .first();

    if (phoneExists) {
      Logs.warn(`Response being sent: Phone number already in use | status: 409  | Code: 1002`);
      return res.status(409).json({ error: 'Phone number already in use', code: 1002 });
    }

    await db('Customer')
      .where('customer_id', id)
      .update({
        customer_fname: fname,
        customer_lname: lname,
        customer_phone_num: phone,
        customer_dateofbirth: birth,
      });

    const profile = req.file
    ? `https://hydrohub.ddns.net/api/user/profile/image?id=${id}&type=1`
    : null;

    const data = {
      ID: id,
      Fname: fname,
      Lname: lname,
      Phone: phone,
      Birth: birth,
      ...(profile && { ProfilePicture: profile }),
    }

    res.status(200).json({ message: 'User Information Successfully Updated!', data });
    Logs.http(`Response being sent: User Information Successfully Updated! Response Data: ${JSON.stringify(data)}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
    Logs.error(`Response being sent: ${error.message}`);
  }
});

router.post('/user/edit/address', async (req, res) => {
  const { id, latitude, longitude } = req.body;
  try {
    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
            latlng: `${latitude},${longitude}`,
            key: GOOGLE_MAPS_API_KEY,
        },
    });

    if(response.data.status !== 'OK' || !response.data.results.length) {
        return res.status(400).json({ error: 'Unable to resolve address from coordinates.' });
    }


    const address = response.data.results[0].formatted_address;

    await db('Customer')
      .where('customer_id', id)
      .update({
        customer_address: address,
        customer_address_long: longitude,
        customer_address_lat: latitude,
      });

  

    const payload = {
      ID: id,
      Address: address,
      Longitude: longitude,
      Latitude: latitude,
    }

    res.status(200).json({ message: 'User Information Successfully Updated!', payload });
    Logs.http(`Response being sent: User Information Successfully Updated! Response Data: ${JSON.stringify(payload)}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
    Logs.error(`Response being sent: ${error.message}`);
  }
});

router.post('/user/edit/profile/password', async (req, res) => {
  const { id, currentPassword, newPassword, confirmPassword } = req.body;

  if (!id || !currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'Missing required fields', code: 1001 });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'New passwords do not match', code: 1002 });
  }

  try {
    const user = await db('Customer')
      .select('customer_password')
      .where('customer_id', id)
      .first();

    if (!user) {
      return res.status(404).json({ error: 'User not found', code: 1003 });
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.customer_password);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Current password is incorrect', code: 1004 });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await db('Customer')
      .where('customer_id', id)
      .update({ customer_password: hashed });

    Logs.http(`Response being sent: Password updated successfully! User ID: ${id}`);
    res.status(200).json({ message: 'Password updated successfully!' });

  } catch (error) {
    Logs.error(`Response being sent: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// #endregion

// #region others

router.get('/get/list/wrs' , async (req, res) => {
  try {
    const result = await db('water_refilling_station')
      .select('*');

    if (!result) {
      Logs.error(`Empty Water Refilling Stations! | status: 200`);
      return res.status(200).json({ message: "Empty Water Refilling Stations!" });
    }

    const json_map = result.map(station => ({
      station_id: station.station_id,
      station_name: station.station_name,
      station_address: station.station_address,
      station_phone_num: station.station_phone_num,
      station_longitude: station.station_longitude,
      station_latitude: station.station_latitude
    }));

    res.status(200).json({ message: "Successfully retrieved Water Refilling Station!", data: json_map });
    Logs.http(`Response being sent: Successfully retrieved Water Refilling Station!`);
  }
  catch (error) {
    res.status(500).json({ error: error.message });
    Logs.error(`Response being sent: ${error.message}`);
  }
});

// #endregion

// #region Checkers

router.get('/user/check/phone', async(req, res) => {
  const phone = req.query.phone;

  try{
    const result = await db('Customers')
      .where('customer_phone_num', phone)
      .first();

    if (result) {
      Logs.warn(`Response being sent: Phone number already in use | status: 409 | Code: 1002`);
      return res.status(409).json({ error: 'Phone number already in use', code: 1002 });
    }

    return res.status(200);
  }
  catch(error) {
    Logs.error(`Response being sent: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

router.get('/user/check/username', async(req, res) => {
  const username = req.query.username;

  try{
    const result = await db('Customers')
      .where('customer_username', username)
      .first();

    if (result) {
      Logs.warn(`Response being sent: Username already exists | status: 409 | Code: 1001`);
      return res.status(409).json({ error: 'Username already exists', code: 1001 });
    }

    return res.status(200);
  }
  catch(error) {
    Logs.error(`Response being sent: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// #endregion

module.exports = router;