import { useEffect, useState } from 'react';
import Avatar from '../../components/Avatar';
import {
  getVerificationQueue,
  approveFallbackVerification,
  rejectFallbackVerification,
} from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Notice,
  ConfirmDialog,
  PhotoLightbox,
  btn,
  errText,
  fmtDate,
} from '../../components/admin/AdminUi';

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
    <span className="vq-copywrap">
      <span className="vq-copytext">{value}</span>
      <button type="button" className="vq-copy" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

function MetaItem({ label, children, wide = false }) {
  return (
    <div className={wide ? 'vq-meta-item vq-wide' : 'vq-meta-item'}>
      <span className="vq-meta-label">{label}</span>
      <span className="vq-meta-value">{children}</span>
    </div>
  );
}

export default function VerificationQueue() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    getVerificationQueue()
      .then((res) => {
        setUsers(res.data);
        setError('');
      })
      .catch((err) => setError(errText(err, 'Could not load the queue.')));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(u) {
    setBusyId(u._id);
    try {
      await approveFallbackVerification(u._id);
      setNotice(`${u.fullName} was approved.`);
      load();
    } catch (err) {
      setError(errText(err, 'Could not approve.'));
    } finally {
      setBusyId(null);
    }
  }

  function askReject(u) {
    setDialog({
      title: `Reject ${u.fullName}?`,
      message:
        'They are removed from this queue and marked "Rejected". Their account is not blocked; use Users to ban them if needed.',
      confirmLabel: 'Reject',
      danger: true,
      askReason: 'optional',
      onConfirm: async (reason) => {
        await rejectFallbackVerification(u._id, reason);
        setDialog(null);
        setNotice(`${u.fullName} was rejected.`);
        load();
      },
    });
  }

  return (
    <PageShell
      title="Verification queue"
      subtitle={users ? `${users.length} waiting for a decision` : undefined}
    >
      <style>{`
        .vq-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .vq-top { display: flex; gap: 12px; align-items: flex-start; }
        .vq-main { min-width: 0; flex: 1; }
        .vq-actions { display: flex; gap: 8px; flex-shrink: 0; }

        .vq-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .vq-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .vq-meta-item.vq-wide { grid-column: 1 / -1; }
        .vq-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .vq-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }

        button.vq-tile {
          position: relative; width: 96px; height: 96px; min-width: 0; padding: 0;
          align-self: auto; overflow: hidden; border-radius: 10px;
          border: 1px solid var(--color-border); background: var(--color-surface); cursor: zoom-in;
        }
        button.vq-tile:hover { background: var(--color-surface); border-color: var(--color-teal); }
        button.vq-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .vq-badge {
          position: absolute; left: 4px; bottom: 4px; padding: 2px 7px; border-radius: 999px;
          background: rgba(0, 0, 0, 0.65); color: #fff; font-size: 10px; font-weight: 600; line-height: 1.3;
        }

        .vq-copywrap { display: inline-flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
        .vq-copytext { word-break: break-all; }
        button.vq-copy {
          min-width: 0; padding: 0 2px; border: none; background: transparent; color: var(--color-teal);
          font-size: 11px; font-weight: 600; cursor: pointer; align-self: auto;
        }
        button.vq-copy:hover { background: transparent; color: var(--color-teal); text-decoration: underline; }

        .vq-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .vq-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .vq-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .vq-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          .vq-top { flex-wrap: wrap; }
          .vq-main { flex: 1 1 140px; }
          .vq-actions { flex-basis: 100%; }
        }
      `}</style>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {!users && !error && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {users && users.length === 0 && (
        <div className="vq-empty">
          <div className="vq-empty-icon">✅</div>
          <p className="vq-empty-title">All caught up</p>
          <p className="vq-empty-text">No signups are waiting for a decision.</p>
        </div>
      )}

      {users &&
        users.map((u) => (
          <div key={u._id} className="vq-card">
            <div className="vq-top">
              <Avatar name={u.fullName} size={48} />

              <div className="vq-main">
                <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{u.fullName}</strong>
                {!u.emailVerified && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                    <Chip tone="gold">Email not verified</Chip>
                  </div>
                )}
              </div>

              <div className="vq-actions">
                <button type="button" disabled={busyId === u._id} onClick={() => approve(u)} style={btn('primary')}>
                  {busyId === u._id ? 'Approving...' : 'Approve'}
                </button>
                <button type="button" disabled={busyId === u._id} onClick={() => askReject(u)} style={btn('danger')}>
                  Reject
                </button>
              </div>
            </div>

            <div className="vq-meta">
              <MetaItem label="Email">
                <CopyValue value={u.email} />
              </MetaItem>
              <MetaItem label="Phone">{u.phone ? <CopyValue value={u.phone} /> : 'Not given'}</MetaItem>
              {u.location && <MetaItem label="Location">{u.location}</MetaItem>}
              {u.studentRegNo && <MetaItem label="Reg no">{u.studentRegNo}</MetaItem>}
              <MetaItem label="Signed up">{fmtDate(u.createdAt)}</MetaItem>
              {u.fallbackIdPhoto && (
                <MetaItem label="ID photo" wide>
                  <button
                    type="button"
                    className="vq-tile"
                    onClick={() => setViewer([{ src: u.fallbackIdPhoto, label: `${u.fullName}: ID photo` }])}
                    aria-label="View ID photo"
                  >
                    <img src={u.fallbackIdPhoto} alt="ID photo" draggable={false} />
                    <span className="vq-badge">ID photo</span>
                  </button>
                </MetaItem>
              )}
            </div>
          </div>
        ))}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {viewer && <PhotoLightbox images={viewer} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}