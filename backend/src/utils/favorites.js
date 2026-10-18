const Favorite = require('../models/Favorite');
const { notify } = require('./notify');

const kes = (n) => `KES ${Number(n).toLocaleString('en-US')}`;

async function notifyPriceDrop(listing, oldPrice, newPrice) {
  const favs = await Favorite.find({ listing: listing._id, user: { $ne: listing.seller } })
    .select('user')
    .limit(500)
    .lean();
  for (const f of favs) {
    await notify({
      userId: f.user,
      type: 'price_drop',
      title: 'Price drop on a saved item',
      body: `"${listing.title}" dropped from ${kes(oldPrice)} to ${kes(newPrice)}.`,
      link: `/listings/${listing._id}`,
    });
  }
  await Favorite.updateMany({ listing: listing._id }, { lastSeenPrice: newPrice });
}

module.exports = { notifyPriceDrop };