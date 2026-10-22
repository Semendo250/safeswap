import { useEffect, useState } from 'react';
import { getFeeTable } from '../api/fees.api';
import { feeQuote } from '../utils/fees';

// The fee table is loaded once and shared by every preview on the page
let cache = null;
let cachedAt = 0;
let inflight = null;

function loadTable() {
  if (cache && Date.now() - cachedAt < 60 * 1000) return Promise.resolve(cache);
  if (!inflight) {
    inflight = getFeeTable()
      .then((res) => {
        cache = res.data;
        cachedAt = Date.now();
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Shows a seller what they receive after the SafeSwap fee.
// approximate: true when the price may still change (an asking price, before any offer is agreed).
// compact: a one-line version for list cards.
// lead: optional wording that replaces the start of the sentence.
export default function FeePreview({
  category,
  amount,
  approximate = false,
  compact = false,
  lead: leadOverride,
  style,
}) {
  const [table, setTable] = useState(cache);

  useEffect(() => {
    let cancelled = false;
    loadTable()
      .then((t) => {
        if (!cancelled) setTable(t);
      })
      .catch(() => {
        // Not logged in, or the server is unreachable: show nothing
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = feeQuote(table, category, amount);
  if (!q) return null;

  const money = (n) => `KES ${Number(n).toLocaleString()}`;
  const strong = { color: 'var(--color-success)' };

  if (compact) {
    return (
      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.4, ...style }}>
        {q.fee > 0 ? (
          <>
            You'd receive about <strong style={strong}>{money(q.net)}</strong> after fees
          </>
        ) : (
          <>
            No fee: you'd receive <strong style={strong}>{money(q.net)}</strong>
          </>
        )}
      </p>
    );
  }

  const lead = leadOverride || (approximate ? "You'll receive about" : "You'll receive");

  return (
    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5, ...style }}>
      {q.fee > 0 ? (
        <>
          {lead} <strong style={strong}>{money(q.net)}</strong> after the {q.percent}% SafeSwap fee ({money(q.fee)}).
        </>
      ) : (
        <>
          No SafeSwap fee at this price. {lead} the full <strong style={strong}>{money(q.net)}</strong>.
        </>
      )}
    </p>
  );
}