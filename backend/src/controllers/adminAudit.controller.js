const AuditLog = require('../models/AuditLog');

// Action names look like "user.ban" or "payment.status". The part before the dot is the category.
const CATEGORIES = [
  'user',
  'listing',
  'verification',
  'blacklist',
  'payment',
  'announcement',
  'dispute',
  'safezone',
  'export',
  'settings',
];

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageParams(query, defaultLimit = 30) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

function dayStart(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}T00:00:00+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayEnd(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return null;
  const d = new Date(`${s}T23:59:59.999+03:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET /api/admin/audit-log?search=&category=&admin=&from=&to=&page=
async function getAuditLog(req, res) {
  try {
    const { search = '', category = 'all', admin = 'all', from = '', to = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const query = {};

    if (CATEGORIES.includes(category)) {
      query.action = new RegExp(`^${category}\\.`);
    }

    if (admin !== 'all') {
      if (!isId(admin)) return res.status(400).json({ error: 'Invalid admin' });
      query.admin = admin;
    }

    const start = dayStart(from);
    const end = dayEnd(to);
    if (from && !start) return res.status(400).json({ error: 'Invalid start date' });
    if (to && !end) return res.status(400).json({ error: 'Invalid end date' });
    if (start || end) {
      query.createdAt = {};
      if (start) query.createdAt.$gte = start;
      if (end) query.createdAt.$lte = end;
    }

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ summary: rx }, { reason: rx }, { adminName: rx }, { action: rx }, { targetId: rx }];
    }

    const [entries, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({ entries, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAuditLog };