const Report = require('../models/Report');
const Review = require('../models/Review');
const Block = require('../models/Block');
const Listing = require('../models/Listing');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { calculateTrustScore } = require('../utils/trustScore');
const { refreshSellerRating } = require('../utils/ratings');

const REPORT_STATUS = { pending: 'pending', upheld: 'reviewed_upheld', dismissed: 'reviewed_dismissed' };
const MULTI_BLOCK = 3;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageParams(query, defaultLimit = 15) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

async function logAction(req, action, { targetType, targetId, summary, reason, meta } = {}) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      summary,
      reason: reason || undefined,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// ---------- reports ----------

// GET /api/admin/reports?status=pending|upheld|dismissed|all&search=&page=
async function getReports(req, res) {
  try {
    const { status = 'pending', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const and = [];
    if (REPORT_STATUS[status]) and.push({ status: REPORT_STATUS[status] });

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const [users, listings] = await Promise.all([
        User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').limit(50).lean(),
        Listing.find({ title: rx }).select('_id').limit(50).lean(),
      ]);
      const or = [{ details: rx }];
      if (users.length) or.push({ reportedBy: { $in: users.map((u) => u._id) } });
      if (listings.length) or.push({ listing: { $in: listings.map((l) => l._id) } });
      and.push({ $or: or });
    }
    const query = and.length ? { $and: and } : {};

    const [reports, total, grouped] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'listing',
          select: 'title price status reportCount seller',
          populate: { path: 'seller', select: 'fullName' },
        })
        .populate('reportedBy', 'fullName email')
        .lean(),
      Report.countDocuments(query),
      Report.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = { pending: 0, upheld: 0, dismissed: 0, all: 0 };
    grouped.forEach((g) => {
      counts.all += g.count;
      if (g._id === 'pending') counts.pending = g.count;
      else if (g._id === 'reviewed_upheld') counts.upheld = g.count;
      else if (g._id === 'reviewed_dismissed') counts.dismissed = g.count;
    });

    res.json({
      reports: reports.map((r) => ({
        _id: r._id,
        reason: r.reason,
        details: r.details || '',
        status: r.status,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        listing: r.listing
          ? {
              _id: r.listing._id,
              title: r.listing.title,
              price: r.listing.price,
              status: r.listing.status,
              reportCount: r.listing.reportCount || 0,
              sellerName: r.listing.seller ? r.listing.seller.fullName : 'Deleted user',
            }
          : null,
        reporter: r.reportedBy
          ? { _id: r.reportedBy._id, fullName: r.reportedBy.fullName, email: r.reportedBy.email }
          : null,
      })),
      counts,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/reports/:id/resolve   { decision: 'uphold' | 'dismiss', reason }
async function resolveReport(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid report id' });

    const decision = String(req.body?.decision || '');
    if (!['uphold', 'dismiss'].includes(decision)) {
      return res.status(400).json({ error: 'Choose uphold or dismiss' });
    }
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason' });

    const report = await Report.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { status: decision === 'uphold' ? 'reviewed_upheld' : 'reviewed_dismissed' },
      { new: true }
    ).populate('listing', 'title seller');

    if (!report) {
      const exists = await Report.exists({ _id: id });
      return res
        .status(exists ? 409 : 404)
        .json({ error: exists ? 'This report was already handled' : 'Report not found' });
    }

    const listing = report.listing;
    const title = listing ? listing.title : 'a deleted listing';

    if (decision === 'uphold' && listing) {
      const seller = await User.findById(listing.seller);
      if (seller) {
        seller.reportCount += 1;
        seller.trustScore = calculateTrustScore(seller);
        await seller.save();
      }
    } else if (decision === 'dismiss' && listing) {
      await Listing.updateOne({ _id: listing._id, reportCount: { $gt: 0 } }, { $inc: { reportCount: -1 } });
    }

    await logAction(req, decision === 'uphold' ? 'report.uphold' : 'report.dismiss', {
      targetType: 'report',
      targetId: report._id,
      summary: `${decision === 'uphold' ? 'Upheld' : 'Dismissed'} a report on "${title}"`,
      reason,
      meta: { reason: report.reason },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- reviews ----------

// GET /api/admin/reviews?rating=all|1..5&search=&page=
async function getReviews(req, res) {
  try {
    const { rating = 'all', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const and = [];
    if (['1', '2', '3', '4', '5'].includes(String(rating))) and.push({ rating: Number(rating) });

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      const [users, listings] = await Promise.all([
        User.find({ $or: [{ fullName: rx }, { email: rx }] }).select('_id').limit(50).lean(),
        Listing.find({ title: rx }).select('_id').limit(50).lean(),
      ]);
      const or = [{ comment: rx }];
      if (users.length) {
        const ids = users.map((u) => u._id);
        or.push({ seller: { $in: ids } }, { reviewer: { $in: ids } });
      }
      if (listings.length) or.push({ listing: { $in: listings.map((l) => l._id) } });
      and.push({ $or: or });
    }
    const query = and.length ? { $and: and } : {};

    const [reviews, total, grouped] = await Promise.all([
      Review.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('seller', 'fullName')
        .populate('reviewer', 'fullName')
        .populate('listing', 'title')
        .lean(),
      Review.countDocuments(query),
      Review.aggregate([{ $group: { _id: '$rating', count: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    grouped.forEach((g) => {
      counts[g._id] = g.count;
      counts.all += g.count;
    });

    res.json({
      reviews: reviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment || '',
        createdAt: r.createdAt,
        sellerName: r.seller ? r.seller.fullName : 'Deleted user',
        reviewerName: r.reviewer ? r.reviewer.fullName : 'Deleted user',
        listing: r.listing ? { _id: r.listing._id, title: r.listing.title } : null,
      })),
      counts,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/reviews/:id   { reason }
async function deleteReview(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(400).json({ error: 'Invalid review id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) return res.status(400).json({ error: 'Please give a reason for deleting this review' });

    const review = await Review.findById(id).populate('seller', 'fullName').populate('reviewer', 'fullName');
    if (!review) return res.status(404).json({ error: 'Review not found' });

    const sellerId = review.seller ? review.seller._id : null;
    const sellerName = review.seller ? review.seller.fullName : 'a deleted user';
    const reviewerName = review.reviewer ? review.reviewer.fullName : 'a deleted user';
    await review.deleteOne();
    if (sellerId) await refreshSellerRating(sellerId);

    await logAction(req, 'review.delete', {
      targetType: 'review',
      targetId: id,
      summary: `Deleted a ${review.rating}-star review of ${sellerName} written by ${reviewerName}`,
      reason,
      meta: { rating: review.rating, comment: review.comment || null },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- blocks ----------

// GET /api/admin/blocks?view=multi|all|recent&page=
async function getBlocks(req, res) {
  try {
    const view = ['multi', 'all', 'recent'].includes(req.query.view) ? req.query.view : 'multi';
    const { page, limit, skip } = pageParams(req.query);

    const perUser = { $group: { _id: '$blocked', count: { $sum: 1 } } };
    const [totalBlocks, allRows, multiRows] = await Promise.all([
      Block.countDocuments(),
      Block.aggregate([perUser, { $count: 'n' }]),
      Block.aggregate([perUser, { $match: { count: { $gte: MULTI_BLOCK } } }, { $count: 'n' }]),
    ]);
    const counts = {
      recent: totalBlocks,
      all: allRows[0] ? allRows[0].n : 0,
      multi: multiRows[0] ? multiRows[0].n : 0,
    };
    const total = counts[view];
    const pages = Math.max(Math.ceil(total / limit), 1);

    if (view === 'recent') {
      const rows = await Block.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('blocker', 'fullName')
        .populate('blocked', 'fullName')
        .lean();
      return res.json({
        view,
        counts,
        total,
        page,
        pages,
        items: rows.map((b) => ({
          _id: b._id,
          blockerName: b.blocker ? b.blocker.fullName : 'Deleted user',
          blockedName: b.blocked ? b.blocked.fullName : 'Deleted user',
          createdAt: b.createdAt,
        })),
      });
    }

    const pipeline = [
      { $group: { _id: '$blocked', count: { $sum: 1 }, blockers: { $push: '$blocker' }, last: { $max: '$createdAt' } } },
    ];
    if (view === 'multi') pipeline.push({ $match: { count: { $gte: MULTI_BLOCK } } });
    pipeline.push({ $sort: { count: -1, last: -1 } }, { $skip: skip }, { $limit: limit });
    const rows = await Block.aggregate(pipeline);

    const ids = [...rows.map((r) => r._id), ...rows.flatMap((r) => r.blockers.slice(0, 5))];
    const users = await User.find({ _id: { $in: ids } }).select('fullName email isBanned').lean();
    const map = new Map(users.map((u) => [String(u._id), u]));

    res.json({
      view,
      counts,
      total,
      page,
      pages,
      items: rows.map((r) => {
        const u = map.get(String(r._id));
        const shown = r.blockers.slice(0, 5).map((b) => (map.get(String(b)) ? map.get(String(b)).fullName : 'Deleted user'));
        return {
          userId: String(r._id),
          name: u ? u.fullName : 'Deleted user',
          email: u ? u.email : '',
          isBanned: !!(u && u.isBanned),
          count: r.count,
          blockers: shown,
          more: Math.max(r.count - shown.length, 0),
          last: r.last,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getReports, resolveReport, getReviews, deleteReview, getBlocks };