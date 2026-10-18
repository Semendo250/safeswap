const Listing = require('../models/Listing');
const Report = require('../models/Report');
const User = require('../models/User');
const Offer = require('../models/Offer');
const mongoose = require('mongoose');

const DAY_MS = 24 * 60 * 60 * 1000;
const RAPID_MEDIUM = 3; // listings posted within 24 hours
const RAPID_HIGH = 5;
const LISTING_REPORTS_HIGH = 2; // reports on one listing
const SELLER_REPORTS_MEDIUM = 3; // reports against the seller overall

function sellerIdOf(l) {
  const s = l.seller;
  return s && s._id ? String(s._id) : s ? String(s) : null;
}

// listings: lean listing documents with _id, seller, imei, createdAt
// returns { [listingId]: { level: 'none' | 'medium' | 'high', signals: [{ code, severity, label }] } }
async function getRiskForListings(listings) {
  const result = {};
  if (!listings.length) return result;

  const ids = listings.map((l) => l._id);
  const sellerIds = [...new Set(listings.map(sellerIdOf).filter(Boolean))];
  const imeis = [...new Set(listings.filter((l) => l.imei).map((l) => l.imei))];
  const earliest = Math.min(...listings.map((l) => new Date(l.createdAt).getTime())) - DAY_MS;

  const [sameImei, sellerListings, reportRows, sellers, deepRows] = await Promise.all([
    imeis.length ? Listing.find({ imei: { $in: imeis } }).select('imei seller').lean() : [],
    Listing.find({ seller: { $in: sellerIds }, createdAt: { $gte: new Date(earliest) } })
      .select('seller createdAt')
      .lean(),
    Report.aggregate([
      { $match: { listing: { $in: ids } } },
      { $group: { _id: '$listing', count: { $sum: 1 } } },
    ]),
    User.find({ _id: { $in: sellerIds } }).select('reportCount').lean(),
    Offer.aggregate([
      {
        $match: {
          seller: { $in: sellerIds.map((s) => new mongoose.Types.ObjectId(s)) },
          createdAt: { $gte: new Date(Date.now() - 60 * DAY_MS) },
          acceptedAt: { $exists: true },
        },
      },
      { $match: { $expr: { $lte: ['$amount', { $multiply: ['$askingPrice', 0.6] }] } } },
      { $group: { _id: '$seller', count: { $sum: 1 } } },
    ]),
  ]);

  const imeiMap = new Map();
  sameImei.forEach((x) => {
    if (!imeiMap.has(x.imei)) imeiMap.set(x.imei, []);
    imeiMap.get(x.imei).push(x);
  });

  const timesBySeller = new Map();
  sellerListings.forEach((x) => {
    const k = String(x.seller);
    if (!timesBySeller.has(k)) timesBySeller.set(k, []);
    timesBySeller.get(k).push(new Date(x.createdAt).getTime());
  });

  const reportMap = new Map(reportRows.map((r) => [String(r._id), r.count]));
  const sellerReports = new Map(sellers.map((u) => [String(u._id), u.reportCount || 0]));
  const deepMap = new Map(deepRows.map((r) => [String(r._id), r.count]));

  listings.forEach((l) => {
    const signals = [];
    const sid = sellerIdOf(l);

    // 1. Same IMEI used on other listings
    if (l.imei) {
      const others = (imeiMap.get(l.imei) || []).filter((x) => String(x._id) !== String(l._id));
      if (others.length) {
        const otherSeller = others.some((o) => String(o.seller) !== sid);
        signals.push({
          code: 'duplicate_imei',
          severity: otherSeller ? 'high' : 'medium',
          label: `Same IMEI on ${others.length} other listing${others.length === 1 ? '' : 's'}${
            otherSeller ? ' (another seller)' : ''
          }`,
        });
      }
    }

    // 2. Posting many listings in a short time
    if (sid) {
      const end = new Date(l.createdAt).getTime();
      const count = (timesBySeller.get(sid) || []).filter((t) => t <= end && t > end - DAY_MS).length;
      if (count >= RAPID_MEDIUM) {
        signals.push({
          code: 'rapid_posting',
          severity: count >= RAPID_HIGH ? 'high' : 'medium',
          label: `Seller posted ${count} listings within 24 hours`,
        });
      }
    }

    // 3. Repeat reports
    const listingReports = reportMap.get(String(l._id)) || 0;
    if (listingReports >= LISTING_REPORTS_HIGH) {
      signals.push({
        code: 'repeat_reports',
        severity: 'high',
        label: `${listingReports} reports on this listing`,
      });
    }
    const sellerTotal = sid ? sellerReports.get(sid) || 0 : 0;
    if (sellerTotal >= SELLER_REPORTS_MEDIUM) {
      signals.push({
        code: 'seller_reports',
        severity: 'medium',
        label: `Seller has ${sellerTotal} reports against them`,
      });
    }

    const deep = sid ? deepMap.get(sid) || 0 : 0;
    if (deep >= 2) {
      signals.push({
        code: 'deep_discounts',
        severity: deep >= 4 ? 'high' : 'medium',
        label: `Seller agreed ${deep} offers 40% or more below asking in 60 days`,
      });
    }

    const level = signals.some((s) => s.severity === 'high')
      ? 'high'
      : signals.length
      ? 'medium'
      : 'none';
    result[String(l._id)] = { level, signals };
  });

  return result;
}

module.exports = { getRiskForListings };