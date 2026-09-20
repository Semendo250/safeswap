const BlacklistIMEI = require('../models/BlacklistIMEI');

function isValidImeiFormat(imei) {
  return /^\d{15}$/.test(imei);
}

// Standard Luhn checksum used to validate IMEI numbers
function isValidImeiChecksum(imei) {
  if (!isValidImeiFormat(imei)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(imei[i], 10);
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(imei[14], 10);
}

// Returns: 'invalid_format' | 'blacklisted' | 'clean'
async function checkImeiStatus(imei) {
  if (!isValidImeiChecksum(imei)) {
    return 'invalid_format';
  }
  const match = await BlacklistIMEI.findOne({ imei });
  return match ? 'blacklisted' : 'clean';
}

module.exports = { isValidImeiFormat, isValidImeiChecksum, checkImeiStatus };
