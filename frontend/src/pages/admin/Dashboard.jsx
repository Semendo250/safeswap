import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
  getOverview,
  getNeedsAttention,
  getMoneyOverview,
  getTrends,
} from '../../api/admin.api';
import { PageShell, Tabs, btn, money } from '../../components/admin/AdminUi';

// ---------- helpers ----------

function loadError(err) {
  const status = err.response?.status;
  let message;
  if (!err.response) message = 'Network error. Check your connection and try again.';
  else if (status === 401) message = 'Your session has expired. Please log in again.';
  else if (status === 403) message = 'This page is for admins only.';
  else message = err.response?.data?.error || 'Could not load this section.';
  return status ? `${message} (status ${status})` : message;
}

function shortDate(key) {
  return new Date(`${key}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

const card = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  padding: 14,
  background: 'var(--color-surface)',
  boxSizing: 'border-box',
};

const linkReset = { textDecoration: 'none', color: 'inherit', display: 'block' };

function SectionTitle({ children }) {
  return <h3 style={{ margin: '26px 0 10px', fontSize: 16, textAlign: 'left' }}>{children}</h3>;
}

function SectionError({ children }) {
  return <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 8px' }}>{children}</p>;
}

function Muted({ children }) {
  return <p style={{ color: 'var(--color-muted)', fontSize: 13, margin: 0 }}>{children}</p>;
}

// ---------- charts (plain SVG, no extra packages) ----------

function BarChart({ data, color, format }) {
  const W = 300;
  const H = 90;
  const max = Math.max(1, ...data.map((d) => d.value));
  const gap = data.length > 14 ? 1.5 : 4;
  const bw = (W - gap * (data.length - 1)) / data.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img">
      {data.map((d, i) => {
        const h = d.value ? Math.max(2, (d.value / max) * (H - 4)) : 1;
        return (
          <rect
            key={d.date}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            rx={1.5}
            fill={color}
            opacity={d.value ? 1 : 0.25}
          >
            <title>{`${shortDate(d.date)}: ${format(d.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function ChartCard({ title, total, series, pick, color, format }) {
  const data = series.map((s) => ({ date: s.date, value: pick(s) }));
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color }}>{format(total)}</span>
      </div>
      <div style={{ margin: '10px 0 6px' }}>
        <BarChart data={data} color={color} format={format} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-muted)' }}>
        <span>{shortDate(data[0].date)}</span>
        <span>{shortDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

// ---------- page ----------

export default function Dashboard() {
  const { user, loading: authLoading } = useContext(AuthContext);

  const [overview, setOverview] = useState(null);
  const [attention, setAttention] = useState(null);
  const [moneyData, setMoneyData] = useState(null);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState(false);

  const [days, setDays] = useState(7);
  const [trends, setTrends] = useState(null);
  const [trendsError, setTrendsError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  // Summary, needs-attention and money. One failing section doesn't blank the page.
  useEffect(() => {
    // Wait until we know who is logged in before asking for admin data
    if (authLoading || !user) return;
    let cancelled = false;
    Promise.allSettled([getOverview(), getNeedsAttention(), getMoneyOverview()]).then(
      ([o, a, m]) => {
        if (cancelled) return;
        setOverview(o.status === 'fulfilled' ? o.value.data : null);
        setAttention(a.status === 'fulfilled' ? a.value.data : null);
        setMoneyData(m.status === 'fulfilled' ? m.value.data : null);
        setErrors({
          overview: o.status === 'rejected' ? loadError(o.reason) : '',
          attention: a.status === 'rejected' ? loadError(a.reason) : '',
          money: m.status === 'rejected' ? loadError(m.reason) : '',
        });
        setLoaded(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, reloadKey]);

  // Charts reload when you switch between 7 and 30 days
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    setTrendsError('');
    getTrends(days)
      .then((res) => {
        if (!cancelled) setTrends(res.data);
      })
      .catch((err) => {
        if (!cancelled) setTrendsError(loadError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, days, reloadKey]);

  if (authLoading) {
    return (
      <PageShell title="Admin dashboard">
        <Muted>Loading...</Muted>
      </PageShell>
    );
  }

  if (!user) {
    return (
      <PageShell title="Admin dashboard">
        <SectionError>Please log in as an admin to view this page.</SectionError>
      </PageShell>
    );
  }

  if (!loaded) {
    return (
      <PageShell title="Admin dashboard">
        <Muted>Loading...</Muted>
      </PageShell>
    );
  }

  // ----- needs attention -----
  const attentionItems = attention
    ? [
        { label: 'Listings waiting for review', count: attention.pendingListings, to: '/admin/flagged' },
        { label: 'Open reports', count: attention.openReports, to: '/admin/flagged' },
        { label: 'ID verifications waiting', count: attention.pendingVerifications, to: '/admin/verification' },
        { label: 'Payments held over 3 days', count: attention.heldOverThreeDays, to: '/admin/payments' },
        { label: 'Payments pending over 30 min', count: attention.stuckPending, to: '/admin/payments' },
      ]
    : [];
  const urgent = attentionItems.filter((i) => i.count > 0);

  // ----- summary cards -----
  const summaryCards = overview
    ? [
        { label: 'Active listings', value: overview.activeListings, to: '/admin/listings' },
        { label: 'Pending reviews', value: overview.pendingReviews, to: '/admin/flagged' },
        { label: 'Open reports', value: overview.openReports, to: '/admin/flagged' },
        { label: 'Signups today', value: overview.signupsToday, to: '/admin/users' },
      ]
    : [];

  // ----- money -----
  const moneyCards = moneyData
    ? [
        {
          label: 'Held (waiting for meetup)',
          amount: moneyData.held.total,
          sub: `${moneyData.held.count} payment${moneyData.held.count === 1 ? '' : 's'}`,
          color: 'var(--color-teal)',
        },
        {
          label: 'Released to sellers',
          amount: moneyData.released.total,
          sub: `${money(moneyData.released.last7)} in the last 7 days`,
          color: 'var(--color-success)',
        },
        {
          label: 'Refunded',
          amount: moneyData.refunded.total,
          sub: `${moneyData.refunded.count} payment${moneyData.refunded.count === 1 ? '' : 's'}`,
          color: 'var(--color-muted)',
        },
        {
          label: 'Pending / failed',
          amount: moneyData.pending.total,
          sub: `${moneyData.pending.count} pending, ${moneyData.failed.count} failed`,
          color: 'var(--color-gold)',
        },
      ]
    : [];

  // ----- chart totals -----
  const series = trends?.series || [];
  const sum = (key) => series.reduce((n, s) => n + s[key], 0);
  const count = (n) => String(n);

  return (
    <PageShell title="Admin dashboard" subtitle="What needs you today, where the money is, and how the app is growing.">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} style={btn('outline')}>
          Refresh
        </button>
      </div>

      {/* Needs attention */}
      <SectionTitle>Needs your attention</SectionTitle>
      {errors.attention ? (
        <SectionError>{errors.attention}</SectionError>
      ) : urgent.length === 0 ? (
        <div style={{ ...card, borderColor: 'var(--color-success)', background: 'var(--color-success-bg)' }}>
          <span style={{ fontSize: 14, color: 'var(--color-success)', fontWeight: 600 }}>
            All clear. Nothing is waiting on you.
          </span>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {urgent.map((i) => (
            <Link key={i.label} to={i.to} style={linkReset}>
              <div
                style={{
                  ...card,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  borderColor: 'var(--color-warning)',
                }}
              >
                <span style={{ fontSize: 14 }}>{i.label}</span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-warning)',
                    background: 'var(--color-warning-bg)',
                    borderRadius: 999,
                    padding: '2px 10px',
                  }}
                >
                  {i.count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Summary */}
      <SectionTitle>At a glance</SectionTitle>
      {errors.overview ? (
        <SectionError>{errors.overview}</SectionError>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {summaryCards.map((c) => (
            <Link key={c.label} to={c.to} style={linkReset}>
              <div style={card}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{c.label}</p>
                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700, color: 'var(--color-primary)' }}>
                  {c.value}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Money */}
      <SectionTitle>Money</SectionTitle>
      {errors.money ? (
        <SectionError>{errors.money}</SectionError>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {moneyCards.map((c) => (
            <Link key={c.label} to="/admin/payments" style={linkReset}>
              <div style={card}>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{c.label}</p>
                <p style={{ margin: '4px 0 2px', fontSize: 20, fontWeight: 700, color: c.color }}>
                  {money(c.amount)}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>{c.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Trends */}
      <SectionTitle>Trends</SectionTitle>
      <Tabs
        options={[
          [7, 'Last 7 days'],
          [30, 'Last 30 days'],
        ]}
        value={days}
        onChange={setDays}
      />
      {trendsError ? (
        <SectionError>{trendsError}</SectionError>
      ) : !trends || trends.days !== days ? (
        <Muted>Loading charts...</Muted>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
          <ChartCard
            title="New signups"
            total={sum('signups')}
            series={series}
            pick={(s) => s.signups}
            color="var(--color-primary)"
            format={count}
          />
          <ChartCard
            title="New listings"
            total={sum('listings')}
            series={series}
            pick={(s) => s.listings}
            color="var(--color-teal)"
            format={count}
          />
          <ChartCard
            title="Money paid in (held + released)"
            total={sum('paidAmount')}
            series={series}
            pick={(s) => s.paidAmount}
            color="var(--color-gold)"
            format={money}
          />
        </div>
      )}
    </PageShell>
  );
}
