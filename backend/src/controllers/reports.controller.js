const Report = require('../models/Report');
const Listing = require('../models/Listing');

const REPORT_THRESHOLD = 3; // auto-flag after this many reports

// POST /api/reports
async function createReport(req, res) {
  try {
    const { listingId, reason, details } = req.body;

    if (!listingId || !reason) {
      return res.status(400).json({ error: 'listingId and reason are required' });
    }

    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const report = await Report.create({
      listing: listingId,
      reportedBy: req.user._id,
      reason,
      details,
    });

    // Bump the listing's report count and auto-flag if it hits the threshold
    listing.reportCount += 1;
    if (listing.reportCount >= REPORT_THRESHOLD && listing.status === 'active') {
      listing.status = 'under_review';
    }
    await listing.save();

    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reports (admin only - full list, newest first)
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