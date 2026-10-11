const BlacklistIMEI = require('../models/BlacklistIMEI');
const Listing = require('../models/Listing');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { isValidImeiFormat, isValidImeiChecksum } = require('../utils/imei');
const { notify } = require('../utils/notify');
const { getRiskForListings } = require('../utils/riskSignals');

const SOURCES = ['manual', 'police_report', 'user_report', 'other'];
const MAX_BULK = 500;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageParams(query, defaultLimit = 25) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

async function logAction(req, action, { targetId, summary, reason, meta } = {}) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType: 'blacklist',
      targetId: targetId ? String(targetId) : undefined,
      summary,
      reason: reason || undefined,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// Returns an error message, or null when the IMEI is acceptable
function imeiProblem(imei) {
  if (!isValidImeiFormat(imei)) return 'IMEI must be exactly 15 digits';
  if (!isValidImeiChecksum(imei)) {
    return 'IMEI fails the checksum check, so no phone could ever be listed with it';
  }
  return null;
}

function cleanSource(value) {
  if (!value) return 'manual';
  return SOURCES.includes(value) ? value : null;
}

// Existing listings with a newly blacklisted IMEI: mark them, and pull live ones
// back to review unless money is already held for them.
async function applyToListings(imeis, actorId) {
  const listings = await Listing.find({
    imei: { $in: imeis },
    status: { $in: ['active', 'under_review'] },
  })
    .select('seller title status')
    .lean();
  if (!listings.length) return { flaggedListings: 0, pulledListings: 0 };

  const ids = listings.map((l) => l._id);
  const heldRows = await Payment.find({ listing: { $in: ids }, status: 'held' })
    .select('listing')
    .lean();
  const heldSet = new Set(heldRows.map((p) => String(p.listing)));
  const toPull = listings.filter((l) => l.status === 'active' && !heldSet.has(String(l._id)));

  await Listing.updateMany({ _id: { $in: ids } }, { imeiStatus: 'blacklisted' });
  if (toPull.length) {
    await Listing.updateMany({ _id: { $in: toPull.map((l) => l._id) } }, { status: 'under_review' });
    await Promise.all(
      toPull.map((l) =>
        notify({
          userId: l.seller,
          actorId,
          type: 'listing_flagged',
          title: 'Your listing is under review',
          body: `"${l.title}": this device was flagged, so an admin will check it before it can go live.`,
          link: `/listings/${l._id}`,
        }).catch(() => {})
      )
    );
  }
  return { flaggedListings: ids.length, pulledListings: toPull.length };
}

// POST /api/admin/risk-signals  { ids: [listingId, ...] }
async function getRiskSignals(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(isId).slice(0, 50) : [];
    if (!ids.length) return res.json({ risk: {} });
    const listings = await Listing.find({ _id: { $in: ids } })
      .select('seller imei createdAt')
      .lean();
    res.json({ risk: await getRiskForListings(listings) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/blacklist?search=&source=&page=
async function getBlacklist(req, res) {
  try {
    const { search = '', source = 'all' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const query = {};
    if (source !== 'all') query.source = source;
    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ imei: rx }, { reason: rx }];
    }

    const [entries, total] = await Promise.all([
      BlacklistIMEI.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('addedBy', 'fullName')
        .lean(),
      BlacklistIMEI.countDocuments(query),
    ]);

    const imeis = entries.map((e) => e.imei);
    const counts = imeis.length
      ? await Listing.aggregate([
          { $match: { imei: { $in: imeis } } },
          { $group: { _id: '$imei', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [c._id, c.count]));

    res.json({
      entries: entries.map((e) => ({ ...e, listingCount: countMap.get(e.imei) || 0 })),
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/blacklist  { imei, reason, source }
async function addBlacklistImei(req, res) {
  try {
    const imei = String(req.body?.imei || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    const source = cleanSource(req.body?.source);

    if (!imei) return res.status(400).json({ error: 'imei is required' });
    const problem = imeiProblem(imei);
    if (problem) return res.status(400).json({ error: problem });
    if (!source) return res.status(400).json({ error: 'Invalid source' });

    if (await BlacklistIMEI.exists({ imei })) {
      return res.status(409).json({ error: 'IMEI already blacklisted' });
    }

    const entry = await BlacklistIMEI.create({
      imei,
      reason: reason || undefined,
      source,
      addedBy: req.user._id,
    });
    const effect = await applyToListings([imei], req.user._id);

    await logAction(req, 'blacklist.add', {
      targetId: entry._id,
      summary: `Blacklisted IMEI ${imei}`,
      reason,
      meta: { source, ...effect },
    });

    res.status(201).json({ entry, ...effect });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'IMEI already blacklisted' });
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/blacklist/bulk  { text, reason, source }
async function bulkAddBlacklist(req, res) {
  try {
    const raw = Array.isArray(req.body?.imeis)
      ? req.body.imeis.join('\n')
      : String(req.body?.text || '');
    const reason = String(req.body?.reason || '').trim().slice(0, 200);
    const source = cleanSource(req.body?.source);
    if (!source) return res.status(400).json({ error: 'Invalid source' });

    const tokens = [...new Set(raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean))];
    if (!tokens.length) return res.status(400).json({ error: 'Paste at least one IMEI' });
    if (tokens.length > MAX_BULK) {
      return res.status(400).json({ error: `Add at most ${MAX_BULK} IMEIs at a time` });
    }

    const invalid = [];
    const valid = [];
    tokens.forEach((t) => {
      if (imeiProblem(t)) invalid.push(t);
      else valid.push(t);
    });

    const existing = valid.length
      ? await BlacklistIMEI.find({ imei: { $in: valid } }).select('imei').lean()
      : [];
    const existingSet = new Set(existing.map((e) => e.imei));
    const duplicates = valid.filter((i) => existingSet.has(i));
    const toAdd = valid.filter((i) => !existingSet.has(i));

    let added = 0;
    let effect = { flaggedListings: 0, pulledListings: 0 };
    if (toAdd.length) {
      const docs = await BlacklistIMEI.insertMany(
        toAdd.map((imei) => ({
          imei,
          reason: reason || undefined,
          source,
          addedBy: req.user._id,
        })),
        { ordered: false }
      );
      added = docs.length;
      effect = await applyToListings(toAdd, req.user._id);
    }

    await logAction(req, 'blacklist.bulk', {
      summary: `Bulk blacklist: ${added} added, ${duplicates.length} already listed, ${invalid.length} invalid`,
      reason,
      meta: { source, added, duplicates: duplicates.length, invalid: invalid.length, ...effect },
    });

    res.status(201).json({
      added,
      duplicates: duplicates.slice(0, 50),
      duplicateCount: duplicates.length,
      invalid: invalid.slice(0, 50),
      invalidCount: invalid.length,
      ...effect,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/blacklist/:id
async function removeBlacklistImei(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const entry = await BlacklistIMEI.findByIdAndDelete(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });

    // Listings marked blacklisted only because of this entry go back to "clean".
    // They stay wherever they are (e.g. under review) until an admin decides.
    await Listing.updateMany({ imei: entry.imei, imeiStatus: 'blacklisted' }, { imeiStatus: 'clean' });

    await logAction(req, 'blacklist.remove', {
      targetId: entry._id,
      summary: `Removed IMEI ${entry.imei} from the blacklist`,
    });

    res.json({ message: 'Removed from blacklist' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getRiskSignals,
  getBlacklist,
  addBlacklistImei,
  bulkAddBlacklist,
  removeBlacklistImei,
};