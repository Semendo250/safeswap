import { getPasswordChecks } from '../utils/password';

const RULES = [
  { key: 'length', label: 'At least 8 characters' },
  { key: 'uppercase', label: 'One uppercase letter' },
  { key: 'lowercase', label: 'One lowercase letter' },
  { key: 'number', label: 'One number' },
  { key: 'special', label: 'One special character' },
];

export default function PasswordRequirements({ password }) {
  const checks = getPasswordChecks(password);

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {RULES.map((rule) => {
        const met = checks[rule.key];
        return (
          <li
            key={rule.key}
            style={{
              fontSize: '12px',
              color: met ? 'var(--color-success)' : 'var(--color-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>{met ? '✓' : '·'}</span>
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}