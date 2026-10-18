import { useEffect, useState } from 'react';
import { getAuditLog, getAdminList } from '../../api/admin.api';
import OffersLog from '../../components/admin/OffersLog';
import { Tabs } from '../../components/admin/AdminUi';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  btn,
  errText,
  fmtDate,
  useDebounced,
} from '../../components/admin/AdminUi';

const ACTION_LABEL = {
  'announcement.send': 'Announcement sent',
  'announcement.delete': 'Announcement deleted',
  'listing.approve': 'Listing approved',
  'listing.remove': 'Listing removed',
  'verification.approve': 'Verification approved',
  'verification.reject': 'Verification rejected',
  'user.ban': 'User banned',
  'user.unban': 'User unbanned',
  'user.verify': 'User verified',
  'user.delete': 'User deleted',
  'payment.status': 'Payment status changed',
    'payment.expire': 'Old pending payments cleaned up',
  'blacklist.add': 'IMEI blacklisted',
  'blacklist.bulk': 'IMEIs blacklisted in bulk',
  'blacklist.remove': 'IMEI unblocked',
  'dispute.create': 'Complaint logged',
  'dispute.update': 'Complaint updated',
  'dispute.note': 'Complaint note added',
  'dispute.delete': 'Complaint deleted',
    'dispute.reply': 'Complaint reply sent',
  'user.message': 'Message sent to user',
  'safezone.add': 'Meetup spot added',
  'safezone.update': 'Meetup spot changed',
  'safezone.delete': 'Meetup spot deleted',
  'export.payments': 'Payments exported',
  'export.users': 'Users exported',
  'export.offers': 'Offers exported',
  'payment.review': 'Payment marked reviewed',
  'settings.offer_expiry': 'Offer expiry changed',
};

const CATEGORIES = [
  ['all', 'All actions'],
  ['user', 'Users (ban, verify, delete)'],
  ['listing', 'Listings'],
  ['verification', 'ID verification'],
  ['blacklist', 'IMEI blacklist'],
  ['payment', 'Payments'],
  ['announcement', 'Announcements'],
  ['dispute', 'Complaints'],
  ['safezone', 'Meetup spots'],
  ['export', 'CSV exports'],
  ['settings', 'Settings'],
];

// A readable label for an action code. Unknown codes are tidied up instead of shown raw.
function actionLabel(action) {
  if (!action) return 'Action';
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const text = String(action).replace(/[._]/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Chip colour by kind of action: red for removals, green for approvals, gold for money, teal otherwise
function actionTone(action) {
  const a = String(action || '');
  if (/\.(ban|delete|remove|reject)$/.test(a)) return 'warning';
  if (/\.(approve|verify|unban)$/.test(a)) return 'success';
  if (a.startsWith('payment.')) return 'gold';
  return 'teal';
}

function timeOf(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Which day an entry belongs to, for the group headings
function dayInfo(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return { key: 'unknown', label: 'Earlier', sub: '' };

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const key = d.toDateString();
  const dateText = d.toLocaleDateString([], { dateStyle: 'medium' });
  if (key === today.toDateString()) return { key, label: 'Today', sub: dateText };
  if (key === yesterday.toDateString()) return { key, label: 'Yesterday', sub: dateText };
  return { key, label: dateText, sub: '' };
}

function MetaItem({ label, children }) {
  return (
    <div className="act-meta-item">
      <span className="act-meta-label">{label}</span>
      <span className="act-meta-value">{children}</span>
    </div>
  );
}

function AdminActions() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [category, setCategory] = useState('all');
  const [admin, setAdmin] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [admins, setAdmins] = useState([]);
  const [data, setData] = useState({ entries: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminList()
      .then((res) => setAdmins(res.data.admins || []))
      .catch(() => setAdmins([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getAuditLog({ search: debounced, category, admin, from, to, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load the activity log.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, category, admin, from, to, page]);

  const filtersActive = !!debounced.trim() || category !== 'all' || admin !== 'all' || !!from || !!to;

  function clearFilters() {
    setSearch('');
    setCategory('all');
    setAdmin('all');
    setFrom('');
    setTo('');
    setPage(1);
  }

  function change(setter) {
    return (e) => {
      setter(e.target.value);
      setPage(1);
    };
  }

  // Entries arrive newest first; group neighbours that fall on the same day
  const groups = [];
  data.entries.forEach((e) => {
    const info = dayInfo(e.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === info.key) last.items.push(e);
    else groups.push({ ...info, items: [e] });
  });

  const subtitle = filtersActive
    ? `${data.total} matching ${data.total === 1 ? 'entry' : 'entries'}, newest first`
    : `Everything admins have changed, newest first (${data.total} ${data.total === 1 ? 'entry' : 'entries'})`;

  return (
    <PageShell title="Activity log" subtitle={subtitle}>
      <style>{`
        .act-filters { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0; }
        .act-filter { min-width: 0; }
        .act-filter-label {
          display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }

        .act-day { display: flex; align-items: baseline; gap: 8px; margin: 18px 0 10px; }
        .act-day:first-child { margin-top: 4px; }
        .act-day h3 { margin: 0; font-size: 15px; text-align: left; }
        .act-day-sub { font-size: 12px; color: var(--color-muted); }
        .act-day-count {
          margin-left: auto; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
          background: var(--color-surface); color: var(--color-muted); border: 1px solid var(--color-border);
        }

        .act-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 12px; background: var(--color-card);
        }
        .act-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .act-time { font-size: 12px; color: var(--color-muted); white-space: nowrap; }
        .act-summary { margin: 10px 0 0; font-size: 14px; word-break: break-word; }

        .act-meta {
          display: grid; grid-template-columns: auto 1fr; gap: 10px 32px;
          margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .act-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .act-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .act-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .act-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .act-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .act-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .act-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .act-meta { grid-template-columns: 1fr; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search summary, reason, admin name or ID"
        value={search}
        onChange={change(setSearch)}
      />

      <div className="act-filters">
        <div className="act-filter" style={{ flex: '1 1 170px', minWidth: 150 }}>
          <label className="act-filter-label">Type of action</label>
          <select value={category} onChange={change(setCategory)}>
            {CATEGORIES.map(([v, text]) => (
              <option key={v} value={v}>
                {text}
              </option>
            ))}
          </select>
        </div>
        <div className="act-filter" style={{ flex: '1 1 150px', minWidth: 140 }}>
          <label className="act-filter-label">Done by</label>
          <select value={admin} onChange={change(setAdmin)}>
            <option value="all">Any admin</option>
            {admins.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName}
              </option>
            ))}
          </select>
        </div>
        <div className="act-filter">
          <label className="act-filter-label">From</label>
          <input type="date" value={from} onChange={change(setFrom)} style={{ width: 'auto' }} />
        </div>
        <div className="act-filter">
          <label className="act-filter-label">To</label>
          <input type="date" value={to} onChange={change(setTo)} style={{ width: 'auto' }} />
        </div>
      </div>

      {filtersActive && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" onClick={clearFilters} style={btn('outline')}>
            Clear filters
          </button>
        </div>
      )}

      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.entries.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.entries.length === 0 && (
        <div className="act-empty">
          <div className="act-empty-icon">📋</div>
          <p className="act-empty-title">{filtersActive ? 'No entries match' : 'Nothing recorded yet'}</p>
          <p className="act-empty-text">
            {filtersActive ? 'Try a different search or clear the filters.' : 'Actions admins take will appear here.'}
          </p>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key}>
          <div className="act-day">
            <h3>{g.label}</h3>
            {g.sub && <span className="act-day-sub">{g.sub}</span>}
            <span className="act-day-count">{g.items.length}</span>
          </div>

          {g.items.map((e) => (
            <div key={e._id} className="act-card">
              <div className="act-head">
                <span title={e.action}>
                  <Chip tone={actionTone(e.action)}>{actionLabel(e.action)}</Chip>
                </span>
                <span className="act-time" title={fmtDate(e.createdAt)}>
                  {timeOf(e.createdAt)}
                </span>
              </div>

              <p className="act-summary">{e.summary}</p>

              <div className="act-meta">
                <MetaItem label="By">{e.adminName || 'Admin'}</MetaItem>
                {e.reason && <MetaItem label="Reason">{e.reason}</MetaItem>}
              </div>
            </div>
          ))}
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />
    </PageShell>
  );
}
export default function Activity() {
  const [tab, setTab] = useState('actions');

  return (
    <>
      <div className="admin-page-shell" style={{ margin: 0, padding: '20px 16px 0', boxSizing: 'border-box' }}>
        <Tabs
          options={[
            ['actions', 'Admin actions'],
            ['offers', 'Offers'],
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>
      {tab === 'actions' ? <AdminActions /> : <OffersLog />}
    </>
  );
}