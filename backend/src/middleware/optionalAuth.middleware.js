const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Like auth.middleware, but never blocks the request.
// Valid token -> req.user is set. Missing / invalid / expired / banned -> treated as logged out.
async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (user && !user.isBanned) req.user = user;
    }
  } catch (err) {
    // bad token: carry on as a logged-out visitor
  }
  next();
}

module.exports = optionalAuth;