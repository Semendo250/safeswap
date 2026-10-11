const Report = require('../models/Report');
const Listing = require('../models/Listing');
const { notify, notifyAdmins } = require('../utils/notify');

const REPORT_THRESHOLD = 3;

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

// POST /api/reports
async function createReport(req, res) {
  try {
    const { listingId, reason, details } = req.body;

    if (!listingId || !reason) {
      return res.status(400).json({ error: 'listingId and reason are required' });
    }
    if (!isId(String(listingId))) {
      return res.status(400).json({ error: 'Invalid listing id' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    if (String(listing.seller) === String(req.user._id)) {
      return res.status(400).json({ error: "You can't report your own listing" });
    }

    // One report per person per listing, so a single account can't push a listing
    // over the review threshold by itself
    const alreadyReported = await Report.exists({ listing: listingId, reportedBy: req.user._id });
    if (alreadyReported) {
      return res.status(409).json({ error: "You've already reported this listing" });
    }

    const report = await Report.create({
      listing: listingId,
      reportedBy: req.user._id,
      reason,
      details,
    });

    const wasActive = listing.status === 'active';
    listing.reportCount += 1;
    if (listing.reportCount >= REPORT_THRESHOLD && listing.status === 'active') {
      listing.status = 'under_review';
    }
    await listing.save();

    await notifyAdmins({
      type: 'new_report',
      title: 'New report to review',
      body: `"${listing.title}" was reported: ${String(reason).replace(/_/g, ' ')}.`,
      link: '/admin/flagged',
      actorId: req.user._id,
    });

    if (wasActive && listing.status === 'under_review') {
      await notify({
        userId: listing.seller,
        actorId: req.user._id,
        type: 'listing_flagged',
        title: 'Your listing is under review',
        body: `"${listing.title}" has been flagged for review after multiple reports.`,
        link: `/listings/${listing._id}`,
      });
    }

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reports (admin only)
async function getAllReports(req, res) {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate('listing', 'title status')
      .populate('reportedBy', 'fullName');
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { createReport, getAllReports, REPORT_THRESHOLD };