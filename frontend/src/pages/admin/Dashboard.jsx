import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import {
  getOverview,
  getNeedsAttention,
  getMoneyOverview,
  getTrends,
  getOffersStats,
  getCommunityStats,
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

function SectionTitle({ children, hint }) {
  return (
    <div className="dash-section">
      <h3>{children}</h3>
      {hint && <span className="dash-hint">{hint}</span>}
    </div>
  );
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
  if (data.length === 0) return null;
  return (
    <div className="dash-card">
      <div className="dash-chart-head">
        <span className="dash-chart-title">{title}</span>
        <span className="dash-chart-total" style={{ color }}>
          {format(total)}
        </span>
      </div>
      <div style={{ margin: '12px 0 6px' }}>
        <BarChart data={data} color={color} format={format} />
      </div>
      <div className="dash-chart-range">
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
  const [offersStats, setOffersStats] = useState(null);
  const [community, setCommunity] = useState(null);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const [days, setDays] = useState(7);
  const [trends, setTrends] = useState(null);
  const [trendsError, setTrendsError] = useState('');

  const [reloadKey, setReloadKey] = useState(0);

  // Summary, needs-attention and money. One failing section doesn't blank the page.
  useEffect(() => {
    // Wait until we know who is logged in before asking for admin data
    if (authLoading || !user) return;
    let cancelled = false;
    Promise.allSettled([getOverview(), getNeedsAttention(), getMoneyOverview(), getOffersStats(), getCommunityStats()]).then(
      ([o, a, m, f, c]) => {
        if (cancelled) return;
        setOverview(o.status === 'fulfilled' ? o.value.data : null);
        setAttention(a.status === 'fulfilled' ? a.value.data : null);
        setMoneyData(m.status === 'fulfilled' ? m.value.data : null);
        setOffersStats(f.status === 'fulfilled' ? f.value.data : null);
        setCommunity(c.status === 'fulfilled' ? c.value.data : null);
        setErrors({
          overview: o.status === 'rejected' ? loadError(o.reason) : '',
          attention: a.status === 'rejected' ? loadError(a.reason) : '',
          money: m.status === 'rejected' ? loadError(m.reason) : '',
          offers: f.status === 'rejected' ? loadError(f.reason) : '',
          community: c.status === 'rejected' ? loadError(c.reason) : '',
        });
        setUpdatedAt(new Date());
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
        { icon: '📝', label: 'Listings waiting for review', count: attention.pendingListings, to: '/admin/flagged' },
        { icon: '🚩', label: 'Open reports', count: attention.openReports, to: '/admin/reports' },
        { icon: '🪪', label: 'ID verifications waiting', count: attention.pendingVerifications, to: '/admin/verification' },
        { icon: '💳', label: 'Payments held over 3 days', count: attention.heldOverThreeDays, to: '/admin/payments' },
        { icon: '⏳', label: 'Payments pending over 30 min', count: attention.stuckPending, to: '/admin/payments' },
        { icon: '💬', label: 'Complaints waiting for a reply', count: attention.openDisputes, to: '/admin/disputes' },
        { icon: '🔎', label: 'Payments needing review', count: attention.reviewPayments, to: '/admin/payments' },
        { icon: '🏷️', label: 'Offer patterns to check', count: attention.offerFlags, to: '/admin/offers' },
      ]
    : [];
  const urgent = attentionItems.filter((i) => i.count > 0);

  // ----- summary cards -----
  const summaryCards = overview
    ? [
        { icon: '📋', label: 'Active listings', value: overview.activeListings, to: '/admin/listings' },
        { icon: '🔍', label: 'Pending reviews', value: overview.pendingReviews, to: '/admin/flagged', alert: true },
        { icon: '🚩', label: 'Open reports', value: overview.openReports, to: '/admin/reports', alert: true },
        { icon: '💬', label: 'Open complaints', value: attention ? attention.openDisputes || 0 : 0, to: '/admin/disputes', alert: true },
        { icon: '👤', label: 'Signups today', value: overview.signupsToday, to: '/admin/users' },
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

  const updatedText = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <PageShell title="Admin dashboard" subtitle="What needs you today, where the money is, and how the app is growing.">
      <style>{`
        .dash-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 10px; flex-wrap: wrap;
        }
        .dash-updated { font-size: 12px; color: var(--color-muted); }

        .dash-section { display: flex; align-items: baseline; gap: 8px; margin: 26px 0 10px; }
        .dash-section h3 { margin: 0; font-size: 16px; text-align: left; }
        .dash-hint { font-size: 12px; color: var(--color-muted); }

        a.dash-link { display: block; text-decoration: none; color: inherit; }
        a.dash-link:hover { text-decoration: none; }

        .dash-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          background: var(--color-card); box-sizing: border-box; transition: border-color 0.15s;
        }
        a.dash-link:hover .dash-card { border-color: var(--color-teal); }

        .dash-grid { display: grid; gap: 12px; }
        .dash-grid-stats { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
        .dash-grid-money { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
        .dash-grid-charts { grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
        .dash-grid-offers { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        @media (max-width: 900px) { .dash-grid-offers { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 480px) { .dash-grid-offers { grid-template-columns: 1fr; } }

        .dash-stat-label {
          display: flex; align-items: center; gap: 6px; margin: 0;
          font-size: 12px; color: var(--color-muted);
        }
        .dash-stat-value { margin: 6px 0 0; font-size: 26px; font-weight: 700; line-height: 1.1; }

        .dash-money { border-left: 3px solid var(--accent, var(--color-teal)); }
        .dash-money-label { margin: 0; font-size: 12px; color: var(--color-muted); }
        .dash-money-amount { margin: 6px 0 2px; font-size: 20px; font-weight: 700; line-height: 1.2; }
        .dash-money-sub { margin: 0; font-size: 12px; color: var(--color-muted); }

        .dash-attn-list { display: grid; gap: 8px; }
        .dash-attn {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          border: 1px solid var(--color-warning); border-radius: 12px;
          background: var(--color-card); transition: background 0.15s;
        }
        a.dash-link:hover .dash-attn { background: var(--color-warning-bg); }
        .dash-attn-icon { font-size: 18px; flex-shrink: 0; }
        .dash-attn-label { flex: 1; min-width: 0; font-size: 14px; }
        .dash-attn-count {
          font-size: 14px; font-weight: 700; color: var(--color-warning);
          background: var(--color-warning-bg); border-radius: 999px; padding: 2px 10px;
        }
        .dash-attn-arrow { color: var(--color-muted); font-size: 18px; line-height: 1; }

        .dash-clear {
          display: flex; align-items: center; gap: 10px; padding: 14px;
          border: 1px solid var(--color-success); border-radius: 12px;
          background: var(--color-success-bg); color: var(--color-success);
          font-size: 14px; font-weight: 600;
        }

        .dash-filter { display: flex; align-items: center; gap: 10px; }
        .dash-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .dash-filter > div:last-child { min-width: 0; flex: 1; }

        .dash-chart-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .dash-chart-title { font-size: 13px; font-weight: 600; }
        .dash-chart-total { font-size: 16px; font-weight: 700; }
        .dash-chart-range { display: flex; justify-content: space-between; font-size: 11px; color: var(--color-muted); }

        @media (max-width: 600px) {
          .dash-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .dash-filter-label { width: auto; margin-top: 6px; }
        }
      `}</style>

      <div className="dash-toolbar">
        <span className="dash-updated">{updatedText ? `Updated ${updatedText}` : ''}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} style={btn('outline')}>
          Refresh
        </button>
      </div>

      {/* Needs attention */}
      <SectionTitle hint={urgent.length > 0 ? `${urgent.length} item${urgent.length === 1 ? '' : 's'}` : ''}>
        Needs your attention
      </SectionTitle>
      {errors.attention ? (
        <SectionError>{errors.attention}</SectionError>
      ) : urgent.length === 0 ? (
        <div className="dash-clear">
          <span style={{ fontSize: 18 }}>✅</span>
          <span>All clear. Nothing is waiting on you.</span>
        </div>
      ) : (
        <div className="dash-attn-list">
          {urgent.map((i) => (
            <Link key={i.label} to={i.to} className="dash-link">
              <div className="dash-attn">
                <span className="dash-attn-icon">{i.icon}</span>
                <span className="dash-attn-label">{i.label}</span>
                <span className="dash-attn-count">{i.count}</span>
                <span className="dash-attn-arrow">›</span>
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
        <div className="dash-grid dash-grid-stats">
          {summaryCards.map((c) => (
            <Link key={c.label} to={c.to} className="dash-link">
              <div className="dash-card">
                <p className="dash-stat-label">
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </p>
                <p
                  className="dash-stat-value"
                  style={{ color: c.alert && c.value > 0 ? 'var(--color-warning)' : 'var(--color-primary)' }}
                >
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
        <div className="dash-grid dash-grid-money">
          {moneyCards.map((c) => (
            <Link key={c.label} to="/admin/payments" className="dash-link">
              <div className="dash-card dash-money" style={{ '--accent': c.color }}>
                <p className="dash-money-label">{c.label}</p>
                <p className="dash-money-amount" style={{ color: c.color }}>
                  {money(c.amount)}
                </p>
                <p className="dash-money-sub">{c.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}

            <SectionTitle hint="Last 30 days">Offers</SectionTitle>
      {errors.offers ? (
        <SectionError>{errors.offers}</SectionError>
      ) : offersStats ? (
        <div className="dash-grid dash-grid-offers">
          {[
            ['🏷️', 'Offers made', offersStats.made, '/admin/offers'],
            ['🤝', 'Prices agreed', offersStats.agreed, '/admin/offers?status=agreed'],
            ['📈', 'Acceptance rate', offersStats.acceptRate == null ? '-' : `${offersStats.acceptRate}%`, '/admin/offers?status=agreed'],
            ['✂️', 'Average discount', offersStats.avgDiscount == null ? '-' : `${offersStats.avgDiscount}%`, '/admin/offers?status=agreed'],
            ['💳', 'Agreed and paid', offersStats.paid, '/admin/offers?status=paid'],
            ['⌛', 'Expired unpaid', offersStats.unpaid, '/admin/offers?status=unpaid'],
          ].map(([icon, text, value, to]) => (
            <Link key={text} to={to} className="dash-link">
              <div className="dash-card">
                <p className="dash-stat-label">
                  <span>{icon}</span>
                  <span>{text}</span>
                </p>
                <p className="dash-stat-value" style={{ color: 'var(--color-primary)' }}>
                  {value}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}

      <SectionTitle hint="Reports, reviews, blocks and saved items">Community</SectionTitle>
      {errors.community ? (
        <SectionError>{errors.community}</SectionError>
      ) : community ? (
        <>
          <div className="dash-grid dash-grid-stats">
            {[
              ['🚩', 'Open reports', community.openReports, '/admin/reports', true],
              ['⭐', 'New reviews (7 days)', community.newReviews, '/admin/reviews', false],
              ['⏳', 'Listings expiring soon', community.expiringSoon, '/admin/listings?status=expiring', false],
              ['🚫', 'Users blocked 3+ times', community.multiBlocked, '/admin/blocks', true],
            ].map(([icon, text, value, to, alert]) => (
              <Link key={text} to={to} className="dash-link">
                <div className="dash-card">
                  <p className="dash-stat-label">
                    <span>{icon}</span>
                    <span>{text}</span>
                  </p>
                  <p
                    className="dash-stat-value"
                    style={{ color: alert && value > 0 ? 'var(--color-warning)' : 'var(--color-primary)' }}
                  >
                    {value}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {community.mostSaved.length > 0 && (
            <div className="dash-card" style={{ marginTop: 12 }}>
              <p className="dash-stat-label">
                <span>♥</span>
                <span>Most saved listings</span>
              </p>
              {community.mostSaved.map((l) => (
                <Link
                  key={l.listingId}
                  to={`/listings/${l.listingId}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 10,
                    padding: '8px 0',
                    borderTop: '1px solid var(--color-border)',
                    marginTop: 8,
                    fontSize: 13,
                    color: 'var(--color-ink)',
                  }}
                >
                  <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    {l.title} · {money(l.price)}
                  </span>
                  <strong>{l.count} saved</strong>
                </Link>
              ))}
            </div>
          )}

          <SectionTitle hint="Active users are people who messaged, offered, listed or paid in the last 7 days">
            App health
          </SectionTitle>
          <div className="dash-grid dash-grid-stats">
            {[
              ['🟢', 'Active users', community.activeUsers, '/admin/users'],
              ['🎉', 'Items sold', community.itemsSold, '/admin/listings?status=sold'],
              ['📵', 'Blocked IMEIs', community.blockedImeis, '/admin/blacklist'],
              ['🔔', 'Push alerts on', `${community.pushUsers} of ${community.pushTotal}`, '/admin/users'],
            ].map(([icon, text, value, to]) => (
              <Link key={text} to={to} className="dash-link">
                <div className="dash-card">
                  <p className="dash-stat-label">
                    <span>{icon}</span>
                    <span>{text}</span>
                  </p>
                  <p className="dash-stat-value" style={{ color: 'var(--color-primary)' }}>
                    {value}
                  </p>
                  {text === 'Items sold' && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-muted)' }}>
                      {community.itemsSold30} in the last 30 days
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {/* Trends */}
      <SectionTitle>Trends</SectionTitle>
      <div className="dash-filter">
        <span className="dash-filter-label">Period</span>
        <Tabs
          options={[
            [7, 'Last 7 days'],
            [30, 'Last 30 days'],
          ]}
          value={days}
          onChange={setDays}
        />
      </div>
      {trendsError ? (
        <SectionError>{trendsError}</SectionError>
      ) : !trends || trends.days !== days ? (
        <Muted>Loading charts...</Muted>
      ) : (
        <div className="dash-grid dash-grid-charts">
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