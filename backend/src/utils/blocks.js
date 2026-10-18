const Block = require('../models/Block');

async function isBlockedBetween(a, b) {
  return !!(await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  }));
}

module.exports = { isBlockedBetween };