const Block = require('../models/Block');
const User = require('../models/User');

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// POST /api/blocks/:userId
async function blockUser(req, res) {
  try {
    const id = String(req.params.userId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid user' });
    if (id === String(req.user._id)) return res.status(400).json({ error: "You can't block yourself" });

    const target = await User.findById(id).select('role');
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'admin') return res.status(400).json({ error: "Admins can't be blocked" });

    await Block.updateOne(
      { blocker: req.user._id, blocked: id },
      { $setOnInsert: { blocker: req.user._id, blocked: id } },
      { upsert: true }
    );
    res.status(201).json({ blockedByMe: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/blocks/:userId
async function unblockUser(req, res) {
  try {
    const id = String(req.params.userId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid user' });
    await Block.deleteOne({ blocker: req.user._id, blocked: id });
    res.json({ blockedByMe: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/blocks/status/:userId
async function getBlockStatus(req, res) {
  try {
    const id = String(req.params.userId);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid user' });
    const blockedByMe = !!(await Block.exists({ blocker: req.user._id, blocked: id }));
    res.json({ blockedByMe });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { blockUser, unblockUser, getBlockStatus };