const SafeZone = require('../models/SafeZone');

// The four spots that were hard-coded before. They are added to the database once, the first
// time zones are read, so nothing changes for your users until you edit them.
const DEFAULT_ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

async function ensureDefaults() {
  try {
    if ((await SafeZone.countDocuments()) > 0) return;
    await SafeZone.insertMany(
      DEFAULT_ZONES.map((name, i) => ({ name, order: i })),
      { ordered: false }
    );
  } catch (err) {
    // Two requests seeding at the same moment can clash on the unique name; that's harmless
    if (err.code !== 11000 && !err.writeErrors) console.error('Safe zone seeding failed:', err.message);
  }
}

async function getActiveZones() {
  await ensureDefaults();
  return SafeZone.find({ active: true }).sort({ order: 1, name: 1 }).lean();
}

async function getActiveZoneNames() {
  const zones = await getActiveZones();
  return zones.map((z) => z.name);
}

module.exports = { DEFAULT_ZONES, ensureDefaults, getActiveZones, getActiveZoneNames };