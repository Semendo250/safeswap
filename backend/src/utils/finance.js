const Payment = require('../models/Payment');
const Listing = require('../models/Listing');
const Settlement = require('../models/Settlement');
const { getFeeRates, rateFor } = require('./financeSettings');

const BATCH = 500;

// The payment status each kind of settlement belongs to
const EXPECTED_STATUS = { payout: 'released', refund: 'refunded' };

// Fee in whole KES, rounded to the nearest shilling and never more than the sale itself
function calcFee(gross, percent) {
  const g = Number(gross) || 0;
  const p = Number(percent) || 0;
  if (g <= 0 || p <= 0) return 0;
  return Math.min(g, Math.round((g * p) / 100));
}

function isDuplicateError(err) {
  if (!err) return false;
  if (err.code === 11000) return true;
  const list = err.writeErrors || (err.result && err.result.writeErrors);
  return (
    Array.isArray(list) &&
    list.length > 0 &&
    list.every((e) => e.code === 11000 || (e.err && e.err.code === 11000))
  );
}

// Released and refunded payments that don't have a settlement row yet get one
async function createMissingSettlements(rates) {
  for (let round = 0; round < 10; round += 1) {
    const rows = await Payment.aggregate([
      { $match: { status: { $in: ['released', 'refunded'] } } },
      {
        $lookup: {
          from: Settlement.collection.name,
          localField: '_id',
          foreignField: 'payment',
          as: '_s',
        },
      },
      { $match: { _s: { $size: 0 } } },
      { $limit: BATCH },
      {
        $lookup: {
          from: Listing.collection.name,
          localField: 'listing',
          foreignField: '_id',
          as: '_l',
        },
      },
    ]);
    if (!rows.length) return;

    const docs = rows.map((p) => {
      const l = p._l && p._l[0];
      // The amount the buyer actually paid, which is the agreed price when an offer was accepted
      const gross = Number(p.amount != null ? p.amount : l ? l.price : 0) || 0;
      const isRefund = p.status === 'refunded';
      const category = l ? l.category : undefined;
            const rate = isRefund ? 0 : rateFor(rates, category, gross);
      const fee = isRefund ? 0 : calcFee(gross, rate);
      const doc = {
        payment: p._id,
        type: isRefund ? 'refund' : 'payout',
        listing: p.listing,
        category,
        seller: l ? l.seller : undefined,
        buyer: p.buyer,
        gross,
        feePercent: rate,
        fee,
        net: gross - fee,
        status: 'due',
        eventAt: p.updatedAt || p.createdAt || new Date(),
      };
      // Nothing to send when no amount was ever recorded
      if (gross <= 0) {
        doc.status = 'paid';
        doc.note = 'No amount on record';
      }
      return doc;
    });

    try {
      await Settlement.insertMany(docs, { ordered: false });
    } catch (err) {
      // Another admin loaded the page at the same moment and created some of these first
      if (!isDuplicateError(err)) throw err;
    }
    if (rows.length < BATCH) return;
  }
}

// A payment that was released can later be refunded (and the other way round), or pulled back to
// held. Rows that are still waiting to be sent follow the payment. Rows already marked as paid are
// never changed here: the Finance page shows a warning on them instead.
async function reconcileDueSettlements(rates) {
  const stale = await Settlement.aggregate([
    { $match: { status: 'due' } },
    {
      $lookup: {
        from: Payment.collection.name,
        localField: 'payment',
        foreignField: '_id',
        as: '_p',
      },
    },
    {
      $addFields: {
        _ps: { $arrayElemAt: ['$_p.status', 0] },
        _pu: { $arrayElemAt: ['$_p.updatedAt', 0] },
      },
    },
    {
      $match: {
        $expr: {
          $ne: ['$_ps', { $cond: [{ $eq: ['$type', 'payout'] }, 'released', 'refunded'] }],
        },
      },
    },
    { $project: { type: 1, gross: 1, listing: 1, category: 1, _ps: 1, _pu: 1 } },
  ]);

  for (const s of stale) {
    if (s.type === 'payout' && s._ps === 'refunded') {
      await Settlement.updateOne(
        { _id: s._id, status: 'due' },
        { type: 'refund', feePercent: 0, fee: 0, net: s.gross, eventAt: s._pu || new Date() }
      );
    } else if (s.type === 'refund' && s._ps === 'released') {
      let category = s.category;
      if (!category && s.listing) {
        const l = await Listing.findById(s.listing).select('category').lean();
        category = l ? l.category : undefined;
      }
            const rate = rateFor(rates, category, s.gross);
      const fee = calcFee(s.gross, rate);
      const update = {
        type: 'payout',
        feePercent: rate,
        fee,
        net: s.gross - fee,
        eventAt: s._pu || new Date(),
      };
      if (category) update.category = category;
      await Settlement.updateOne({ _id: s._id, status: 'due' }, update);
    } else {
      // The payment went back to held, pending or failed (or was deleted): nothing is owed any more
      await Settlement.deleteOne({ _id: s._id, status: 'due' });
    }
  }
}

async function syncSettlements() {
  const rates = await getFeeRates();
  await reconcileDueSettlements(rates);
  await createMissingSettlements(rates);
}

module.exports = { syncSettlements, calcFee, EXPECTED_STATUS };