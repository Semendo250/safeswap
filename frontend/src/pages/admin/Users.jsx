import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { getUsers, getUserById, setUserBan, verifyUserEmail, deleteUser } from '../../api/admin.api';
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
  PAYMENT_TONE,
} from '../../components/admin/AdminUi';

const FILTERS = [
  ['all', 'All'],
  ['unverified', 'Unverified'],
  ['banned', 'Banned'],
  ['admins', 'Admins'],
];

function UserCard({ u, me, isOpen, detail, onToggle, onBan, onUnban, onVerify, onDelete, onViewPhoto }) {
  const canAct = u.role !== 'admin' && u._id !== me?.id;

  let idChip;
  if (u.verificationPath === 'fallback') {
    if (u.fallbackApproved) idChip = <Chip tone="success">ID approved</Chip>;
    else if (u.fallbackRejected) idChip = <Chip tone="warning">ID rejected</Chip>;
    else idChip = <Chip tone="gold">ID pending</Chip>;
  } else {
    idChip = <Chip tone="success">University email</Chip>;
  }

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Avatar src={u.profilePicture} name={u.fullName} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <strong style={{ fontSize: 15 }}>{u.fullName}</strong>
            {u.role === 'admin' && <Chip tone="teal">Admin</Chip>}
            {u.isBanned && <Chip tone="warning">Banned</Chip>}
            {!u.emailVerified && <Chip tone="gold">Email not verified</Chip>}
            {idChip}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-muted)', marginTop: 4, display: 'grid', gap: 2 }}>
            <CopyText value={u.email} />
            {u.phone ? <CopyText value={u.phone} /> : <span>No phone number</span>}
            {u.location && <span>📍 {u.location}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: 'var(--color-muted)', margin: '10px 0' }}>
        <span>Reg {u.studentRegNo}</span>
        <span>{u.listingCount} listing{u.listingCount === 1 ? '' : 's'}</span>
        <span>Trust {u.trustScore}</span>
        <span>{u.reportCount} report{u.reportCount === 1 ? '' : 's'}</span>
        <span>Joined {fmtDate(u.createdAt)}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={onToggle} style={btn('outline')}>
          {isOpen ? 'Hide details' : 'Details'}
        </button>
        {canAct && !u.emailVerified && (
          <button type="button" onClick={onVerify} style={btn('outline')}>
            Mark verified
          </button>
        )}
        {canAct &&
          (u.isBanned ? (
            <button type="button" onClick={onUnban} style={btn('outline')}>
              Unban
            </button>
          ) : (
            <button type="button" onClick={onBan} style={btn('danger')}>
              Ban
            </button>
          ))}
        {canAct && (
          <button type="button" onClick={onDelete} style={btn('danger')}>
            Delete
          </button>
        )}
      </div>

      {isOpen && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
          {(!detail || detail.loading) && <p style={{ fontSize: 13, color: 'var(--color-muted)' }}>Loading details...</p>}
          {detail && detail.error && <p style={{ fontSize: 13, color: 'var(--color-warning)' }}>{detail.error}</p>}
          {detail && detail.data && (
            <>
              <Field label="Completed sales">{detail.data.user.completedSales}</Field>
              <Field label="Phone verified">{detail.data.user.phoneVerified ? 'Yes' : 'No'}</Field>
              <Field label="Verification">{detail.data.user.verificationPath === 'fallback' ? 'Student ID photo' : 'University email'}</Field>

              {detail.data.user.fallbackIdPhoto && (
                <div style={{ margin: '8px 0' }}>
                  <Thumb
                    src={detail.data.user.fallbackIdPhoto}
                    label="ID photo"
                    size={96}
                    onClick={() => onViewPhoto([{ src: detail.data.user.fallbackIdPhoto, label: `${u.fullName}: ID photo` }])}
                  />
                </div>
              )}

              <h4 style={{ margin: '12px 0 6px', fontSize: 14 }}>Listings ({detail.data.listings.length})</h4>
              {detail.data.listings.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>None</p>}
              {detail.data.listings.map((l) => (
                <div key={l._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 0', alignItems: 'center' }}>
                  <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{l.title} · {money(l.price)}</span>
                  <Chip tone={LISTING_TONE[l.status] || 'muted'}>{l.status.replace('_', ' ')}</Chip>
                </div>
              ))}

              <h4 style={{ margin: '12px 0 6px', fontSize: 14 }}>Payments as buyer ({detail.data.payments.length})</h4>
              {detail.data.payments.length === 0 && <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>None</p>}
              {detail.data.payments.map((p) => (
                <div key={p._id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '4px 0', alignItems: 'center' }}>
                  <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    {p.listing ? p.listing.title : 'Deleted listing'} · {money(p.amount)}
                  </span>
                  <Chip tone={PAYMENT_TONE[p.status] || 'muted'}>{p.status}</Chip>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Users() {
  const { user: me } = useContext(AuthContext);
  const [search, setSearch] = useState('');
  const debounced = useDebounced(search);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ users: [], total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({});
  const [dialog, setDialog] = useState(null);
  const [viewer, setViewer] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getUsers({ search: debounced, filter, page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load users.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, filter, page, reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  function loadDetail(id) {
    setDetails((d) => ({ ...d, [id]: { loading: true } }));
    getUserById(id)
      .then((res) => setDetails((d) => ({ ...d, [id]: { data: res.data } })))
      .catch((err) => setDetails((d) => ({ ...d, [id]: { error: errText(err, 'Could not load details.') } })));
  }

  function toggle(id) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (!details[id] || !details[id].data) loadDetail(id);
  }

  function afterAction(id, message) {
    setNotice(message);
    reload();
    if (openId === id) {
      loadDetail(id);
    } else {
      setDetails((d) => {
        const next = { ...d };
        delete next[id];
        return next;
      });
    }
  }

  function askBan(u) {
    setDialog({
      title: `Ban ${u.fullName}?`,
      message:
        'They are blocked from the app straight away and their active listings are hidden. Listings with money held stay until that payment is settled. You can unban them later; hidden listings can be restored from All listings.',
      confirmLabel: 'Ban user',
      danger: true,
      askReason: 'required',
      onConfirm: async (reason) => {
        const res = await setUserBan(u._id, true, reason);
        setDialog(null);
        const hidden = res.data.hiddenListings || 0;
        const kept = res.data.keptListings || 0;
        afterAction(
          u._id,
          `${u.fullName} was banned. ${hidden} listing${hidden === 1 ? '' : 's'} hidden${
            kept ? `, ${kept} kept because money is held` : ''
          }.`
        );
      },
    });
  }

  function askUnban(u) {
    setDialog({
      title: `Unban ${u.fullName}?`,
      message: 'They can log in again. Their hidden listings are not restored automatically.',
      confirmLabel: 'Unban',
      onConfirm: async () => {
        await setUserBan(u._id, false);
        setDialog(null);
        afterAction(u._id, `${u.fullName} was unbanned.`);
      },
    });
  }

  function askVerify(u) {
    setDialog({
      title: `Mark ${u.fullName} as verified?`,
      message: 'Use this when their verification email never arrived. They will be able to log in.',
      confirmLabel: 'Mark verified',
      onConfirm: async () => {
        await verifyUserEmail(u._id);
        setDialog(null);
        afterAction(u._id, `${u.fullName} was marked as verified.`);
      },
    });
  }

  function askDelete(u) {
    setDialog({
      title: `Delete ${u.fullName} permanently?`,
      message:
        'This cannot be undone. Their account, listings, messages and reports are deleted. Users with payment history cannot be deleted: ban them instead.',
      confirmLabel: 'Delete permanently',
      danger: true,
      askReason: 'required',
      onConfirm: async (reason) => {
        await deleteUser(u._id, reason);
        setDialog(null);
        if (openId === u._id) setOpenId(null);
        afterAction(u._id, `${u.fullName} was deleted.`);
      },
    });
  }

  return (
    <PageShell title="Users" subtitle={`${data.total} account${data.total === 1 ? '' : 's'}`}>
      <input
        type="search"
        placeholder="Search name, email, reg no or phone"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      <Tabs
        options={FILTERS}
        value={filter}
        onChange={(f) => {
          setFilter(f);
          setPage(1);
        }}
      />

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {loading && data.users.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && !error && data.users.length === 0 && <p style={{ color: 'var(--color-muted)' }}>No users match.</p>}

      {data.users.map((u) => (
        <UserCard
          key={u._id}
          u={u}
          me={me}
          isOpen={openId === u._id}
          detail={details[u._id]}
          onToggle={() => toggle(u._id)}
          onBan={() => askBan(u)}
          onUnban={() => askUnban(u)}
          onVerify={() => askVerify(u)}
          onDelete={() => askDelete(u)}
          onViewPhoto={(images) => setViewer({ images, index: 0 })}
        />
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {viewer && <PhotoLightbox images={viewer.images} startIndex={viewer.index} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}