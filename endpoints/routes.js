const express = require('express');
const router = express.Router();
const Logs = require('../utils/Logs');
const { db, Connect, Stop } = require('../config/database');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const { type_enum, GenerateToken } = require('../utils/lib');
const bcrypt = require('bcrypt');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const axios = require('axios');

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// #region Water Refilling Stations

// 02-05-2025 3:16 PM 

/**
 * POST /register-wrs
 * 
 * This endpoint registers a new water refilling station.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {string} req.body.name - Name of the water refilling station
 * @param {string} req.body.address - Address of the water refilling station
 * @param {string} req.body.phone_num - Phone number of the water refilling station
 * @param {string} req.body.lng - Longitude of the water refilling station
 * @param {string} req.body.lat - Latitude of the water refilling station
 * @param {string} [req.body.station_paymaya_acc] - PayMaya account of the water refilling station (optional)
 * @param {string} [req.body.station_gcash_qr] - GCash QR code of the water refilling station (optional)
 * @param {string} [req.body.station_paymaya_qr] - PayMaya QR code of the water refilling station (optional)
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response indicating the registration status of the water refilling station.
 */
router.post('/register-wrs', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { name, address, phone_num, lng, lat, station_paymaya_acc, station_gcash_qr, station_paymaya_qr } = req.body;    

    const config = {
        requiredFields: ['name', 'address', 'phone_num', 'lng', 'lat'],
        table: 'water_refilling_station',
        data: {
            station_name: name,
            customer_lname: address,
            station_address: phone_num,
            station_phone_num: address,
            station_longitude: lng,
            station_latitude: lat,
            station_paymaya_acc: null,
            station_gcash_qr: null,
            station_paymaya_qr: null,
        },
        field: 'station_id',
    }

    // Validate required fields
    const missingFields = config.requiredFields.filter((field) => !req.body[field]);

    if (missingFields.length) {
        Logs.warn(`Response being sent: Missing Fields: ${missingFields.join(', ')} | status: 400`);
        return res.status(400).json({ error: `Missing Fields: ${missingFields.join(', ')}` });
    }

    try {
        const [user] = await db(config.table)
            .insert(config.data)
            .returning([config.field]);

        res.json({ message: 'Water Refilling Station Registered Successfully!', token });
        Logs.http(`Response being sent: Water Refilling Station Registered Successfully! User ID: ${user[config.field]} | Token: ${token}`);
    } catch (error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

router.get('/admin/getdatacount', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Query: ${JSON.stringify(req.query)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const authorization = req.headers.authorization;

    const token = authorization?.split(' ')[1];

    try {
        const user = await db('authentication')
            .select('userid')
            .where({ token })
            .first();

        if (!user) {
            Logs.warn(`Unauthorized access attempt with invalid token: ${token}`);
            return res.status(401).json({ error: 'Invalid token' });
        }

        const GetOnlineUsers = await db('authentication')
            .count('userid as count')
            .where({ online: 1 })
            .first();

        const GetCustomersCount = await db('Customer')
            .count('customer_id as count')
            .first();

        const GetWrsCount = await db('water_refilling_station')
            .count('station_id as count')
            .first();

        const data = {
            OnlineCount: GetOnlineUsers.count,
            CustomerCount: GetCustomersCount.count,
            WRSCount: GetWrsCount.count
        }
        
        Logs.http(`Response being sent: Successfully retrieved Data Count! | status: 200`);
        return res.status(200).json({ message: "Successfully retrieved Data Count!", data });
    }
    catch(error) {
        Logs.error(`Response being sent: ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
});

/**
 * GET /get-wrs
 * 
 * This endpoint retrieves all water refilling stations.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response with the retrieved water refilling stations or an error message.
 */
router.get('/get-wrs', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    try {
        const { result } = await db('water_refilling_station')
        .select('*');

        if(!result) {
            Logs.error(`Empty Water Refilling Stations! | status: 200`);
            return res.status(200).json({ message: "Empty Water Refilling Stations!" });
        }

        const json_map = result.map(station => ({
            station_id: result.station_id,
            station_name: result.station_name,
            station_address: result.station_address,
            station_phone_num: result.station_phone_num,
            station_longitude: result.station_longitude,
            station_latitude: result.station_latitude,
            station_paymaya_acc: result.station_paymaya_acc,
            station_gcash_qr: result.station_gcash_qr
                ? `/public/${result.station_id}/img/qr/${path.basename(result.station_gcash_qr)}`
                : null,
            station_paymaya_qr: result.station_paymaya_qr
                ? `/public/${result.station_id}/img/qr/${path.basename(result.station_paymaya_qr)}`
                : null,
        }));
        
        res.status(200).json({ message: "Successfully retrieved Water Refilling Station!", data: json_map });
        Logs.http(`Response being sent: Successfully retrieved Water Refilling Station!`);
    }
    catch(error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

/**
 * GET /get-wrs-details
 * 
 * This endpoint retrieves the details of a specific water refilling station based on the provided station_id.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.station_id - ID of the water refilling station to retrieve
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response with the retrieved water refilling station details or an error message.
 */
router.get('/get-wrs-datails', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { station_id } = req.body;

    if(!station_id) {
        Logs.warn(`Response being sent: Missing Required Data for Query! | status: 400` );
        return res.status(400).json({ error: 'Missing Required Data for Query!' });
    }

    try {
        const result = await db('water_refilling_station')
        .select('*')
        .where({ station_id })
        .first();

        if(!result) {
            Logs.error(`Water Refilling Station doesn't Exists! | status: 404`);
            return res.status(404).json({ message: "Water Refilling Station doesn't Exists!" });
        }

        const json_map = result.map(station => ({
            station_id: result.station_id,
            station_name: result.station_name,
            station_address: result.station_address,
            station_phone_num: result.station_phone_num,
            station_longitude: result.station_longitude,
            station_latitude: result.station_latitude,
            station_paymaya_acc: result.station_paymaya_acc,
            station_gcash_qr: result.station_gcash_qr
                ? `/public/${result.station_id}/img/qr/${path.basename(result.station_gcash_qr)}`
                : null,
            station_paymaya_qr: result.station_paymaya_qr
                ? `/public/${result.station_id}/img/qr/${path.basename(result.station_paymaya_qr)}`
                : null,
        }));
        
        res.status(200).json({ message: "Successfully retrieved Water Refilling Station Details!", data: json_map });
        Logs.http(`Response being sent: Successfully retrieved Water Refilling Station Details!`);
    }
    catch(error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

/**
 * PUT /update-wrs-details
 * 
 * This endpoint updates the details of a specified water refilling station.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.station_id - ID of the water refilling station to update
 * @param {string} [req.body.station_name] - New name of the water refilling station (optional)
 * @param {string} [req.body.station_address] - New address of the water refilling station (optional)
 * @param {string} [req.body.station_phone_num] - New phone number of the water refilling station (optional)
 * @param {string} [req.body.station_longitude] - New longitude of the water refilling station (optional)
 * @param {string} [req.body.station_latitude] - New latitude of the water refilling station (optional)
 * @param {string} [req.body.station_paymaya_acc] - New PayMaya account of the water refilling station (optional)
 * @param {string} [req.body.station_gcash_qr] - New GCash QR code of the water refilling station (optional)
 * @param {string} [req.body.station_paymaya_qr] - New PayMaya QR code of the water refilling station (optional)
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response indicating the update status of the water refilling station.
 */
router.get('/update-wrs-details', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { station_id, station_name, station_address, station_phone_num, station_longitude, station_latitude, station_paymaya_acc, station_gcash_qr, station_paymaya_qr } = req.body;

    if (!station_id) {
        Logs.warn(`Response being sent: Missing Required Data for Query! | status: 400`);
        return res.status(400).json({ error: 'Missing station_id for the update!' });
    }

    const updateData = {
        station_name,
        station_address,
        station_phone_num,
        station_longitude,
        station_latitude,
        station_paymaya_acc,
        station_gcash_qr,
        station_paymaya_qr
    };

    Object.keys(updateData).forEach(key => updateData[key] == null && delete updateData[key]);

    try {
        const existingStation = await db('water_refilling_station')
            .select('*')
            .where({ station_id })
            .first();

        if (!existingStation) {
            Logs.error(`Water Refilling Station with ID ${station_id} doesn't exist! | status: 404`);
            return res.status(404).json({ message: "Water Refilling Station doesn't exist!" });
        }

        const result = await db('water_refilling_station')
            .where({ station_id })
            .update(updateData);

        if (!result) {
            Logs.error(`Failed to update Water Refilling Station with ID ${station_id} | status: 400`);
            return res.status(400).json({ message: "Failed to update Water Refilling Station details!" });
        }

        res.status(200).json({ message: "Successfully updated Water Refilling Station details!" });
        Logs.http(`Response being sent: Successfully updated Water Refilling Station details!`);

    } catch (error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

// #endregion

// #region Staff, Customer, Owner, Admin

/**
 * Handles user registration for different types of users (Customer, Owner, Staff).
 * 
 * @async
 * @function
 * @param {Object} req - Express request object.
 * @param {Object} req.body - The request body containing user registration data.
 * @param {string} req.body.fname - First name of the user.
 * @param {string} req.body.lname - Last name of the user.
 * @param {string} [req.body.staff_type] - Type of staff (required for staff registration).
 * @param {string} [req.body.address] - Address of the user (required for customer registration).
 * @param {string} req.body.phone - Phone number of the user.
 * @param {string} req.body.gender - Gender of the user.
 * @param {string} req.body.username - Username for the new account.
 * @param {string} req.body.password - Password for the new account.
 * @param {number} [req.body.long] - Longitude of the user's address (required for customer registration).
 * @param {number} [req.body.lang] - Latitude of the user's address (required for customer registration).
 * @param {number} req.body.type - Type of user (1: Customer, 2: Owner, 3: Staff).
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} - A promise that resolves when the registration process is complete.
 * 
 * @throws {Error} Will throw an error if the registration process fails.
 */
router.post('/register', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { fname, lname, staff_type, phone, gender, username, password, birth, type } = req.body;

    if (!type_enum.includes(type)) {
        Logs.error('Response being sent: Invalid user type! | status: 400');
        return res.status(400).json({ error: 'Invalid user type!' });
    }

    const fieldConfigs = {
        1: {
            requiredFields: ['fname', 'lname', 'phone', 'gender', 'username', 'password', 'birth'],
            table: 'Customer',
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
        },
        2: {
            requiredFields: ['fname', 'lname', 'phone', 'gender', 'username', 'password'],
            table: 'station_owner',
            data: {
                st_owner_fname: fname,
                st_owner_lname: lname,
                st_owner_phone_num: phone,
                st_owner_gender: gender,
                st_owner_username: username,
                st_owner_password: null,
            },
            field: 'st_owner_id',
        },
        3: {
            requiredFields: ['fname', 'lname', 'staff_type', 'phone', 'gender', 'username', 'password'],
            table: 'staff',
            data: {
                staff_fname: fname,
                staff_lname: lname,
                staff_type: staff_type,
                staff_phone_num: phone,
                staff_gender: gender,
                staff_username: username,
                staff_password: null,
            },
            field: 'staff_id',
        },
    };

    const config = fieldConfigs[type];

    if (!config) {
        Logs.error('Response being sent: Unknown type received | status: 400');
        return res.status(400).json({ error: 'Invalid user type!' });
    }

    const missingFields = config.requiredFields.filter((field) => !req.body[field]);
    if (missingFields.length) {
        Logs.warn(`Response being sent: Missing Fields: ${missingFields.join(', ')} | status: 400`);
        return res.status(400).json({ error: `Missing Fields: ${missingFields.join(', ')}` });
    }

    try {
        const usernameField = Object.keys(config.data).find(k => k.includes('username'));
        const phoneField = Object.keys(config.data).find(k => k.includes('phone'));

        const usernameExists = await db(config.table)
            .where(usernameField, username)
            .first();

        if (usernameExists) {
            Logs.warn(`Response being sent: Username already exists | status: 409 | Code: 1001`);
            return res.status(409).json({ error: 'Username already exists', code: 1001 });
        }

        const phoneExists = await db(config.table)
            .where(phoneField, phone)
            .first();

        if (phoneExists) {
            Logs.warn(`Response being sent: Phone number already in use | status: 409 | Code: 1002`);
            return res.status(409).json({ error: 'Phone number already in use', code: 1002 });
        }

        const hash = await bcrypt.hash(password, 10);
        config.data[Object.keys(config.data).find(key => key.includes('password'))] = hash;

        const [user] = await db(config.table)
            .insert(config.data)
            .returning([config.field]);

        const token = GenerateToken(user[config.field], type);

        await db('authentication')
            .insert({ userid: user[config.field], token, online: 1 })
            .onConflict('userid')
            .merge({ token, created_at: db.fn.now(), updated_at: db.fn.now(), online: 1 });

        const userData = {
            ID: user[config.field],
            Fname: fname,
            Lname: lname,
            Phone: phone,
            Username: username,
            Birth: birth ?? null,
            Type: type,
            Token: token
        };

        Logs.http(`Response being sent: User Registered Successfully! User ID: ${user[config.field]} | Token: ${token}`);
        res.status(200).json({ message: 'User Registered Successfully!', data: userData });

    } catch (error) {
        Logs.error(`Response being sent: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

router.post('/customereditaddress', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { id, latitude, longitude } = req.body;

    try {
        const geo = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                latlng: `${latitude},${longitude}`,
                key: GOOGLE_MAPS_API_KEY,
            },
        });

        const results = geo.data.results;
        const address = results.length > 0 ? results[0].formatted_address : null;

        const updated = await db('Customer')
            .where({ customer_id: id })
            .update({
                customer_address: address,
                customer_address_long: longitude,
                customer_address_lat: latitude,
            });

        const data = {
            ID: id,
            Address: address,
            Longitude: longitude,
            Latitude: latitude
        };

        Logs.http(`Response being sent: Address Set Successfully! User ID: ${id} | latitude: ${latitude} | longitude: ${longitude} | Address: ${address}`);
        res.status(200).json({
            message: 'Address Set Successfully!',
            data: data
        });
    } catch (error) {
        Logs.error(`Response being sent: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});


router.post('/customereditprofile', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);
	
	const { id, fname, lname, phone, birth } = req.body;

    try {
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

        const data = {
            ID: id,
            Fname: fname,
            Lname: lname,
            Phone: phone,
            Birth: birth
        }

        res.status(200).json({ message: 'User Information Successfully Updated!', data });
        Logs.http(`Response being sent: User Information Successfully Updated! User ID: ${id}`);
    } catch (error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

router.post('/customereditpassword', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { id, currentPassword, newPassword, confirmPassword } = req.body;

    if (!id || !currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'Missing required fields', code: 1001 });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match', code: 1002 });
    }

    try {
        // Fetch user
        const user = await db('Customer')
            .select('customer_password')
            .where('customer_id', id)
            .first();

        if (!user) {
            return res.status(404).json({ error: 'User not found', code: 1003 });
        }

        // Check current password
        const passwordMatches = await bcrypt.compare(currentPassword, user.customer_password);
        if (!passwordMatches) {
            return res.status(401).json({ error: 'Current password is incorrect', code: 1004 });
        }

        // Hash new password
        const hashed = await bcrypt.hash(newPassword, 10);

        // Update in database
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

router.patch('/user/update/presence', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { uid, online} = req.body;

    try {
        const updateFields = {};

        if(online == 0 || online == 1) {
            updateFields.online = online;
        }

        updateFields.last_seen = new Date(last_seen);

        if (Object.keys(updateFields).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }

        await db('authentication')
            .where({ userid: uid })
            .update(updateFields);

         return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('❌ Error updating presence:', error);
        return res.status(500).json({ error: 'Failed to update user presence' });
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
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

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

        mappedData.Type = matchedType.type;
        mappedData.Token = token;

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
router.post('/user/logout', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { userid, token } = req.body;

    if(!userid || !token) {
        return res.status(400).json({ error: 'User ID and Token are required for logout' });
    }

    try {
        const result = await db('authentication')
            .where({ userid, token})
            .update({
                token: null,
                updated_at: db.fn.now(),
                online: 0
            });

        if(result === 0)
        {
            Logs.warn(`Logout attempted but no rows were updated for userid=${userid}`);
        }

        Logs.http(`Response being sent: User logged out successfully for UserID: ${userid}`);
        res.json({ message: 'Logout successful!' });
    }
    catch(error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

// #endregion

// #region Orders

/**
 * POST /get-orders
 * 
 * This endpoint retrieves orders based on the provided ws_id and status.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.ws_id - Water Refilling Station Identification
 * @param {string} req.body.status - Status of the order e.g Accepted, On-Route, Completed, Cancelled
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response with the retrieved orders or an error message.
 */
router.post('/get-orders', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { ws_id, status } = req.body;

    if(!ws_id || !status) {
        Logs.warn(`Response being sent: Missing Required Data for Query! | status: 400` );
        return res.status(400).json({ error: 'Missing Required Data for Query!' });
    }

    try {

        const { result } = await db('Orders')
        .select('*')
        .where({ ws_id, status });

        if(!result) {
            Logs.error(`Empty Orders! | status: 200`);
            return res.status(200).json({ message: "Empty Orders!" });
        }
        
        res.status(200).json({ message: "Successfully retrieved orders!", data: result });
        Logs.http(`Response being sent: Successfully retrieved orders!`);
    }
    catch(error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

/**
 * POST /get-order-details
 * 
 * This endpoint retrieves the details of a specific order based on the provided order_id.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.order_id - ID of the order to retrieve
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response with the retrieved order details or an error message.
 */
router.post('/get-order-datails', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { order_id } = req.body;

    if(!order_id) {
        Logs.warn(`Response being sent: Missing Required Data for Query! | status: 400` );
        return res.status(400).json({ error: 'Missing Required Data for Query!' });
    }

    try {
        const result = await db('Orders')
        .select('*')
        .where({ order_id })
        .first();

        if(!result) {
            Logs.error(`Order doesn't Exists! | status: 404`);
            return res.status(404).json({ error: "Order doesn't Exists!" });
        }
        
        res.status(200).json({ message: "Successfully retrieved Order Details!", data: result });
        Logs.http(`Response being sent: Successfully retrieved Order Details!`);
    }
    catch(error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

/**
 * Handles POST requests to the /feedback endpoint.
 *
 * This endpoint receives feedback data from the request body, validates it,
 * and inserts it into the database. Logs are generated for the request and response.
 *
 * @param {Object} req - The request object from the client.
 * @param {Object} req.body - The body of the request containing feedback data.
 * @param {number} req.body.rating - The rating provided by the customer (1-5).
 * @param {string} req.body.comment - The comment provided by the customer.
 * @param {number} req.body.order_id - The ID of the related order.
 * @param {Object} req.headers - The headers of the request.
 * @param {string} req.ip - The IP address of the client.
 * @param {Object} req.socket - The socket object containing the remote address.
 * @param {Object} res - The response object to send the response back to the client.
 *
 * @returns {void} - Sends a JSON response with a success message or an error message.
 */
router.post('/feedback', async(req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { rating, comment, order_id } = req.body;

    if(!rating || !comment) {
        Logs.warn(`Response being sent: All Fields are require! | status: 400` );
        return res.status(400).json({ error: 'All Fields are require!' });
    }

    try {
        let query = {
            table: 'feedback',
            data: {
                feedback_rating : rating,
                feedback_description: comment,
                order_id: order_id,
            },
            field: 'feedback_id',
        }

        const [feedback] = await db(query.table)
            .insert(query.data)
            .returning([query.field]);

        res.json({ message: 'Successfully sent Feedback!' });
        Logs.http(`Response being sent: Successfully sent Feedback!`);
    }
    catch(error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

// #endregion

// #region QR Code

// 02-05-2025 3:16 PM

/**
 * POST /upload-qrcode-gcash
 * 
 * This endpoint uploads a GCash QR code for a specified water refilling station.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.station_id - ID of the water refilling station
 * @param {Object} req.file - Uploaded file object
 * @param {Buffer} req.file.buffer - Buffer containing the uploaded file data
 * @param {string} req.file.originalname - Original name of the uploaded file
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response indicating the upload status of the GCash QR code.
 */
router.post('/upload-qrcode-gcash', upload.single('gcash_qr'), async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { station_id } = req.body;

    const qrCodeFilePath = path.join(__dirname, 'public', station_id, 'img', 'qr', req.file.originalname);

    fs.writeFileSync(qrCodeFilePath, req.file.buffer);

    const qrCodeUrl = `/public/${station_id}/img/qr/${req.file.originalname}`;

    try {
        const result = await db('water_refilling_station')
        .where({ station_id })
        .update({ station_gcash_qr: qrCodeUrl });

        if(!result) {
            return res.status(404).json({ error: 'Water Refilling Station not Found!' });
            Logs.http(`Response being sent: Water Refilling Station not Found!`);
        }

        res.status(200).json({ message: 'QR code Uploaded Successfully!' });
        Logs.http(`Response being sent: QR code Uploaded Successfully!`);
    } catch (error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

/**
 * POST /upload-qrcode-maya
 * 
 * This endpoint uploads a PayMaya QR code for a specified water refilling station.
 * 
 * @async
 * @function
 * @param {Object} req - Express request object
 * @param {Object} req.body - Request body
 * @param {number} req.body.station_id - ID of the water refilling station
 * @param {Object} req.file - Uploaded file object
 * @param {Buffer} req.file.buffer - Buffer containing the uploaded file data
 * @param {string} req.file.originalname - Original name of the uploaded file
 * @param {Object} res - Express response object
 * 
 * @returns {Promise<void>} Sends a JSON response indicating the upload status of the PayMaya QR code.
 */
router.post('/upload-qrcode-maya', upload.single('maya_qr'), async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Body: ${JSON.stringify(req.body)}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    const { station_id } = req.body;

    const qrCodeFilePath = path.join(__dirname, 'public', station_id, 'img', 'qr', req.file.originalname);

    const qrCodeUrl = `/public/${station_id}/img/qr/${req.file.originalname}`;

    try {
        const result = await db('water_refilling_station')
        .where({ station_id })
        .update({ station_paymaya_qr: qrCodeUrl });

        if(!result) {
            return res.status(404).json({ error: 'Water Refilling Station not Found!' });
            Logs.http(`Response being sent: Water Refilling Station not Found!`);
        }

        res.status(200).json({ message: 'QR code Uploaded Successfully!' });
        Logs.http(`Response being sent: QR code Uploaded Successfully!`);
    } catch (error) {
        res.status(500).json({ error: error.message });
        Logs.error(`Response being sent: ${error.message}`);
    }
});

// #endregion

// #region Test

const serverStartTime = new Date();

router.get('/ping', async (req, res) => {
    Logs.http(`Received ${req.method} request to ${req.url}`);
    Logs.http(`Request Headers: ${JSON.stringify(req.headers)}`);
    Logs.http(`Incoming Remote Address: ${req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress}`);

    try
    {
        res.status(200).json({
            status: 'ok',
            running: 'True',
            message: 'Server is running',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            startedAt: serverStartTime.toISOString()
        });
    } catch(error) {
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
            error: error.message
        });
    }
});

// #endregion

module.exports = router;