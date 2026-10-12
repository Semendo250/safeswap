import { useState, useEffect } from 'react';
import { getFlaggedListings, approveListing, removeListing } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Notice,
  ConfirmDialog,
  PhotoLightbox,
  btn,
  errText,
  fmtDate,
  money,
} from '../../components/admin/AdminUi';
import { useRisk, RiskFlags } from '../../components/admin/RiskFlags';

const IMEI_TONE = { clean: 'success', unchecked: 'muted', flagged: 'gold', blacklisted: 'warning' };

// A photo tile with the caption as a badge in the corner of the picture
function PhotoTile({ src, badge, label, onClick }) {
  return (
    <button type="button" className="flg-tile" onClick={onClick} aria-label={`View ${label}`}>
      <img src={src} alt={label} draggable={false} />
      <span className="flg-badge">{badge}</span>
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
    <span className="flg-copywrap">
      <span className="flg-mono">{value}</span>
      <button type="button" className="flg-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children }) {
  return (
    <div className="flg-meta-item">
      <span className="flg-meta-label">{label}</span>
      <span className="flg-meta-value">{children}</span>
    </div>
  );
}

export default function FlaggedQueue() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const risk = useRisk(listings);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getFlaggedListings()
      .then((res) => {
        if (!cancelled) setListings(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load the queue.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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
      message: 'The seller is told it was not approved or was removed, and loses trust score.',
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
    <PageShell
      title="Flagged listings"
      subtitle={`${listings.length} waiting for review. Phones with risk signals are marked on the card.`}
    >
      <style>{`
        .flg-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .flg-top { display: flex; gap: 14px; align-items: flex-start; }
        .flg-photos { display: flex; gap: 8px; flex-shrink: 0; }
        .flg-main { min-width: 0; flex: 1; }
        .flg-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }

        button.flg-tile {
          position: relative; width: 96px; height: 96px; min-width: 0; padding: 0;
          align-self: auto; overflow: hidden; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-surface); cursor: zoom-in;
        }
        button.flg-tile:hover { background: var(--color-surface); border-color: var(--color-teal); }
        button.flg-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .flg-badge {
          position: absolute; left: 4px; bottom: 4px; padding: 2px 7px; border-radius: 999px;
          background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 10px; font-weight: 600; line-height: 1.3;
        }

        .flg-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .flg-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .flg-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .flg-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .flg-copywrap { display: inline-flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
        .flg-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; letter-spacing: 0.02em; }
        button.flg-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.flg-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        .flg-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .flg-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .flg-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .flg-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .flg-top { flex-wrap: wrap; }
          .flg-main { flex: 1 1 140px; }
          .flg-actions { flex-direction: row; flex-basis: 100%; }
          button.flg-tile { width: 72px; height: 72px; }
        }
      `}</style>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && listings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && !error && listings.length === 0 && (
        <div className="flg-empty">
          <div className="flg-empty-icon">✅</div>
          <p className="flg-empty-title">Nothing flagged right now</p>
          <p className="flg-empty-text">Listings that need a decision will show up here.</p>
        </div>
      )}

      {listings.map((l) => {
        const photos = l.photos || [];
        const images = [
          ...photos.map((src, i) => ({ src, label: `${l.title}: photo ${i + 1}` })),
          ...(l.proofPhoto
            ? [{ src: l.proofPhoto, label: `${l.title}: proof (IMEI + ID). Check IMEI matches ${l.imei || 'listed IMEI'}` }]
            : []),
        ];
        return (
          <div key={l._id} className="flg-card">
            <div className="flg-top">
              {(photos[0] || l.proofPhoto) && (
                <div className="flg-photos">
                  {photos[0] && (
                    <PhotoTile
                      src={photos[0]}
                      label={l.title}
                      badge={`${photos.length} photo${photos.length === 1 ? '' : 's'}`}
                      onClick={() => setViewer({ images, index: 0 })}
                    />
                  )}
                  {l.proofPhoto && (
                    <PhotoTile
                      src={l.proofPhoto}
                      label="proof photo (IMEI + ID)"
                      badge="Proof"
                      onClick={() => setViewer({ images, index: photos.length })}
                    />
                  )}
                </div>
              )}

              <div className="flg-main">
                <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{l.title}</strong>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', margin: '3px 0 8px' }}>
                  {money(l.price)}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <Chip tone="muted">{l.category}</Chip>
                  {l.category === 'phone' && <Chip tone={IMEI_TONE[l.imeiStatus] || 'muted'}>IMEI {l.imeiStatus}</Chip>}
                  {l.reportCount > 0 && (
                    <Chip tone="warning">{l.reportCount} report{l.reportCount === 1 ? '' : 's'}</Chip>
                  )}
                </div>
              </div>

              <div className="flg-actions">
                <button type="button" onClick={() => askApprove(l)} style={btn('primary', { minWidth: 96 })}>
                  Approve
                </button>
                <button type="button" onClick={() => askRemove(l)} style={btn('danger', { minWidth: 96 })}>
                  Remove
                </button>
              </div>
            </div>

            <RiskFlags risk={risk[l._id]} />

            <div className="flg-meta">
              <MetaItem label="Seller">{l.seller ? l.seller.fullName : 'Deleted user'}</MetaItem>
              <MetaItem label="Listed">{fmtDate(l.createdAt)}</MetaItem>
              {l.seller && <MetaItem label="Trust score">{l.seller.trustScore}</MetaItem>}
              {l.category === 'phone' && (
                <MetaItem label="IMEI">{l.imei ? <CopyValue value={l.imei} /> : 'Not given'}</MetaItem>
              )}
            </div>
          </div>
        );
      })}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {viewer && <PhotoLightbox images={viewer.images} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}