const Announcement = require('../models/Announcement');
const Dispute = require('../models/Dispute');
const Notification = require('../models/Notification');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { notify, sendPush } = require('../utils/notify');

const SOURCES = ['whatsapp', 'email', 'in_app', 'other'];
const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high'];
const DONE = ['resolved', 'closed'];

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pageParams(query, defaultLimit = 15) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || defaultLimit, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
}

async function logAction(req, action, targetType, { targetId, summary, meta } = {}) {
  try {
    await AuditLog.create({
      admin: req.user._id,
      adminName: req.user.fullName,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      summary,
      meta,
    });
  } catch (err) {
    console.error('Audit log failed:', err.message);
  }
}

// ---------- announcements ----------

const audienceQuery = { isBanned: { $ne: true }, role: { $ne: 'admin' } };

// Sends the push notifications a few at a time, after the admin already has their answer
async function pushInBatches(ids, title, body, link) {
  const size = 20;
  for (let i = 0; i < ids.length; i += size) {
    await Promise.all(ids.slice(i, i + size).map((id) => sendPush(id, title, body, link, 'announcement')));
  }
}

// GET /api/admin/announcements
async function getAnnouncements(req, res) {
  try {
    const { page, limit, skip } = pageParams(req.query);
    const [items, total, audienceCount] = await Promise.all([
      Announcement.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Announcement.countDocuments(),
      User.countDocuments(audienceQuery),
    ]);
    res.json({ announcements: items, total, audienceCount, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/announcements  { title, body, link }
async function sendAnnouncement(req, res) {
  try {
    const title = String(req.body?.title || '').trim();
    const body = String(req.body?.body || '').trim();
    const link = String(req.body?.link || '').trim();

    if (title.length < 3 || title.length > 80) {
      return res.status(400).json({ error: 'Title must be 3 to 80 characters' });
    }
    if (body.length < 3 || body.length > 300) {
      return res.status(400).json({ error: 'Message must be 3 to 300 characters' });
    }
    if (link && (!/^\/[A-Za-z0-9\-._~\/?=&%#]*$/.test(link) || link.startsWith('//') || link.length > 200)) {
      return res.status(400).json({ error: 'Link must be a page inside the app, like /browse' });
    }

    // Stops a double click from sending the same broadcast twice
    const recent = await Announcement.findOne({
      sentBy: req.user._id,
      title,
      body,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    }).lean();
    if (recent) {
      return res.status(429).json({ error: 'You just sent this same announcement. Wait a couple of minutes.' });
    }

    const users = await User.find(audienceQuery).select('_id').lean();
    if (!users.length) return res.status(400).json({ error: 'There are no users to send to' });

    const announcement = await Announcement.create({
      title,
      body,
      link: link || undefined,
      recipientCount: users.length,
      sentBy: req.user._id,
      sentByName: req.user.fullName,
    });

    await Notification.insertMany(
      users.map((u) => ({
        user: u._id,
        type: 'announcement',
        title,
        body,
        link: link || undefined,
        meta: { announcementId: String(announcement._id) },
      })),
      { ordered: false }
    );

    await logAction(req, 'announcement.send', 'announcement', {
      targetId: announcement._id,
      summary: `Sent announcement "${title}" to ${users.length} users`,
      meta: { recipientCount: users.length },
    });

    res.status(201).json({ announcement, recipientCount: users.length });

    // Pushes go out in the background. The bell rows above are already saved.
    pushInBatches(
      users.map((u) => u._id),
      title,
      body,
      link || '/'
    ).catch((err) => console.error('Announcement push failed:', err.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
// DELETE /api/admin/announcements/:id  { reason }
// Removes the record and pulls the notification out of every student's bell.
// A push alert already delivered to a phone can't be recalled.
async function deleteAnnouncement(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const reason = String(req.body?.reason || '').trim().slice(0, 300);

    const a = await Announcement.findById(req.params.id);
    if (!a) return res.status(404).json({ error: 'Announcement not found' });

    const removed = await Notification.deleteMany({
      type: 'announcement',
      'meta.announcementId': String(a._id),
    });
    await a.deleteOne();

    await logAction(req, 'announcement.delete', 'announcement', {
      targetId: a._id,
      summary: `Deleted announcement "${a.title}" and removed ${removed.deletedCount} bell notifications${
        reason ? `. Reason: ${reason}` : ''
      }`,
      meta: { title: a.title, sentByName: a.sentByName || null, recipientCount: a.recipientCount },
    });

    res.json({ ok: true, removedNotifications: removed.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ---------- disputes ----------

const DISPUTE_POPULATE = [
  { path: 'assignedTo', select: 'fullName' },
  { path: 'user', select: 'fullName email' },
];

async function loadDispute(id) {
  return Dispute.findById(id).populate(DISPUTE_POPULATE).lean();
}

// GET /api/admin/admin-list  (admins you can assign a complaint to)
async function getAdminList(req, res) {
  try {
    const admins = await User.find({ role: 'admin' }).select('fullName').sort({ fullName: 1 }).lean();
    res.json({ admins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/disputes?status=&source=&assigned=&search=&page=
async function getDisputes(req, res) {
  try {
    const { status = 'all', source = 'all', assigned = 'all', search = '' } = req.query;
    const { page, limit, skip } = pageParams(req.query);

    const query = {};
    if (STATUSES.includes(status)) query.status = status;
    if (SOURCES.includes(source)) query.source = source;
    if (assigned === 'me') query.assignedTo = req.user._id;
    else if (assigned === 'unassigned') query.assignedTo = null;

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      query.$or = [{ ref: rx }, { subject: rx }, { details: rx }, { contactName: rx }, { contactInfo: rx }];
    }

    const [disputes, total, grouped] = await Promise.all([
      Dispute.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate(DISPUTE_POPULATE).lean(),
      Dispute.countDocuments(query),
      Dispute.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

    const counts = {};
    grouped.forEach((g) => {
      counts[g._id] = g.count;
    });

    res.json({ disputes, counts, total, page, pages: Math.max(Math.ceil(total / limit), 1) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/disputes
async function createDispute(req, res) {
  try {
    const b = req.body || {};
    const subject = String(b.subject || '').trim();
    const details = String(b.details || '').trim().slice(0, 2000);
    const contactName = String(b.contactName || '').trim().slice(0, 80);
    const contactInfo = String(b.contactInfo || '').trim().slice(0, 120);
    const userEmail = String(b.userEmail || '').trim().toLowerCase();
    const priority = PRIORITIES.includes(b.priority) ? b.priority : 'normal';

    if (subject.length < 3 || subject.length > 120) {
      return res.status(400).json({ error: 'Subject must be 3 to 120 characters' });
    }
    if (!SOURCES.includes(b.source)) return res.status(400).json({ error: 'Pick where the complaint came from' });

    let user = null;
    if (userEmail) {
      user = await User.findOne({ email: userEmail }).select('_id fullName').lean();
      if (!user) return res.status(404).json({ error: 'No user has that email. Clear the field or fix it.' });
    }

    let assignedTo = null;
    if (b.assignedTo) {
      if (!isId(b.assignedTo)) return res.status(400).json({ error: 'Invalid assignee' });
      const a = await User.findOne({ _id: b.assignedTo, role: 'admin' }).select('_id').lean();
      if (!a) return res.status(400).json({ error: 'You can only assign to an admin' });
      assignedTo = a._id;
    }

    const dispute = await Dispute.createWithRef({
      source: b.source,
      subject,
      details: details || undefined,
      contactName: contactName || (user ? user.fullName : undefined),
      contactInfo: contactInfo || undefined,
      user: user ? user._id : undefined,
      priority,
      assignedTo: assignedTo || undefined,
      createdBy: req.user._id,
    });

    await logAction(req, 'dispute.create', 'dispute', {
      targetId: dispute._id,
      summary: `Logged complaint ${dispute.ref}: ${subject} (${b.source})`,
    });

    if (assignedTo) {
      await notify({
        userId: assignedTo,
        actorId: req.user._id,
        type: 'dispute_update',
        title: 'Complaint assigned to you',
        body: `${dispute.ref}: ${subject}`,
        link: '/admin/disputes',
      });
    }

    res.status(201).json({ dispute: await loadDispute(dispute._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/disputes/:id  { status, priority, assignedTo, resolution }
async function updateDispute(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const d = await Dispute.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'Complaint not found' });

    const b = req.body || {};
    const changes = {};
    let newAssignee = null;
    let resolvedNow = false;

    if (b.priority !== undefined) {
      if (!PRIORITIES.includes(b.priority)) return res.status(400).json({ error: 'Invalid priority' });
      if (d.priority !== b.priority) {
        changes.priority = [d.priority, b.priority];
        d.priority = b.priority;
      }
    }

    if (b.assignedTo !== undefined) {
      const val = b.assignedTo || null;
      if (val) {
        if (!isId(val)) return res.status(400).json({ error: 'Invalid assignee' });
        const a = await User.findOne({ _id: val, role: 'admin' }).select('_id').lean();
        if (!a) return res.status(400).json({ error: 'You can only assign to an admin' });
      }
      if (String(d.assignedTo || '') !== String(val || '')) {
        changes.assignedTo = [d.assignedTo ? String(d.assignedTo) : null, val ? String(val) : null];
        d.assignedTo = val;
        newAssignee = val;
      }
    }

    if (typeof b.resolution === 'string') {
      const r = b.resolution.trim().slice(0, 500);
      if (r && r !== d.resolution) {
        d.resolution = r;
        changes.resolution = true;
      }
    }

    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return res.status(400).json({ error: 'Invalid status' });
      if (b.status !== d.status) {
        if (DONE.includes(b.status) && (d.resolution || '').trim().length < 3) {
          return res.status(400).json({ error: 'Write how it was resolved before closing the complaint' });
        }
        resolvedNow = DONE.includes(b.status) && !DONE.includes(d.status);
        changes.status = [d.status, b.status];
        d.status = b.status;
        d.resolvedAt = DONE.includes(b.status) ? new Date() : undefined;
      }
    }

    if (!Object.keys(changes).length) {
      return res.json({ dispute: await loadDispute(d._id) });
    }

    await d.save();

    await logAction(req, 'dispute.update', 'dispute', {
      targetId: d._id,
      summary: `Updated complaint ${d.ref}${changes.status ? `: ${changes.status[0]} -> ${changes.status[1]}` : ''}`,
      meta: changes,
    });

    if (newAssignee) {
      await notify({
        userId: newAssignee,
        actorId: req.user._id,
        type: 'dispute_update',
        title: 'Complaint assigned to you',
        body: `${d.ref}: ${d.subject}`,
        link: '/admin/disputes',
      });
    }
    if (resolvedNow && d.user) {
      await notify({
        userId: d.user,
        actorId: req.user._id,
        type: 'dispute_update',
        title: 'Your complaint was resolved',
        body: `${d.ref}: ${d.resolution}`.slice(0, 200),
        link: '/support',
      });
    }

    res.json({ dispute: await loadDispute(d._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/disputes/:id/notes  { text }
async function addDisputeNote(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const text = String(req.body?.text || '').trim();
    if (!text || text.length > 1000) return res.status(400).json({ error: 'Note must be 1 to 1000 characters' });

    const d = await Dispute.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'Complaint not found' });
    if (d.notes.length >= 100) return res.status(400).json({ error: 'This complaint has too many notes' });

    d.notes.push({ admin: req.user._id, adminName: req.user.fullName, text });
    await d.save();

    res.json({ dispute: await loadDispute(d._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
// DELETE /api/admin/disputes/:id  { reason }
async function deleteDispute(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });

    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Please give a reason for deleting this complaint' });
    }

    const d = await Dispute.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'Complaint not found' });
    if (!DONE.includes(d.status)) {
      return res.status(409).json({ error: 'Only resolved or closed complaints can be deleted. Close it first.' });
    }

    await d.deleteOne();

    await logAction(req, 'dispute.delete', 'dispute', {
      targetId: d._id,
      summary: `Deleted complaint ${d.ref}: ${d.subject}. Reason: ${reason}`,
      meta: { source: d.source, status: d.status, resolution: d.resolution || null },
    });

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getAnnouncements,
  sendAnnouncement,
  deleteAnnouncement,
  getAdminList,
  getDisputes,
  createDispute,
  updateDispute,
  addDisputeNote,
  deleteDispute,
};