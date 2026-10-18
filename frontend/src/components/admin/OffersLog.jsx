import { useEffect, useState } from 'react';
import { getOffersLog, getOfferFlags, getSettings, setOfferExpiry } from '../../api/admin.api';
import ExportButton from './ExportButton';
import { PageShell, Chip, Pager, Notice, Tabs, btn, errText, fmtDate, money, useDebounced } from './AdminUi';

const OFFER_TONE = {
  pending: 'gold',
  accepted: 'success',
  declined: 'warning',
  replaced: 'muted',
  expired: 'muted',
  closed: 'muted',
  paid: 'teal',
};
const STATUS_OPTIONS = ['all', 'pending', 'accepted', 'declined', 'replaced', 'expired', 'closed', 'paid'];

const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
  background: 'var(--color-card)',
};
const label = {
  display: 'block',
  marginBottom: 2,
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-muted)',
};

function ExpiryCard() {
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getSettings()
      .then((res) => setHours(String(res.data.offerHours)))
      .catch((err) => setError(errText(err, 'Could not load the setting.')));
  }, []);

  async function save(e) {
    e.preventDefault();
    const n = Number(hours);
    if (!Number.isInteger(n) || n < 1 || n > 168) {
      setError('Enter a whole number of hours from 1 to 168');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await setOfferExpiry(n);
      setNotice(`Offers now expire after ${res.data.offerHours} hours. Offers already sent keep their old deadline.`);
    } catch (err) {
      setError(errText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} style={card}>
      <strong style={{ fontSize: 14 }}>Offer expiry</strong>
      <p style={{ margin: '4px 0 10px', fontSize: 12, color: 'var(--color-muted)' }}>
        How long an offer, or an agreed price, stays valid before it expires.
      </p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="number"
          min="1"
          max="168"
          step="1"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          style={{ width: 100 }}
        />
        <span style={{ fontSize: 13 }}>hours</span>
        <button type="submit" disabled={busy} style={btn('primary')}>
          {busy ? 'Saving...' : 'Save'}
        </button>
      </div>
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
    </form>
  );
}

function LogView() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState({ offers: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getOffersLog({ search: debounced, status, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load offers.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, status, page]);

  return (
    <>
      <input
        type="search"
        placeholder="Search buyer, seller or listing"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end', margin: '10px 0' }}>
        <div>
          <label style={label}>Status</label>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={label}>From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <div>
          <label style={label}>To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} />
        </div>
        <ExportButton
          kind="offers"
          label="Export offers CSV"
          params={{ status, from, to }}
          onDone={setNotice}
          onError={setError}
        />
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.offers.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.offers.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No offers match.</p>}

      {data.offers.map((o) => {
        const pct = o.askingPrice > 0 ? Math.round(((o.askingPrice - o.amount) / o.askingPrice) * 100) : 0;
        return (
          <div key={o._id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <strong style={{ fontSize: 14, wordBreak: 'break-word' }}>
                {o.listing ? o.listing.title : 'Deleted listing'}
              </strong>
              <Chip tone={OFFER_TONE[o.status] || 'muted'}>{o.status}</Chip>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>
              {money(o.amount)}
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-muted)', marginLeft: 8 }}>
                asking {money(o.askingPrice)}
                {pct > 0 ? ` · ${pct}% off` : ''}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 6 }}>
              {o.proposedByName} proposed · buyer {o.buyerName} · seller {o.sellerName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 2 }}>
              {fmtDate(o.createdAt)}
              {o.acceptedAt ? ` · agreed ${fmtDate(o.acceptedAt)}` : ''}
            </div>
          </div>
        );
      })}

      <Pager page={page} pages={data.pages} onPage={setPage} />
    </>
  );
}

function FlagList({ title, hint, rows, render }) {
  return (
    <div style={card}>
      <strong style={{ fontSize: 14 }}>{title}</strong>
      <p style={{ margin: '2px 0 8px', fontSize: 12, color: 'var(--color-muted)' }}>{hint}</p>
      {rows.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--color-success)' }}>Nothing unusual.</p>
      ) : (
        rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              padding: '6px 0',
              borderTop: i ? '1px solid var(--color-border)' : 'none',
              fontSize: 13,
            }}
          >
            <span>{render(r)}</span>
            <Chip tone="warning">{r.count}</Chip>
          </div>
        ))
      )}
    </div>
  );
}

function FlagsView() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getOfferFlags()
      .then((res) => setData(res.data))
      .catch((err) => setError(errText(err, 'Could not load the flags.')));
  }, []);

  if (error) return <Notice tone="warning">{error}</Notice>;
  if (!data) return <p style={{ color: 'var(--color-muted)' }}>Loading...</p>;

  return (
    <>
      <FlagList
        title="Many offers in a week"
        hint="Users who sent 10 or more offers in the last 7 days."
        rows={data.heavy}
        render={(r) => r.name}
      />
      <FlagList
        title="Repeated declined offers"
        hint="A buyer and seller pair with 3 or more declined offers in 30 days."
        rows={data.declines}
        render={(r) => `${r.buyerName} to ${r.sellerName}`}
      />
      <FlagList
        title="Buyers making very low offers"
        hint="5 or more offers below half the asking price in 30 days."
        rows={data.lowball}
        render={(r) => r.name}
      />
      <FlagList
        title="Sellers agreeing deep discounts"
        hint="2 or more agreed prices 40% or more below asking in 60 days. Worth checking on phones."
        rows={data.deepSellers}
        render={(r) => r.name}
      />
    </>
  );
}

export default function OffersLog() {
  const [view, setView] = useState('log');

  return (
    <PageShell title="Offers" subtitle="Every offer made in chat, unusual patterns, and the expiry setting.">
      <ExpiryCard />
      <Tabs
        options={[
          ['log', 'Offer log'],
          ['flags', 'Unusual patterns'],
        ]}
        value={view}
        onChange={setView}
      />
      {view === 'log' ? <LogView /> : <FlagsView />}
    </PageShell>
  );
}