const Dispute = require('../models/Dispute');
const Listing = require('../models/Listing');
const { notify, notifyAdmins } = require('../utils/notify');

const DONE = ['resolved', 'closed'];

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// What a student is allowed to see of a conversation. Admin notes, assignee and priority stay private.
function shape(d) {
  const messages = [];
  if (d.details) {
    messages.push({ _id: 'first', from: 'student', senderName: null, text: d.details, createdAt: d.createdAt });
  }
  (d.messages || []).forEach((m) => {
    messages.push({
      _id: String(m._id),
      from: m.from,
      senderName: m.from === 'admin' ? m.senderName || null : null,
      text: m.text,
      createdAt: m.createdAt,
    });
  });
  return {
    _id: d._id,
    ref: d.ref,
    subject: d.subject,
    status: d.status,
    source: d.source,
    resolution: d.resolution || '',
    resolvedAt: d.resolvedAt || null,
    createdAt: d.createdAt,
    lastMessageAt: d.lastMessageAt || d.createdAt,
    lastMessageFrom: d.lastMessageFrom || null,
    canReply: !DONE.includes(d.status),
    messages,
  };
}

// POST /api/disputes  { subject, details }
async function submitDispute(req, res) {
  try {
    const subject = String(req.body?.subject || '').trim();
    const details = String(req.body?.details || '').trim();

    if (subject.length < 3 || subject.length > 120) {
      return res.status(400).json({ error: 'Subject must be 3 to 120 characters' });
    }
    if (details.length < 3 || details.length > 2000) {
      return res.status(400).json({ error: 'Please describe the problem (up to 2000 characters)' });
    }

    const recent = await Dispute.countDocuments({
      user: req.user._id,
      source: 'in_app',
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recent >= 5) {
      return res.status(429).json({ error: 'You have sent several messages already. Please wait an hour.' });
    }

    let listingRef;
    const rawListing = String(req.body?.listingId || '').trim();
    if (isId(rawListing)) {
      const l = await Listing.findById(rawListing).select('_id').lean();
      if (l) listingRef = l._id;
    }

    const dispute = await Dispute.createWithRef({
      source: 'in_app',
      subject,
      details,
      listing: listingRef,
      contactName: req.user.fullName,
      contactInfo: req.user.email,
      user: req.user._id,
      createdBy: req.user._id,
      lastMessageAt: new Date(),
      lastMessageFrom: 'student',
    });

    await notifyAdmins({
      type: 'new_dispute',
      title: 'New complaint',
      body: `${dispute.ref}: ${subject}`,
      link: '/admin/disputes',
      actorId: req.user._id,
    });

    res.status(201).json({ ref: dispute.ref, id: dispute._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/disputes/mine
async function getMine(req, res) {
  try {
    const list = await Dispute.find({ user: req.user._id }).sort({ updatedAt: -1 }).limit(50).lean();

    const disputes = list.map((d) => {
      const s = shape(d);
      const last = s.messages[s.messages.length - 1];
      return {
        _id: s._id,
        ref: s.ref,
        subject: s.subject,
        status: s.status,
        source: s.source,
        createdAt: s.createdAt,
        lastMessageAt: s.lastMessageAt,
        preview: last ? String(last.text).slice(0, 110) : '',
        count: s.messages.length,
        newReply: s.canReply && s.lastMessageFrom === 'admin',
      };
    });

    res.json({ disputes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/disputes/:id
async function getOne(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Conversation not found' });
    const d = await Dispute.findOne({ _id: req.params.id, user: req.user._id }).lean();
    if (!d) return res.status(404).json({ error: 'Conversation not found' });
    res.json({ dispute: shape(d) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/disputes/:id/messages  { text }
async function addMessage(req, res) {
  try {
    if (!isId(req.params.id)) return res.status(404).json({ error: 'Conversation not found' });

    const text = String(req.body?.text || '').trim();
    if (!text || text.length > 1000) {
      return res.status(400).json({ error: 'Message must be 1 to 1000 characters' });
    }

    const d = await Dispute.findOne({ _id: req.params.id, user: req.user._id });
    if (!d) return res.status(404).json({ error: 'Conversation not found' });

    if (DONE.includes(d.status)) {
      return res.status(409).json({
        error: 'This conversation is closed. Send a new message from the Support page if you still need help.',
      });
    }
    if (d.messages.length >= 200) {
      return res.status(400).json({ error: 'This conversation is too long. Send a new message from the Support page.' });
    }

    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const recent = d.messages.filter((m) => m.from === 'student' && new Date(m.createdAt).getTime() > tenMinAgo);
    if (recent.length >= 5) {
      return res.status(429).json({ error: 'You are sending messages too fast. Wait a few minutes and try again.' });
    }

    d.messages.push({ from: 'student', sender: req.user._id, senderName: req.user.fullName, text });
    d.lastMessageAt = new Date();
    d.lastMessageFrom = 'student';
    await d.save();

    const payload = {
      type: 'dispute_update',
      title: `New reply on ${d.ref}`,
      body: text.slice(0, 140),
      link: '/admin/disputes',
      actorId: req.user._id,
    };
    if (d.assignedTo) await notify({ ...payload, userId: d.assignedTo });
    else await notifyAdmins(payload);

    res.status(201).json({ dispute: shape(d.toObject()) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { submitDispute, getMine, getOne, addMessage };