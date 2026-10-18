const Listing = require('../models/Listing');
const Payment = require('../models/Payment');
const { notify } = require('./notify');
const { sweepOffers } = require('./offers');

const DAY_MS = 24 * 60 * 60 * 1000;
const LIFETIME_DAYS = 60;
const WARN_DAYS = 7;
const THROTTLE_MS = 10 * 60 * 1000;

let lastRun = 0;
let running = false;

function olderThan(date) {
  return { $or: [{ renewedAt: { $lt: date } }, { renewedAt: null, createdAt: { $lt: date } }] };
}

async function runExpirySweep() {
  const now = Date.now();
  const expireCut = new Date(now - LIFETIME_DAYS * DAY_MS);
  const warnCut = new Date(now - (LIFETIME_DAYS - WARN_DAYS) * DAY_MS);

  const due = await Listing.find({ status: 'active', ...olderThan(expireCut) })
    .select('_id seller title')
    .limit(200)
    .lean();
  for (const l of due) {
    const busy = await Payment.exists({ listing: l._id, status: { $in: ['pending', 'held'] } });
    if (busy) continue;
    const updated = await Listing.findOneAndUpdate({ _id: l._id, status: 'active' }, { status: 'expired' });
    if (!updated) continue;
    try {
      await sweepOffers({ listing: l._id });
    } catch (e) {
      console.error('sweepOffers failed:', e.message);
    }
    await notify({
      userId: l.seller,
      type: 'listing_expired',
      title: 'Your listing expired',
      body: `"${l.title}" is hidden from Browse. Open it and tap Renew to put it back.`,
      link: `/listings/${l._id}`,
    });
  }

  const soon = await Listing.find({ status: 'active', expiryWarned: { $ne: true }, ...olderThan(warnCut) })
    .select('_id seller title')
    .limit(200)
    .lean();
  for (const l of soon) {
    const marked = await Listing.findOneAndUpdate(
      { _id: l._id, status: 'active', expiryWarned: { $ne: true } },
      { expiryWarned: true }
    );
    if (!marked) continue;
    await notify({
      userId: l.seller,
      type: 'listing_expiring',
      title: 'Your listing expires in 7 days',
      body: `"${l.title}" will be hidden soon. Open it and tap Renew to keep it live.`,
      link: `/listings/${l._id}`,
    });
  }
}

async function maybeRunExpirySweep() {
  if (running || Date.now() - lastRun < THROTTLE_MS) return;
  running = true;
  lastRun = Date.now();
  try {
    await runExpirySweep();
  } finally {
    running = false;
  }
}

module.exports = { maybeRunExpirySweep, runExpirySweep };