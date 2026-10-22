const { getFeeRates, isFeeConfigured, FEE_BUCKETS } = require('../utils/financeSettings');

// GET /api/fees   (any logged-in user)
// The fee table, so sellers can see what they would receive after fees
async function getFeeTable(req, res) {
  try {
    const [rates, configured] = await Promise.all([getFeeRates(), isFeeConfigured()]);
    res.json({ configured, buckets: FEE_BUCKETS, rates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getFeeTable };