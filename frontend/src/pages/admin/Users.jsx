import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Avatar from '../../components/Avatar';
import { getUsers, getUserById, setUserBan, verifyUserEmail, deleteUser } from '../../api/admin.api';
import ExportButton from '../../components/admin/ExportButton';
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
    <span className="usr-copywrap">
      <span className="usr-copytext">{value}</span>
      <button type="button" className="usr-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children }) {
  return (
    <div className="usr-meta-item">
      <span className="usr-meta-label">{label}</span>
      <span className="usr-meta-value">{children}</span>
    </div>
  );
}

function UserCard({ u, me, isOpen, detail, onToggle, onBan, onUnban, onVerify, onDelete, onViewPhoto }) {
  const canAct = u.role !== 'admin' && u._id !== me?.id;

  // Ignore empty values and the text "undefined" / "null" that bad form submissions can leave behind
  const rawReg = u.studentRegNo ? String(u.studentRegNo).trim() : '';
  const reg = rawReg && !['undefined', 'null'].includes(rawReg.toLowerCase()) ? rawReg : '';

  let idChip;
  if (u.verificationPath === 'fallback') {
    if (u.fallbackApproved) idChip = <Chip tone="success">Approved</Chip>;
    else if (u.fallbackRejected) idChip = <Chip tone="warning">Rejected</Chip>;
    else idChip = <Chip tone="gold">Pending approval</Chip>;
  } else {
    idChip = <Chip tone="success">University email</Chip>;
  }

  return (
    <div className="usr-card">
      <div className="usr-top">
        <Avatar src={u.profilePicture} name={u.fullName} size={48} />

        <div className="usr-main">
          <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{u.fullName}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
            {u.role === 'admin' && <Chip tone="teal">Admin</Chip>}
            {u.isBanned && <Chip tone="warning">Banned</Chip>}
            {!u.emailVerified && <Chip tone="gold">Email not verified</Chip>}
            {idChip}
          </div>
        </div>

        <div className="usr-actions">
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
      </div>

      <div className="usr-meta">
        <MetaItem label="Email">
          <CopyValue value={u.email} />
        </MetaItem>
        <MetaItem label="Phone">{u.phone ? <CopyValue value={u.phone} /> : 'No phone number'}</MetaItem>
        {u.location && <MetaItem label="Location">📍 {u.location}</MetaItem>}
        {reg && <MetaItem label="Reg no">{reg}</MetaItem>}
      </div>

      <div className="usr-stats">
        <span>
          <strong>{u.listingCount}</strong> listing{u.listingCount === 1 ? '' : 's'}
        </span>
        <span>
          Trust <strong>{u.trustScore}</strong>
        </span>
        <span>
          <strong>{u.reportCount}</strong> report{u.reportCount === 1 ? '' : 's'}
        </span>
        <span>Joined {fmtDate(u.createdAt)}</span>
      </div>

      {isOpen && (
        <div className="usr-details">
          {(!detail || detail.loading) && <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: 0 }}>Loading details...</p>}
          {detail && detail.error && <p style={{ fontSize: 13, color: 'var(--color-warning)', margin: 0 }}>{detail.error}</p>}
          {detail && detail.data && (
            <>
              <Field label="Completed sales">{detail.data.user.completedSales}</Field>
              <Field label="Phone verified">{detail.data.user.phoneVerified ? 'Yes' : 'No'}</Field>
              <Field label="Verification">
                {detail.data.user.verificationPath === 'fallback' ? 'Personal email (manual approval)' : 'University email'}
              </Field>

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
      <style>{`
        .usr-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .usr-filter-label {
          flex-shrink: 0; font-size: 11px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .usr-tabs { min-width: 0; flex: 1 1 auto; }
        .usr-export { margin-left: auto; flex-shrink: 0; }

        .usr-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .usr-top { display: flex; gap: 12px; align-items: flex-start; }
        .usr-main { min-width: 0; flex: 1; }
        .usr-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: flex-end; max-width: 300px; flex-shrink: 0; }

        .usr-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .usr-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .usr-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .usr-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        .usr-stats {
          display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 12px;
          font-size: 12px; color: var(--color-muted);
        }
        .usr-stats strong { color: var(--color-ink); font-weight: 600; }

        .usr-details {
          margin-top: 12px; padding: 12px; border-radius: 10px;
          background: var(--color-surface); border: 1px solid var(--color-border);
        }

        .usr-copywrap { display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .usr-copytext { word-break: break-all; }
        button.usr-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.usr-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        @media (max-width: 600px) {
          .usr-top { flex-wrap: wrap; }
          .usr-main { flex: 1 1 140px; }
          .usr-actions { flex-basis: 100%; max-width: none; justify-content: flex-start; }
          .usr-export { margin-left: 0; }
        }
      `}</style>

      <input
        type="search"
        placeholder="Search name, email, or phone"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      <div className="usr-toolbar">
        <span className="usr-filter-label">Filter</span>
        <div className="usr-tabs">
          <Tabs
            options={FILTERS}
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setPage(1);
            }}
          />
        </div>
        <div className="usr-export">
          <ExportButton
            kind="users"
            label="Export users CSV"
            params={{ filter, search: debounced }}
            onDone={setNotice}
            onError={setError}
          />
        </div>
      </div>

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