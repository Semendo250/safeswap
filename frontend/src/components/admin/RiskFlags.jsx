import { useEffect, useState } from 'react';
import { getRiskSignals } from '../../api/admin.api';
import { Chip } from './AdminUi';

// Loads risk signals for the listings on screen. If it fails, the page simply shows no flags.
export function useRisk(listings) {
  const [risk, setRisk] = useState({});
  const key = listings.map((l) => l._id).join(',');

  useEffect(() => {
    if (!key) {
      setRisk({});
      return;
    }
    let cancelled = false;
    getRiskSignals(key.split(','))
      .then((res) => {
        if (!cancelled) setRisk(res.data.risk || {});
      })
      .catch(() => {
        if (!cancelled) setRisk({});
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return risk;
}

export function RiskFlags({ risk }) {
  if (!risk || risk.level === 'none' || !risk.signals || !risk.signals.length) return null;
  const high = risk.level === 'high';
  return (
    <div
      style={{
        marginTop: 8,
        padding: '8px 10px',
        borderRadius: 8,
        background: high ? 'var(--color-warning-bg)' : 'var(--color-gold-bg)',
        display: 'grid',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: high ? 'var(--color-warning)' : 'var(--color-gold)' }}>
        {high ? 'High risk. Check before approving' : 'Worth a closer look'}
      </span>
      {risk.signals.map((s) => (
        <span key={s.code} style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip tone={s.severity === 'high' ? 'warning' : 'gold'}>{s.severity === 'high' ? 'High' : 'Medium'}</Chip>
          <span>{s.label}</span>
        </span>
      ))}
    </div>
  );
}