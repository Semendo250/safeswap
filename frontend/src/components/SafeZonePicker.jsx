const SAFE_ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

// `locked` + `onLockedTap` are optional. When locked (e.g. the visitor is logged out),
// tapping the dropdown doesn't open it and calls onLockedTap instead.
export default function SafeZonePicker({ value, onSelect, locked = false, onLockedTap }) {
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
        {SAFE_ZONES.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </select>
    </div>
  );
}