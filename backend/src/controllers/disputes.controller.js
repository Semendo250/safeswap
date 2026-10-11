const Dispute = require('../models/Dispute');
const { notifyAdmins } = require('../utils/notify');

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
      return res.status(429).json({ error: 'You have sent several complaints already. Please wait an hour.' });
    }

    const dispute = await Dispute.createWithRef({
      source: 'in_app',
      subject,
      details,
      contactName: req.user.fullName,
      contactInfo: req.user.email,
      user: req.user._id,
      createdBy: req.user._id,
    });

    await notifyAdmins({
      type: 'new_dispute',
      title: 'New complaint',
      body: `${dispute.ref}: ${subject}`,
      link: '/admin/disputes',
      actorId: req.user._id,
    });

    res.status(201).json({ ref: dispute.ref });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { submitDispute };