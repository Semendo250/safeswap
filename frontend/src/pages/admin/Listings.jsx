import { useEffect, useState } from 'react';
import { getAllListings, approveListing, removeListing } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  ConfirmDialog,
  PhotoLightbox,
  btn,
  errText,
  fmtDate,
  money,
  useDebounced,
  LISTING_TONE,
} from '../../components/admin/AdminUi';
import { useRisk, RiskFlags } from '../../components/admin/RiskFlags';

const STATUS_TABS = [
  ['all', 'All'],
  ['active', 'Active'],
  ['under_review', 'Under review'],
  ['removed', 'Removed'],
  ['sold', 'Sold'],
];

const CATEGORY_TABS = [
  ['all', 'All types'],
  ['phone', 'Phones'],
  ['general', 'General'],
];

const IMEI_TONE = { clean: 'success', unchecked: 'muted', flagged: 'gold', blacklisted: 'warning' };

// A photo tile with the caption as a badge in the corner of the picture
function PhotoTile({ src, badge, label, onClick }) {
  return (
    <button type="button" className="lst-tile" onClick={onClick} aria-label={`View ${label}`}>
      <img src={src} alt={label} draggable={false} />
      <span className="lst-badge">{badge}</span>
    </button>
  );
}

// A value with a quiet "Copy" link next to it (long-press copying is switched off app-wide)
function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span style={{ color: 'var(--color-muted)' }}>-</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      // clipboard blocked by the browser
    }
  }

  return (
    <span className="lst-copywrap">
      <span className="lst-copytext">{value}</span>
      <button type="button" className="lst-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children }) {
  return (
    <div className="lst-meta-item">
      <span className="lst-meta-label">{label}</span>
      <span className="lst-meta-value">{children}</span>
    </div>
  );
}

function ListingCard({ l, risk, onView, onApprove, onRemove }) {
  const photos = l.photos || [];
  const images = [
    ...photos.map((src, i) => ({ src, label: `${l.title}: photo ${i + 1}` })),
    ...(l.proofPhoto
      ? [{ src: l.proofPhoto, label: `${l.title}: proof (IMEI + ID). Check IMEI matches ${l.imei || 'listed IMEI'}` }]
      : []),
  ];
  const seller = l.seller || null;
  const canApprove = l.status === 'under_review' || l.status === 'removed';
  const canRemove = l.status !== 'removed';

  return (
    <div className="lst-card">
      <div className="lst-top">
        {(photos[0] || l.proofPhoto) && (
          <div className="lst-photos">
            {photos[0] && (
              <PhotoTile
                src={photos[0]}
                label={l.title}
                badge={`${photos.length} photo${photos.length === 1 ? '' : 's'}`}
                onClick={() => onView(images, 0)}
              />
            )}
            {l.proofPhoto && (
              <PhotoTile
                src={l.proofPhoto}
                label="proof photo (IMEI + ID)"
                badge="Proof"
                onClick={() => onView(images, photos.length)}
              />
            )}
          </div>
        )}

        <div className="lst-main">
          <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{l.title}</strong>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', margin: '3px 0 8px' }}>
            {money(l.price)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip tone={LISTING_TONE[l.status] || 'muted'}>{l.status.replace('_', ' ')}</Chip>
            <Chip tone="muted">{l.category}</Chip>
            {l.category === 'phone' && <Chip tone={IMEI_TONE[l.imeiStatus] || 'muted'}>IMEI {l.imeiStatus}</Chip>}
            {l.reportCount > 0 && <Chip tone="warning">{l.reportCount} report{l.reportCount === 1 ? '' : 's'}</Chip>}
          </div>
        </div>

        {(canApprove || canRemove) && (
          <div className="lst-actions">
            {canApprove && (
              <button type="button" onClick={onApprove} style={btn('primary', { minWidth: 96 })}>
                Approve
              </button>
            )}
            {canRemove && (
              <button type="button" onClick={onRemove} style={btn('danger', { minWidth: 96 })}>
                Remove
              </button>
            )}
          </div>
        )}
      </div>

      <RiskFlags risk={risk} />

      <div className="lst-meta">
        <MetaItem label="Seller">
          {seller ? (
            <span>
              {seller.fullName}
              {seller.isBanned && <> <Chip tone="warning">Banned</Chip></>}
            </span>
          ) : (
            'Deleted user'
          )}
        </MetaItem>
        <MetaItem label="Listed">{fmtDate(l.createdAt)}</MetaItem>
        {seller && (
          <MetaItem label="Contact">
            <CopyValue value={seller.email} />
          </MetaItem>
        )}
        {seller && seller.phone && (
          <MetaItem label="Phone">
            <CopyValue value={seller.phone} />
          </MetaItem>
        )}
        {l.category === 'phone' && (
          <MetaItem label="IMEI">{l.imei ? <CopyValue value={l.imei} /> : 'Not given'}</MetaItem>
        )}
        {l.meetupSafeZone && (
          <MetaItem label="Meetup">
            {l.meetupSafeZone}
            {l.meetupConfirmed ? ' (confirmed)' : ''}
          </MetaItem>
        )}
      </div>
    </div>
  );
}

export default function Listings() {
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ listings: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [viewer, setViewer] = useState(null);

  const risk = useRisk(data.listings);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getAllListings({ search: debounced, status, category, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load listings.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, status, category, page, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function askApprove(l) {
    const r = risk[l._id];
    const imeiRisky = l.imeiStatus === 'blacklisted' || l.imeiStatus === 'flagged';
    const risky = imeiRisky || (r && r.level === 'high');
    if (!risky) {
      approveListing(l._id)
        .then(() => {
          setNotice(`"${l.title}" was approved.`);
          reload();
        })
        .catch((err) => setError(errText(err, 'Could not approve.')));
      return;
    }
    setDialog({
      title: `Approve "${l.title}"?`,
      message: imeiRisky
        ? `This phone's IMEI is ${l.imeiStatus}. Only approve it if you have checked the proof photo and are sure it is legitimate.`
        : 'This listing has high-risk signals (see the red box on the card). Only approve it if you have checked and are sure it is legitimate.',
      confirmLabel: 'Approve anyway',
      danger: true,
      askReason: 'required',
      onConfirm: async (reason) => {
        await approveListing(l._id, reason);
        setDialog(null);
        setNotice(`"${l.title}" was approved.`);
        reload();
      },
    });
  }

  function askRemove(l) {
    setDialog({
      title: `Remove "${l.title}"?`,
      message:
        'It disappears from the marketplace, pending reports against it are upheld, and the seller loses trust score. You can approve it again later.',
      confirmLabel: 'Remove listing',
      danger: true,
      askReason: 'optional',
      onConfirm: async (reason) => {
        await removeListing(l._id, reason);
        setDialog(null);
        setNotice(`"${l.title}" was removed.`);
        reload();
      },
    });
  }

  return (
    <PageShell title="All listings" subtitle={`${data.total} listing${data.total === 1 ? '' : 's'}`}>
      <style>{`
        .lst-filter { display: flex; align-items: center; gap: 10px; }
        .lst-filter-label {
          width: 52px; flex-shrink: 0; font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-muted);
        }
        .lst-filter > div:last-child { min-width: 0; flex: 1; }

        .lst-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .lst-top { display: flex; gap: 14px; align-items: flex-start; }
        .lst-photos { display: flex; gap: 8px; flex-shrink: 0; }
        .lst-main { min-width: 0; flex: 1; }
        .lst-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }

        button.lst-tile {
          position: relative; width: 96px; height: 96px; min-width: 0; padding: 0;
          align-self: auto; overflow: hidden; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-surface); cursor: zoom-in;
        }
        button.lst-tile:hover { background: var(--color-surface); border-color: var(--color-teal); }
        button.lst-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lst-badge {
          position: absolute; left: 4px; bottom: 4px; padding: 2px 7px; border-radius: 999px;
          background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 10px; font-weight: 600; line-height: 1.3;
        }

        .lst-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .lst-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .lst-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .lst-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .lst-copywrap { display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .lst-copytext { word-break: break-all; }
        button.lst-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.lst-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        @media (max-width: 600px) {
          .lst-filter { flex-direction: column; align-items: stretch; gap: 0; }
          .lst-filter-label { width: auto; margin-top: 6px; }
          .lst-top { flex-wrap: wrap; }
          .lst-main { flex: 1 1 140px; }
          .lst-actions { flex-direction: row; flex-basis: 100%; }
          button.lst-tile { width: 72px; height: 72px; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search title, IMEI or seller"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="lst-filter">
        <span className="lst-filter-label">Status</span>
        <Tabs
          options={STATUS_TABS}
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
        />
      </div>
      <div className="lst-filter">
        <span className="lst-filter-label">Type</span>
        <Tabs
          options={CATEGORY_TABS}
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        />
      </div>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.listings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.listings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No listings match.</p>}

      {data.listings.map((l) => (
        <ListingCard
          key={l._id}
          l={l}
          risk={risk[l._id]}
          onView={(images, index) => setViewer({ images, index })}
          onApprove={() => askApprove(l)}
          onRemove={() => askRemove(l)}
        />
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {viewer && <PhotoLightbox images={viewer.images} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}