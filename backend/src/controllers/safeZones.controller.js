const SafeZone = require('../models/SafeZone');
const Listing = require('../models/Listing');
const AuditLog = require('../models/AuditLog');
const { ensureDefaults, getActiveZones } = require('../utils/safeZones');

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanName(v) {
  return String(v || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

async function nameClash(name, exceptId) {
  const query = { name: new RegExp(`^${escapeRegex(name)}$`, 'i') };
  if (exceptId) query._id = { $ne: exceptId };
  return SafeZone.findOne(query).select('_id').lean();
}

async function logAction(req, action, summary, targetId, meta) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType: 'safe_zone',
      targetId: targetId ? String(targetId) : undefined,
      summary,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// GET /api/listings/safe-zones  (public, used by the meetup picker)
async function getPublicZones(req, res) {
  try {
    const zones = await getActiveZones();
    res.json({ zones: zones.map((z) => z.name) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/safe-zones
async function adminList(req, res) {
  try {
    await ensureDefaults();
    const zones = await SafeZone.find().sort({ order: 1, name: 1 }).lean();
    const counts = zones.length
      ? await Listing.aggregate([
          { $match: { meetupSafeZone: { $in: zones.map((z) => z.name) } } },
          { $group: { _id: '$meetupSafeZone', count: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    res.json({ zones: zones.map((z) => ({ ...z, listingCount: countMap.get(z.name) || 0 })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/safe-zones  { name }
async function adminCreate(req, res) {
  try {
    await ensureDefaults();
    const name = cleanName(req.body?.name);
    if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (await nameClash(name)) return res.status(409).json({ error: 'A meetup spot with that name already exists' });

    const last = await SafeZone.findOne().sort({ order: -1 }).select('order').lean();
    const zone = await SafeZone.create({ name, order: last ? last.order + 1 : 0 });

    await logAction(req, 'safezone.add', `Added meetup spot "${name}"`, zone._id);
    res.status(201).json({ zone });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A meetup spot with that name already exists' });
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/safe-zones/:id  { name?, active? }
async function adminUpdate(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const zone = await SafeZone.findById(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Meetup spot not found' });

    const oldName = zone.name;
    let renamed = false;
    const notes = [];

    if (req.body?.name !== undefined) {
      const name = cleanName(req.body.name);
      if (name.length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
      if (name !== zone.name) {
        if (await nameClash(name, zone._id)) {
          return res.status(409).json({ error: 'A meetup spot with that name already exists' });
        }
        zone.name = name;
        renamed = true;
        notes.push(`renamed "${oldName}" to "${name}"`);
      }
    }

    if (typeof req.body?.active === 'boolean' && req.body.active !== zone.active) {
      if (!req.body.active) {
        const others = await SafeZone.countDocuments({ active: true, _id: { $ne: zone._id } });
        if (others < 1) {
          return res.status(400).json({ error: 'Keep at least one active meetup spot, or nobody can pick a place' });
        }
      }
      zone.active = req.body.active;
      notes.push(zone.active ? `showed "${zone.name}"` : `hid "${zone.name}"`);
    }

    if (!notes.length) return res.json({ zone });

    await zone.save();

    // Listings that already use the old name follow the rename
    if (renamed) await Listing.updateMany({ meetupSafeZone: oldName }, { meetupSafeZone: zone.name });

    await logAction(req, 'safezone.update', `Meetup spot: ${notes.join(', ')}`, zone._id);
    res.json({ zone });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'A meetup spot with that name already exists' });
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/admin/safe-zones/:id
async function adminDelete(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const zone = await SafeZone.findById(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Meetup spot not found' });

    if (zone.active) {
      const others = await SafeZone.countDocuments({ active: true, _id: { $ne: zone._id } });
      if (others < 1) {
        return res.status(400).json({ error: 'Keep at least one active meetup spot, or nobody can pick a place' });
      }
    }

    const used = await Listing.countDocuments({ meetupSafeZone: zone.name });
    if (used > 0) {
      return res.status(409).json({
        error: `${used} listing${used === 1 ? '' : 's'} use this spot. Hide it instead of deleting it.`,
      });
    }

    await zone.deleteOne();
    await logAction(req, 'safezone.delete', `Deleted meetup spot "${zone.name}"`, zone._id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getPublicZones, adminList, adminCreate, adminUpdate, adminDelete };