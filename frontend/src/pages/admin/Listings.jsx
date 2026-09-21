import { useEffect, useState } from 'react';
import { getAllListings, approveListing, removeListing } from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Pager,
  Notice,
  Tabs,
  Field,
  ConfirmDialog,
  PhotoLightbox,
  Thumb,
  CopyText,
  btn,
  errText,
  fmtDate,
  money,
  useDebounced,
  LISTING_TONE,
} from '../../components/admin/AdminUi';

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

function ListingCard({ l, onView, onApprove, onRemove }) {
  const photos = l.photos || [];
  const images = [
    ...photos.map((src, i) => ({ src, label: `${l.title}: photo ${i + 1}` })),
    ...(l.proofPhoto ? [{ src: l.proofPhoto, label: `${l.title}: proof (phone next to student ID)` }] : []),
  ];
  const seller = l.seller || null;
  const canApprove = l.status === 'under_review' || l.status === 'removed';
  const canRemove = l.status !== 'removed';

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        {photos[0] && (
          <Thumb
            src={photos[0]}
            label={`${photos.length} photo${photos.length === 1 ? '' : 's'}`}
            onClick={() => onView(images, 0)}
          />
        )}
        {l.proofPhoto && (
          <Thumb src={l.proofPhoto} label="Proof photo" onClick={() => onView(images, photos.length)} />
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{l.title}</strong>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-primary)', margin: '2px 0 6px' }}>
            {money(l.price)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip tone={LISTING_TONE[l.status] || 'muted'}>{l.status.replace('_', ' ')}</Chip>
            <Chip tone="muted">{l.category}</Chip>
            {l.category === 'phone' && <Chip tone={IMEI_TONE[l.imeiStatus] || 'muted'}>IMEI {l.imeiStatus}</Chip>}
            {l.reportCount > 0 && <Chip tone="warning">{l.reportCount} report{l.reportCount === 1 ? '' : 's'}</Chip>}
          </div>
        </div>
      </div>

      {l.category === 'phone' && (
        <Field label="IMEI">{l.imei ? <CopyText value={l.imei} /> : 'Not given'}</Field>
      )}
      <Field label="Seller">
        {seller ? (
          <span>
            {seller.fullName}
            {seller.isBanned && <> <Chip tone="warning">Banned</Chip></>}
          </span>
        ) : (
          'Deleted user'
        )}
      </Field>
      {seller && <Field label="Contact"><CopyText value={seller.email} /></Field>}
      {seller && seller.phone && <Field label="Phone"><CopyText value={seller.phone} /></Field>}
      {l.meetupSafeZone && <Field label="Meetup">{l.meetupSafeZone}{l.meetupConfirmed ? ' (confirmed)' : ''}</Field>}
      <Field label="Listed">{fmtDate(l.createdAt)}</Field>

      {(canApprove || canRemove) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          {canApprove && (
            <button type="button" onClick={onApprove} style={btn('primary')}>
              Approve
            </button>
          )}
          {canRemove && (
            <button type="button" onClick={onRemove} style={btn('danger')}>
              Remove
            </button>
          )}
        </div>
      )}
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
    const risky = l.imeiStatus === 'blacklisted' || l.imeiStatus === 'flagged';
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
      message: `This phone's IMEI is ${l.imeiStatus}. Only approve it if you have checked the proof photo and are sure it is legitimate.`,
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
      <input
        type="search"
        placeholder="Search title, IMEI or seller"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Tabs
        options={STATUS_TABS}
        value={status}
        onChange={(v) => {
          setStatus(v);
          setPage(1);
        }}
      />
      <Tabs
        options={CATEGORY_TABS}
        value={category}
        onChange={(v) => {
          setCategory(v);
          setPage(1);
        }}
      />

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.listings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.listings.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No listings match.</p>}

      {data.listings.map((l) => (
        <ListingCard
          key={l._id}
          l={l}
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