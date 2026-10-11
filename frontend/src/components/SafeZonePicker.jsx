import { useEffect, useState } from 'react';
import api from '../api/axios';

// Shown if the server can't be reached, so the picker never comes up empty
const FALLBACK_ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

// `locked` + `onLockedTap` are optional. When locked (e.g. the visitor is logged out),
// tapping the dropdown doesn't open it and calls onLockedTap instead.
export default function SafeZonePicker({ value, onSelect, locked = false, onLockedTap }) {
  const [zones, setZones] = useState(FALLBACK_ZONES);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/listings/safe-zones')
      .then((res) => {
        if (!cancelled && Array.isArray(res.data.zones) && res.data.zones.length) {
          setZones(res.data.zones);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // A spot an admin has since hidden still shows on the listing that already uses it
  const options = value && !zones.includes(value) ? [value, ...zones] : zones;

  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
        Meet at a safe zone
      </label>
      <select
        value={value || ''}
        onChange={(e) => onSelect(e.target.value)}
        onMouseDown={(e) => {
          if (locked) {
            e.preventDefault(); // keeps the dropdown from opening
            onLockedTap?.();
          }
        }}
        style={{ maxWidth: '260px' }}
      >
        <option value="" disabled>
          Select a meetup point
        </option>
        {options.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
    </div>
  );
}