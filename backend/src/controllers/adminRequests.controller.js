const BuyRequest = require('../models/BuyRequest');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { notify } = require('../utils/notify');
const { expiryFromNow } = require('../utils/requests');

const DAY_MS = 24 * 60 * 60 * 1000;
const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageParams(query, defaultLimit = 15) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

async function logAction(req, action, { targetId, summary, reason } = {}) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType: 'request',
      targetId: targetId ? String(targetId) : undefined,
      summary,
      reason: reason || undefined,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

function statusFilter(status, now) {
  if (status === 'open') return { status: 'open', expiresAt: { $gt: now } };
  if (status === 'expired') return { status: 'open', expiresAt: { $lte: now } };
  if (['fulfilled', 'closed', 'removed'].includes(status)) return { status };
  return null;
}

// GET /api/admin/requests?status=open|expired|fulfilled|closed|removed|all&search=&keyword=&page=
async function getRequests(req, res) {
  try {
    const now = new Date();
    const { status = 'open', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const and = [];
    const sf = statusFilter(status, now);
    if (sf) and.push(sf);

    const keyword = String(req.query.keyword || '').trim().toLowerCase().slice(0, 80);
    if (keyword) and.push({ keyword });

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const users = await User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').limit(50).lean();
      const or = [{ title: rx }, { description: rx }];
      if (users.length) or.push({ buyer: { $in: users.map((u) => u._id) } });
      and.push({ $or: or });
    }
    const query = and.length ? { $and: and } : {};

    const [rows, total, open, expired, fulfilled, closed, removed, all] = await Promise.all([
      BuyRequest.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('buyer', 'fullName email trustScore isBanned')
        .lean(),
      BuyRequest.countDocuments(query),
      BuyRequest.countDocuments(statusFilter('open', now)),
      BuyRequest.countDocuments(statusFilter('expired', now)),
      BuyRequest.countDocuments({ status: 'fulfilled' }),
      BuyRequest.countDocuments({ status: 'closed' }),
      BuyRequest.countDocuments({ status: 'removed' }),
      BuyRequest.countDocuments({}),
    ]);

    res.json({
      requests: rows.map((r) => ({
        _id: r._id,
        title: r.title,
        description: r.description || '',
        category: r.category,
        budget: r.budget,
        status: r.status,
        effectiveStatus: r.status === 'open' && new Date(r.expiresAt) <= now ? 'expired' : r.status,
        responseCount: r.responseCount || 0,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
        removedReason: r.removedReason || '',
        buyer: r.buyer
          ? {
              _id: r.buyer._id,
              fullName: r.buyer.fullName,
              email: r.buyer.email,
              trustScore: r.buyer.trustScore,
              isBanned: !!r.buyer.isBanned,
            }
          : null,
      })),
      counts: { open, expired, fulfilled, closed, removed, all },
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/requests/top?days=7|30|90
async function getTopRequested(req, res) {
  try {
    const asked = parseInt(req.query.days, 10);
    const days = [7, 30, 90].includes(asked) ? asked : 30;
    const since = new Date(Date.now() - days * DAY_MS);
    const now = new Date();
    const match = { createdAt: { $gte: since }, status: { $ne: 'removed' } };
    const isOpen = { $and: [{ $eq: ['$status', 'open'] }, { $gt: ['$expiresAt', now] }] };

    const [top, categories, totals] = await Promise.all([
      BuyRequest.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$keyword',
            requests: { $sum: 1 },
            open: { $sum: { $cond: [isOpen, 1, 0] } },
            unanswered: {
              $sum: { $cond: [{ $and: [isOpen, { $eq: ['$responseCount', 0] }] }, 1, 0] },
            },
            responses: { $sum: '$responseCount' },
            avgBudget: { $avg: '$budget' },
            category: { $first: '$category' },
            title: { $first: '$title' },
            last: { $max: '$createdAt' },
          },
        },
        { $sort: { requests: -1, last: -1 } },
        { $limit: 10 },
      ]),
      BuyRequest.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
      BuyRequest.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            requests: { $sum: 1 },
            responses: { $sum: '$responseCount' },
            fulfilled: { $sum: { $cond: [{ $eq: ['$status', 'fulfilled'] }, 1, 0] } },
          },
        },
      ]),
    ]);

    const t = totals[0] || { requests: 0, responses: 0, fulfilled: 0 };
    const cat = { phone: 0, general: 0 };
    categories.forEach((c) => {
      cat[c._id] = c.count;
    });

    res.json({
      days,
      totals: { requests: t.requests, responses: t.responses, fulfilled: t.fulfilled },
      categories: cat,
      items: top.map((r) => ({
        keyword: r._id || '',
        title: r.title,
        category: r.category,
        requests: r.requests,
        open: r.open,
        unanswered: r.unanswered,
        responses: r.responses,
        avgBudget: Math.round(r.avgBudget || 0),
        last: r.last,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/requests/:id/remove   { reason }
async function removeRequest(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid request id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const r = await BuyRequest.findOneAndUpdate(
      { _id: id, status: { $ne: 'removed' } },
      { status: 'removed', removedReason: reason },
      { new: true }
    );
    if (!r) {
      const exists = await BuyRequest.exists({ _id: id });
      return res
        .status(exists ? 409 : 404)
        .json({ error: exists ? 'This request is already removed' : 'Request not found' });
    }

    await logAction(req, 'request.remove', {
      targetId: r._id,
      summary: `Removed the request "${r.title}"`,
      reason,
    });
    await notify({
      userId: r.buyer,
      actorId: req.user._id,
      type: 'request_removed',
      title: 'Your request was removed',
      body: `"${r.title}" was removed by an admin: ${reason}`,
      link: '/requests',
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/requests/:id/restore   { reason }
async function restoreRequest(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid request id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const r = await BuyRequest.findOneAndUpdate(
      { _id: id, status: 'removed' },
      { status: 'open', expiresAt: expiryFromNow(), $unset: { removedReason: 1 } },
      { new: true }
    );
    if (!r) {
      const exists = await BuyRequest.exists({ _id: id });
      return res
        .status(exists ? 409 : 404)
        .json({ error: exists ? 'This request is not removed' : 'Request not found' });
    }

    await logAction(req, 'request.restore', {
      targetId: r._id,
      summary: `Restored the request "${r.title}"`,
      reason,
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getRequests, getTopRequested, removeRequest, restoreRequest };