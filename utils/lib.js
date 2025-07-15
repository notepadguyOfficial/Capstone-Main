const jwt = require('jsonwebtoken');
const crypto = require('crypto');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SECRET_KEY = process.env.SECRET_TOKEN;

const type_enum = [
    0, //Admin
    1, //Customer
    2, //Water Refilling Owner
    3 // Staff
];

const channels = [
    'LOGIN',
    'REGISTER',
    'CUSTOMER',
    'PRODUCT',
    'STAFF',
    'OWNER',
    'REFILLINGSTATION',
    'SALES'
]

/**
 * Generates a random secret key using cryptographically strong pseudo-random data.
 *
 * @param {number} size - The number of bytes to generate.
 * @param {string} encoding - The encoding to use for the output string (e.g., 'hex', 'base64').
 * @returns {string} A string representation of the generated secret key in the specified encoding.
 */
function SecretKey(size, encoding) {
    return crypto.randomBytes(size).toString(encoding);
}

/**
 * Generates a JSON Web Token (JWT) for authentication purposes.
 *
 * @param {string|number} id - The unique identifier of the user.
 * @param {number} type - The user type, corresponding to the index in the type_enum array.
 * @returns {string} A signed JWT containing the user's id and type, valid for 1 hour.
 */
function GenerateToken(id, type) {
    const payload = {id, type};
    // return jwt.sign(payload, SecretKey(32, 'hex'), {expiresIn: '1h'});
    return jwt.sign(payload, SECRET_KEY);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let folder;

    switch (parseInt(req.body.type)) {
      case 0:
        folder = "admin";
        break;
      case 1:
        folder = "customer";
        break;
      case 2:
        folder = "owner";
        break;
      case 3:
        folder = "staff";
        break;
    }
    const PROFILE_PATH =  path.join(__dirname, '../profile/images/', folder);
    cb(null, PROFILE_PATH);
  },
  filename: function(req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `profile_${req.body.id}${ext}`;
    cb(null, filename);
  }
});

const upload = multer({ storage: multer.memoryStorage() });

module.exports = {
    type_enum,
    GenerateToken,
    channels,
    upload
}
