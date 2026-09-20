const SAFE_ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

export default function SafeZonePicker({ value, onSelect }) {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
        Meet at a safe zone
      </label>
      <select
        value={value || ''}
        onChange={(e) => onSelect(e.target.value)}
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