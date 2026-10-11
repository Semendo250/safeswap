import { useState, useEffect } from 'react';
import { getFlaggedListings, approveListing, removeListing } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Notice,
  Field,
  ConfirmDialog,
  PhotoLightbox,
  Thumb,
  CopyText,
  btn,
  errText,
  fmtDate,
  money,
} from '../../components/admin/AdminUi';
import { useRisk, RiskFlags } from '../../components/admin/RiskFlags';

const IMEI_TONE = { clean: 'success', unchecked: 'muted', flagged: 'gold', blacklisted: 'warning' };

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
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && listings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && listings.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>Nothing flagged right now.</p>
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
          <div
            key={l._id}
            style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 10, background: 'var(--color-card)' }}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              {photos[0] && (
                <Thumb
                  src={photos[0]}
                  label={`${photos.length} photo${photos.length === 1 ? '' : 's'}`}
                  onClick={() => setViewer({ images, index: 0 })}
                />
              )}
              {l.proofPhoto && (
                <Thumb
                  src={l.proofPhoto}
                  label="Proof photo (IMEI + ID)"
                  onClick={() => setViewer({ images, index: photos.length })}
                />
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{l.title}</strong>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', margin: '2px 0 6px' }}>
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
            </div>

            <RiskFlags risk={risk[l._id]} />

            {l.category === 'phone' && (
              <div style={{ marginTop: 8 }}>
                <Field label="IMEI">{l.imei ? <CopyText value={l.imei} /> : 'Not given'}</Field>
              </div>
            )}
            <Field label="Seller">
              {l.seller ? `${l.seller.fullName} (trust score ${l.seller.trustScore})` : 'Deleted user'}
            </Field>
            <Field label="Listed">{fmtDate(l.createdAt)}</Field>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button type="button" onClick={() => askApprove(l)} style={btn('primary')}>
                Approve
              </button>
              <button type="button" onClick={() => askRemove(l)} style={btn('danger')}>
                Remove
              </button>
            </div>
          </div>
        );
      })}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {viewer && <PhotoLightbox images={viewer.images} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}