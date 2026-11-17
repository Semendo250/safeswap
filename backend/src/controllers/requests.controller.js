const BuyRequest = require('../models/BuyRequest');
const RequestResponse = require('../models/RequestResponse');
const Listing = require('../models/Listing');
const { parsePrice } = require('../utils/offers');
const { notify, notifyAdmins } = require('../utils/notify');
const { isBlockedBetween } = require('../utils/blocks');
const {
  MAX_OPEN_PER_USER,
  MAX_RESPONSES,
  MAX_REPOSTS,
  keywordFrom,
  hasContactInfo,
  expiryFromNow,
} = require('../utils/requests');

const PERSON_FIELDS = 'fullName trustScore verificationPath completedSales profilePicture ratingAverage ratingCount';
const PAGE_SIZE = 20;
const CONTACT_ERROR = 'Please keep phone numbers, emails and links out of your request. Everything happens inside SafeSwap.';

const isId = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shapePerson(u) {
  if (!u || !u.fullName) return null;
  return {
    _id: u._id,
    fullName: u.fullName,
    trustScore: u.trustScore,
    verificationPath: u.verificationPath,
    completedSales: u.completedSales || 0,
    ratingAverage: u.ratingAverage || 0,
    ratingCount: u.ratingCount || 0,
    profilePicture: u.profilePicture || '',
  };
}

function shapeRequest(r, viewer, respondedSet) {
  const buyerId = r.buyer && r.buyer._id ? String(r.buyer._id) : String(r.buyer);
  return {
    _id: r._id,
    title: r.title,
    description: r.description || '',
    category: r.category,
    budget: r.budget,
    status: r.status,
    expired: r.status === 'open' && new Date(r.expiresAt) <= new Date(),
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    responseCount: r.responseCount || 0,
    repostCount: r.repostCount || 0,
    canRepost: r.status === 'removed' && (r.repostCount || 0) < MAX_REPOSTS,
    buyer: shapePerson(r.buyer),
    mine: !!viewer && buyerId === String(viewer._id),
    responded: respondedSet ? respondedSet.has(String(r._id)) : false,
  };
}

// POST /api/requests
async function createRequest(req, res) {
  try {
    if (req.user.role === 'admin') return res.status(403).json({ error: 'Admins cannot post requests' });

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || '');
    const budget = parsePrice(req.body?.budget);

    if (title.length < 3 || title.length > 100) {
      return res.status(400).json({ error: 'Title must be 3 to 100 characters' });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: 'Description can be up to 500 characters' });
    }
    if (!['phone', 'general'].includes(category)) {
      return res.status(400).json({ error: 'Choose a category' });
    }
    if (budget === null) {
      return res.status(400).json({ error: 'Budget must be a whole number of KES between 1 and 250,000' });
    }
    if (hasContactInfo(title) || hasContactInfo(description)) {
      return res.status(400).json({ error: CONTACT_ERROR });
    }

    const open = await BuyRequest.countDocuments({
      buyer: req.user._id,
      status: 'open',
      expiresAt: { $gt: new Date() },
    });
    if (open >= MAX_OPEN_PER_USER) {
      return res.status(409).json({
        error: `You can have up to ${MAX_OPEN_PER_USER} open requests. Close one before posting another.`,
      });
    }

    const doc = await BuyRequest.create({
      buyer: req.user._id,
      title,
      description,
      category,
      budget,
      keyword: keywordFrom(title),
      expiresAt: expiryFromNow(),
    });

    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/requests?category=&search=&sort=newest|budget|unanswered&page=
async function getRequests(req, res) {
  try {
    const { category, search = '', sort = 'newest' } = req.query;
    const filter = { status: 'open', expiresAt: { $gt: new Date() } };
    if (['phone', 'general'].includes(category)) filter.category = category;

    const term = String(search).trim().slice(0, 60);
    if (term) {
      const rx = new RegExp(escapeRegex(term), 'i');
      filter.$or = [{ title: rx }, { description: rx }];
    }

    const sorts = {
      newest: { createdAt: -1 },
      budget: { budget: -1, createdAt: -1 },
      unanswered: { responseCount: 1, createdAt: -1 },
    };
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const [items, total] = await Promise.all([
      BuyRequest.find(filter)
        .sort(sorts[sort] || sorts.newest)
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .populate('buyer', PERSON_FIELDS)
        .lean(),
      BuyRequest.countDocuments(filter),
    ]);

    const mineRows = items.length
      ? await RequestResponse.find({ request: { $in: items.map((r) => r._id) }, seller: req.user._id })
          .select('request')
          .lean()
      : [];
    const respondedSet = new Set(mineRows.map((m) => String(m.request)));

    res.json({
      requests: items.map((r) => shapeRequest(r, req.user, respondedSet)),
      total,
      page,
      pages: Math.max(Math.ceil(total / PAGE_SIZE), 1),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/requests/mine
async function getMyRequests(req, res) {
  try {
    const rows = await BuyRequest.find({ buyer: req.user._id }).sort({ createdAt: -1 }).limit(100).lean();
    res.json(
      rows.map((r) => ({
        ...shapeRequest({ ...r, buyer: null }, req.user, null),
        mine: true,
        removedReason: r.removedReason || '',
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/requests/:id   (offers are only shown to the person who asked, and to admins)
async function getRequestById(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(404).json({ error: 'Request not found' });

    const r = await BuyRequest.findById(id).populate('buyer', PERSON_FIELDS).lean();
    if (!r) return res.status(404).json({ error: 'Request not found' });

    const buyerId = r.buyer && r.buyer._id ? String(r.buyer._id) : String(r.buyer);
    const isOwner = buyerId === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (r.status === 'removed' && !isOwner && !isAdmin) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const out = shapeRequest(r, req.user, null);

    if (isOwner || isAdmin) {
      if (isOwner) out.removedReason = r.removedReason || '';
      const rows = await RequestResponse.find({ request: r._id })
        .sort({ createdAt: -1 })
        .populate('seller', PERSON_FIELDS)
        .populate('listing', 'title price photos status category')
        .lean();
      out.responses = rows.map((x) => ({
        _id: x._id,
        note: x.note || '',
        createdAt: x.createdAt,
        seller: shapePerson(x.seller),
        listing: x.listing
          ? {
              _id: x.listing._id,
              title: x.listing.title,
              price: x.listing.price,
              status: x.listing.status,
              category: x.listing.category,
              photo: x.listing.photos && x.listing.photos[0],
            }
          : null,
      }));
    } else {
      out.responded = !!(await RequestResponse.exists({ request: r._id, seller: req.user._id }));
    }

    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/requests/:id/respond   { listingId, note }
async function respond(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(404).json({ error: 'Request not found' });
    if (req.user.role === 'admin') return res.status(403).json({ error: 'Admins cannot respond to requests' });

    const listingId = String(req.body?.listingId || '');
    if (!isId(listingId)) return res.status(400).json({ error: 'Choose one of your listings' });
    const note = String(req.body?.note || '').trim();
    if (note.length > 300) return res.status(400).json({ error: 'Your note can be up to 300 characters' });
    if (hasContactInfo(note)) return res.status(400).json({ error: CONTACT_ERROR });

    const request = await BuyRequest.findById(id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'open' || request.expiresAt <= new Date()) {
      return res.status(409).json({ error: 'This request is no longer open' });
    }
    if (String(request.buyer) === String(req.user._id)) {
      return res.status(400).json({ error: "You can't respond to your own request" });
    }
    if (request.responseCount >= MAX_RESPONSES) {
      return res.status(409).json({ error: 'This request already has enough offers' });
    }
    if (await isBlockedBetween(String(req.user._id), String(request.buyer))) {
      return res.status(403).json({ error: "You can't respond to this request" });
    }

    const listing = await Listing.findOne({ _id: listingId, seller: req.user._id, status: 'active' }).select('title');
    if (!listing) return res.status(400).json({ error: 'That listing is not live, or it is not yours' });

    let response;
    try {
      response = await RequestResponse.create({
        request: request._id,
        seller: req.user._id,
        listing: listing._id,
        note,
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'You already offered this listing for this request' });
      }
      throw err;
    }

    await BuyRequest.updateOne({ _id: request._id }, { $inc: { responseCount: 1 } });

    await notify({
      userId: request.buyer,
      actorId: req.user._id,
      type: 'request_response',
      title: 'Someone has what you asked for',
      body: `${req.user.fullName} offered "${listing.title}" for your request "${request.title}".`,
      link: `/requests/${request._id}`,
    });

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/requests/:id/status   { status: 'fulfilled' | 'closed' }
async function setStatus(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(404).json({ error: 'Request not found' });
    const status = String(req.body?.status || '');
    if (!['fulfilled', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const r = await BuyRequest.findOneAndUpdate(
      { _id: id, buyer: req.user._id, status: 'open' },
      { status },
      { new: true }
    );
    if (!r) {
      const exists = await BuyRequest.exists({ _id: id, buyer: req.user._id });
      return res
        .status(exists ? 409 : 404)
        .json({ error: exists ? 'This request is already closed' : 'Request not found' });
    }
    res.json({ ok: true, status: r.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/requests/:id/repost   { title, description, category, budget }
async function repostRequest(req, res) {
  try {
    const id = String(req.params.id);
    if (!isId(id)) return res.status(404).json({ error: 'Request not found' });

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim();
    const category = String(req.body?.category || '');
    const budget = parsePrice(req.body?.budget);

    if (title.length < 3 || title.length > 100) {
      return res.status(400).json({ error: 'Title must be 3 to 100 characters' });
    }
    if (description.length > 500) {
      return res.status(400).json({ error: 'Description can be up to 500 characters' });
    }
    if (!['phone', 'general'].includes(category)) {
      return res.status(400).json({ error: 'Choose a category' });
    }
    if (budget === null) {
      return res.status(400).json({ error: 'Budget must be a whole number of KES between 1 and 250,000' });
    }
    if (hasContactInfo(title) || hasContactInfo(description)) {
      return res.status(400).json({ error: CONTACT_ERROR });
    }

    const current = await BuyRequest.findOne({ _id: id, buyer: req.user._id });
    if (!current) return res.status(404).json({ error: 'Request not found' });
    if (current.status !== 'removed') {
      return res.status(409).json({ error: 'Only removed requests can be reposted' });
    }
    if ((current.repostCount || 0) >= MAX_REPOSTS) {
      return res.status(409).json({
        error: 'This request has been reposted the maximum number of times. Please post a new one instead.',
      });
    }

    const open = await BuyRequest.countDocuments({
      buyer: req.user._id,
      status: 'open',
      expiresAt: { $gt: new Date() },
    });
    if (open >= MAX_OPEN_PER_USER) {
      return res.status(409).json({
        error: `You can have up to ${MAX_OPEN_PER_USER} open requests. Close one before reposting.`,
      });
    }

    const r = await BuyRequest.findOneAndUpdate(
      { _id: id, buyer: req.user._id, status: 'removed' },
      {
        $set: {
          title,
          description,
          category,
          budget,
          keyword: keywordFrom(title),
          status: 'open',
          expiresAt: expiryFromNow(),
        },
        $inc: { repostCount: 1 },
        $unset: { removedReason: 1 },
      },
      { new: true }
    );
    if (!r) return res.status(409).json({ error: 'This request was already reposted' });

    await notifyAdmins({
      type: 'request_reposted',
      title: 'A removed request was reposted',
      body: `${req.user.fullName} edited and reposted "${r.title}".`,
      link: '/admin/requests',
      actorId: req.user._id,
    });

    res.json(r);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createRequest,
  getRequests,
  getMyRequests,
  getRequestById,
  respond,
  setStatus,
  repostRequest,
};