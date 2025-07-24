const express = require('express');
const router = express.Router();
const Logs = require('../utils/Logs');
const { db } = require('../config/database');
const path = require('path');
const fs = require('fs');

const { GenerateToken } = require('../utils/lib');
const bcrypt = require('bcrypt');

// #region Reusables

router.get('/user/profile/image', async (req, res) => {
  const { id, type } = req.query;

  if (!id || !type) {
    return res.status(400).json({ error: 'Missing query  parameters' });
  }

  try {
    switch (parseInt(type)) {
      case 0:
        directory = "admin";
        break;
      case 1:
        directory = "customer";
        break;
      case 2:
        directory = "owner";
        break;
      case 3:
        directory = "staff";
        break;
      default:
        return res.status(400).json({ error: 'Invalid user type' });
    }

    const IMAGE_PATH = path.join(__dirname, '../profile/images/', directory, `/profile_${id}.png`);

    fs.access(IMAGE_PATH, fs.constants.F_OK, (error) => {
      if (error) {
        Logs.error(`Response being sent: User or image not found | status: 40 | Path: ${IMAGE_PATH}`);
        return res.status(404).json({ error: 'User or image not found' });
      }
      res.sendFile(IMAGE_PATH);
      Logs.http(`Response being sent: User profile image sent successfully! User ID: ${id}`);
    });
  } catch (error) {
    Logs.error(`Response being sent: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handles user login for different types of users (Admin, Customer, Owner, Staff).
 *
 * @async
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} req.body - The request body containing login data.
 * @param {string} req.body.username - The username of the user trying to log in.
 * @param {string} req.body.password - The password of the user trying to log in.
 * @param {number} req.body.type - The type of user (0: Admin, 1: Customer, 2: Owner, 3: Staff).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A promise that resolves when the login process is complete.
 *
 * @throws {Error} Will throw an error if the login process fails.
 *
 * @description
 * This function validates the login credentials, checks the user type,
 * verifies the password, generates a token upon successful login,
 * and updates the authentication table with the new token.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    Logs.warn(`Response being sent: All fields are required! | status: 400`);
    return res.status(400).json({ error: 'All fields are required!' });
  }

  const userTypes = [
    {
      type: 0,
      table: 'app_owner',
      idField: 'app_owner_id',
      userField: 'app_owner_username',
      passField: 'app_owner_password',
      folder: 'admin',
      fieldMap: {
        app_owner_id: 'ID',
        app_owner_fname: 'Fname',
        app_owner_lname: 'Lname',
        app_owner_phone_num: 'Phone',
        app_owner_address: 'Address',
        app_owner_gender: 'Gender',
        app_owner_username: 'Username',
      }
    },
    {
      type: 1,
      table: 'Customer',
      idField: 'customer_id',
      userField: 'customer_username',
      passField: 'customer_password',
      folder: 'customer',
      fieldMap: {
        customer_id: 'ID',
        customer_fname: 'Fname',
        customer_lname: 'Lname',
        customer_phone_num: 'Phone',
        customer_address: 'Address',
        customer_gender: 'Gender',
        customer_username: 'Username',
        customer_address_long: 'Longitude',
        customer_address_lat: 'Latitude',
        customer_dateofbirth: 'DateOfBirth',
      }
    },
    {
      type: 2,
      table: 'station_owner',
      idField: 'st_owner_id',
      userField: 'st_owner_username',
      passField: 'st_owner_password',
      folder: 'owner',
      fieldMap: {
        st_owner_id: 'ID',
        st_owner_fname: 'Fname',
        st_owner_lname: 'Lname',
        st_owner_phone_num: 'Phone',
        st_owner_gender: 'Gender',
        st_owner_username: 'Username',
      }
    },
    {
      type: 3,
      table: 'staff',
      idField: 'staff_id',
      userField: 'staff_username',
      passField: 'staff_password',
      folder: 'staff',
      fieldMap: {
        staff_id: 'ID',
        staff_fname: 'Fname',
        staff_lname: 'Lname',
        staff_phone_num: 'Phone',
        staff_gender: 'Gender',
        staff_username: 'Username',
      }
    }
  ];

  try {
    let matchedUser = null;
    let matchedType = null;

    for (const userType of userTypes) {

      const selectFields = userType.type === 1
        ? [
          '*',
          db.raw(`TO_CHAR(customer_dateofbirth, 'YYYY-MM-DD') AS customer_dateofbirth`)
        ]
        : '*';

      const user = await db(userType.table)
        .select(selectFields)
        .where(userType.userField, username)
        .first();

      if (user) {
        matchedUser = user;
        matchedType = userType;
        break;
      }
    }

    if (!matchedUser) {
      Logs.error(`Response being sent: User not found! | status: 404 | Code: 1003`);
      return res.status(404).json({ error: 'User not found!', code: 1003 });
    }

    const isPasswordValid = await bcrypt.compare(password, matchedUser[matchedType.passField]);
    if (!isPasswordValid) {
      Logs.error(`Response being sent: Invalid Password! | status: 401 | Code: 1004`);
      return res.status(401).json({ error: 'Invalid Password!', code: 1004 });
    }

    const token = GenerateToken(matchedUser[matchedType.idField], matchedType.type);

    await db('authentication')
      .insert({ userid: matchedUser[matchedType.idField], token, online: 1 })
      .onConflict('userid')
      .merge({ token, created_at: db.fn.now(), updated_at: db.fn.now(), online: 1 });

    // Strip password from data
    const { [matchedType.passField]: _, ...userData } = matchedUser;

    // Standardize JSON fields
    const mappedData = Object.entries(userData).reduce((acc, [key, val]) => {
      const newKey = matchedType.fieldMap[key] || key;
      acc[newKey] = val;
      return acc;
    }, {
      // fallback fields
      Longitude: null,
      Latitude: null,
      DateOfBirth: null
    });

    const IMAGE_PATH = path.join(__dirname, '../profile/images/', matchedType.folder, `/profile_${matchedUser[matchedType.idField]}.png`);
    let profile = null;

    if (fs.existsSync(IMAGE_PATH)) {
      profile = `https://hydrohub.hopto.org/api/user/profile/image?id=${matchedUser[matchedType.idField]}&type=${matchedType.type}`;
    }

    mappedData.Type = matchedType.type;
    mappedData.Token = token;
    mappedData.ProfilePicture = profile;

    Logs.http(`Response being sent: Login successful for UserID: ${matchedUser[matchedType.idField]} | Token: ${token}`);
    res.status(200).json({
      message: 'Login successful!',
      data: mappedData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
    Logs.error(`Response being sent: ${error.message}`);
  }
});


/**
 * Handles user logout by invalidating the authentication token.
 *
 * @async
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} req.body - The request body containing logout data.
 * @param {string} req.body.userid - The user ID of the user logging out.
 * @param {string} req.body.token - The authentication token to be invalidated.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A promise that resolves when the logout process is complete.
 *
 * @throws {Error} Will throw an error if the logout process fails.
 *
 * @description
 * This function validates the provided user ID and token, checks if they exist in the authentication table,
 * removes the authentication entry if valid, and sends routerropriate responses based on the outcome.
 */
router.post('/user/logout', async (req, res) => {
  const { userid, token } = req.body;

  if (!userid || !token) {
    return res.status(400).json({ error: 'User ID and Token are required for logout' });
  }

  try {
    const result = await db('authentication')
      .where({ userid, token })
      .update({
        token: null,
        updated_at: db.fn.now(),
        online: 0
      });

    if (result === 0) {
      Logs.warn(`Logout attempted but no rows were updated for userid=${userid}`);
    }

    Logs.http(`Response being sent: User logged out successfully for UserID: ${userid}`);
    res.json({ message: 'Logout successful!' });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
    Logs.error(`Response being sent: ${error.message}`);
  }
});

// #endregion

// #region Test Routes

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// #endregion

module.exports = router;
