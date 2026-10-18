import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getOffersLog } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  errText,
  fmtDate,
  money,
  useDebounced,
  PAYMENT_TONE,
} from '../../components/admin/AdminUi';

const FILTERS = [
  ['all', 'All'],
  ['pending', 'Waiting'],
  ['agreed', 'Agreed'],
  ['declined', 'Declined'],
  ['expired', 'Expired'],
  ['paid', 'Paid'],
  ['unpaid', 'Agreed, unpaid'],
];
const FILTER_KEYS = FILTERS.map(([v]) => v);

const STATUS_LABEL = {
  pending: 'Waiting',
  accepted: 'Agreed',
  declined: 'Declined',
  replaced: 'Replaced',
  expired: 'Expired',
  closed: 'Closed',
  paid: 'Paid',
};
const STATUS_TONE = {
  pending: 'gold',
  accepted: 'success',
  declined: 'warning',
  replaced: 'muted',
  expired: 'muted',
  closed: 'muted',
  paid: 'teal',
};

function MetaItem({ label, children }) {
  return (
    <div className="ofr-meta-item">
      <span className="ofr-meta-label">{label}</span>
      <span className="ofr-meta-value">{children}</span>
    </div>
  );
}

function OfferCard({ o }) {
  const pct = o.askingPrice > 0 ? Math.round(((o.askingPrice - o.amount) / o.askingPrice) * 100) : 0;
  const wasAgreed = !!o.acceptedAt;

  return (
    <div className="ofr-card">
      <div className="ofr-top">
        <div className="ofr-main">
          {o.listing ? (
            <Link to={`/listings/${o.listing._id}`} className="ofr-title">
              {o.listing.title}
            </Link>
          ) : (
            <strong className="ofr-title">Deleted listing</strong>
          )}
          <div className="ofr-price">
            <span className="ofr-amount">{money(o.amount)}</span>
            {o.askingPrice !== o.amount && <span className="ofr-asking">{money(o.askingPrice)}</span>}
            {pct > 0 && <span className="ofr-pct">-{pct}%</span>}
          </div>
        </div>

        <div className="ofr-chips">
          <Chip tone={STATUS_TONE[o.status] || 'muted'}>{STATUS_LABEL[o.status] || o.status}</Chip>
          {wasAgreed && o.status !== 'accepted' && o.status !== 'paid' && <Chip tone="success">Was agreed</Chip>}
          {o.payment && (
            <Chip tone={PAYMENT_TONE[o.payment.status] || 'muted'}>Payment {o.payment.status}</Chip>
          )}
        </div>
      </div>

      <div className="ofr-meta">
        <MetaItem label="Buyer">{o.buyerName}</MetaItem>
        <MetaItem label="Seller">{o.sellerName}</MetaItem>
        <MetaItem label="Proposed by">{o.proposedByName}</MetaItem>
        <MetaItem label="Made">{fmtDate(o.createdAt)}</MetaItem>
        {wasAgreed && <MetaItem label="Agreed">{fmtDate(o.acceptedAt)}</MetaItem>}
        {o.status === 'pending' && o.expiresAt && <MetaItem label="Expires">{fmtDate(o.expiresAt)}</MetaItem>}
      </div>
    </div>
  );
}

export default function Offers() {
  const [params, setParams] = useSearchParams();
  const urlStatus = params.get('status');
  const status = FILTER_KEYS.includes(urlStatus) ? urlStatus : 'all';

  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ offers: [], counts: {}, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getOffersLog({ status, search: debounced, page })
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
  }, [status, debounced, page]);

  function changeStatus(v) {
    setParams(v === 'all' ? {} : { status: v }, { replace: true });
    setPage(1);
  }

  const counts = data.counts || {};
  const tabs = FILTERS.map(([v, label]) => [v, `${label} (${counts[v] || 0})`]);
  const filtersActive = !!debounced.trim() || status !== 'all';

  return (
    <PageShell
      title="Offers"
      subtitle="Price offers between buyers and sellers. View only: prices are agreed in the chat."
    >
      <style>{`
        .ofr-filter { display: flex; align-items: center; gap: 10px; }
        .ofr-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .ofr-filter > div:last-child { min-width: 0; flex: 1; }

        .ofr-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .ofr-top { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
        .ofr-main { min-width: 0; flex: 1; }
        a.ofr-title, strong.ofr-title {
          display: block; font-size: 15px; font-weight: 600; word-break: break-word; color: var(--color-ink);
        }
        a.ofr-title:hover { color: var(--color-teal); }
        .ofr-price { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 4px; }
        .ofr-amount { font-size: 16px; font-weight: 700; color: var(--color-primary); }
        .ofr-asking { font-size: 13px; color: var(--color-muted); text-decoration: line-through; }
        .ofr-pct {
          font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
          background: var(--color-gold-bg); color: var(--color-gold);
        }
        .ofr-chips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 220px; flex-shrink: 0; }

        .ofr-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .ofr-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .ofr-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .ofr-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .ofr-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .ofr-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .ofr-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .ofr-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .ofr-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .ofr-filter-label { width: auto; margin-top: 6px; }
          .ofr-top { flex-wrap: wrap; }
          .ofr-chips { justify-content: flex-start; max-width: none; flex-basis: 100%; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search listing, buyer or seller"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="ofr-filter">
        <span className="ofr-filter-label">Status</span>
        <Tabs options={tabs} value={status} onChange={changeStatus} />
      </div>

      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.offers.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && data.offers.length === 0 && (
        <div className="ofr-empty">
          <div className="ofr-empty-icon">🤝</div>
          <p className="ofr-empty-title">{filtersActive ? 'No offers match' : 'No offers yet'}</p>
          <p className="ofr-empty-text">
            {filtersActive ? 'Try a different filter or search.' : 'Offers made in the chat will be listed here.'}
          </p>
        </div>
      )}

      {data.offers.map((o) => (
        <OfferCard key={o._id} o={o} />
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />
    </PageShell>
  );
}