import { useEffect, useState } from 'react';
import { getAnnouncements, sendAnnouncement, deleteAnnouncement } from '../../api/admin.api';
import { PageShell, Notice, Pager, ConfirmDialog, btn, errText, fmtDate } from '../../components/admin/AdminUi';

function MetaItem({ label, children, wide = false }) {
  return (
    <div className={wide ? 'bc-meta-item bc-wide' : 'bc-meta-item'}>
      <span className="bc-meta-label">{label}</span>
      <span className="bc-meta-value">{children}</span>
    </div>
  );
}

export default function Broadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dialog, setDialog] = useState(null);

  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState({ announcements: [], total: 0, pages: 1, audienceCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAnnouncements({ page })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load past announcements.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadKey]);

  const ready = title.trim().length >= 3 && body.trim().length >= 3;

  function openConfirm(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    if (ready) setConfirmOpen(true);
  }

  async function doSend() {
    const res = await sendAnnouncement({ title: title.trim(), body: body.trim(), link: link.trim() });
    setConfirmOpen(false);
    setNotice(`Sent to ${res.data.recipientCount} students. Push alerts are going out now.`);
    setTitle('');
    setBody('');
    setLink('');
    setPage(1);
    setReloadKey((k) => k + 1);
  }

  function askDelete(a) {
    setDialog({
      title: 'Delete this announcement?',
      message:
        "It is removed from the list and from every student's bell, so anyone who has not opened it will never see it. A push alert already delivered to a phone cannot be pulled back.",
      confirmLabel: 'Delete announcement',
      danger: true,
      askReason: 'optional',
      onConfirm: async (reason) => {
        const res = await deleteAnnouncement(a._id, reason);
        setDialog(null);
        setNotice(`Deleted. ${res.data.removedNotifications} bell notifications removed.`);
        if (data.announcements.length === 1 && page > 1) setPage(page - 1);
        setReloadKey((k) => k + 1);
      },
    });
  }

  return (
    <PageShell
      title="Broadcast"
      subtitle={`Send a notification to every active student (${data.audienceCount} right now). Admins don't receive it. It appears in their bell and as a push alert.`}
    >
      <style>{`
        .bc-card {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 16px;
          background: var(--color-card); margin-bottom: 14px;
        }
        .bc-section-label {
          margin-bottom: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-teal);
        }
        .bc-field { margin-bottom: 12px; }
        .bc-field-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .bc-field-head label { font-size: 13px; font-weight: 600; color: var(--color-ink); }
        .bc-count { font-size: 11px; color: var(--color-muted); }

        .bc-preview {
          margin: 4px 0 14px; padding: 10px 12px; border-radius: 10px;
          border: 1px dashed var(--color-border); background: var(--color-surface);
        }
        .bc-preview-label {
          margin-bottom: 8px; font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .bc-preview-item {
          display: flex; gap: 10px; padding: 10px 12px; border-radius: 10px;
          background: var(--color-card); border: 1px solid var(--color-border);
        }
        .bc-preview-icon { font-size: 16px; flex-shrink: 0; }
        .bc-preview-text { min-width: 0; flex: 1; }
        .bc-preview-title { display: block; font-size: 13px; font-weight: 600; color: var(--color-ink); word-break: break-word; }
        .bc-preview-body { display: block; margin-top: 2px; font-size: 12px; color: var(--color-muted); word-break: break-word; }
        .bc-preview-time { display: block; margin-top: 3px; font-size: 11px; color: var(--color-muted); }

        .bc-footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .bc-footer-note { flex: 1 1 200px; font-size: 12px; color: var(--color-muted); }
        .bc-footer-note strong { color: var(--color-ink); }
        button.bc-submit {
          min-width: 150px; height: 40px; padding: 0 20px; align-self: auto; margin-left: auto;
          background: var(--color-primary); border: 1px solid var(--color-primary); color: #fff;
        }
        button.bc-submit:hover:not(:disabled) {
          background: var(--color-primary-dark); border-color: var(--color-primary-dark);
        }
        button.bc-submit:disabled {
          opacity: 1; cursor: not-allowed; background: var(--color-surface);
          border: 1px solid var(--color-border); color: var(--color-muted);
        }

        .bc-list-head { display: flex; align-items: baseline; gap: 8px; margin: 22px 0 10px; }
        .bc-list-head h3 { margin: 0; font-size: 16px; text-align: left; }
        .bc-list-count { font-size: 13px; color: var(--color-muted); }

        .bc-entry {
          border: 1px solid var(--color-border); border-radius: 12px; padding: 14px;
          margin-bottom: 14px; background: var(--color-card);
        }
        .bc-entry-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; flex-wrap: wrap; }
        .bc-entry-title { font-size: 15px; word-break: break-word; }
        .bc-date { font-size: 12px; color: var(--color-muted); }
        .bc-entry-body { margin: 6px 0 0; font-size: 13px; color: var(--color-muted); word-break: break-word; white-space: pre-wrap; }

        .bc-meta {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px 20px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--color-border);
        }
        .bc-meta-item { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .bc-meta-item.bc-wide { grid-column: 1 / -1; }
        .bc-meta-label {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.04em; color: var(--color-muted);
        }
        .bc-meta-value { font-size: 13px; color: var(--color-ink); word-break: break-word; }
        .bc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }

        .bc-actions { margin-top: 12px; }

        .bc-empty {
          text-align: center; padding: 32px 16px; border: 1px dashed var(--color-border);
          border-radius: 12px; color: var(--color-muted);
        }
        .bc-empty-icon { font-size: 30px; margin-bottom: 6px; }
        .bc-empty-title { margin: 0 0 4px; font-size: 14px; font-weight: 600; color: var(--color-ink); }
        .bc-empty-text { margin: 0; font-size: 13px; }

        @media (max-width: 600px) {
          button.bc-submit { width: 100%; margin-left: 0; }
        }
      `}</style>

      <form onSubmit={openConfirm} className="bc-card">
        <div className="bc-section-label">New announcement</div>

        <div className="bc-field">
          <div className="bc-field-head">
            <label htmlFor="bc-title">Title</label>
            <span className="bc-count">{title.length}/80</span>
          </div>
          <input
            id="bc-title"
            placeholder="e.g. Scheduled maintenance tonight"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="bc-field">
          <div className="bc-field-head">
            <label htmlFor="bc-body">Message</label>
            <span className="bc-count">{body.length}/300</span>
          </div>
          <textarea
            id="bc-body"
            rows={4}
            placeholder="What do you want students to know?"
            value={body}
            maxLength={300}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div className="bc-field">
          <div className="bc-field-head">
            <label htmlFor="bc-link">Opens when tapped</label>
            <span className="bc-count">Optional</span>
          </div>
          <input
            id="bc-link"
            placeholder="e.g. /browse"
            value={link}
            maxLength={200}
            onChange={(e) => setLink(e.target.value)}
          />
        </div>

        {ready && (
          <div className="bc-preview">
            <div className="bc-preview-label">How it will look</div>
            <div className="bc-preview-item">
              <span className="bc-preview-icon">🔔</span>
              <span className="bc-preview-text">
                <span className="bc-preview-title">{title.trim()}</span>
                <span className="bc-preview-body">{body.trim()}</span>
                <span className="bc-preview-time">just now</span>
              </span>
            </div>
          </div>
        )}

        <div className="bc-footer">
          <span className="bc-footer-note">
            {ready ? (
              <>
                Will reach <strong>{data.audienceCount}</strong> active students.
              </>
            ) : (
              'Add a title and a message (at least 3 characters each) to continue.'
            )}
          </span>
          <button type="submit" className="bc-submit" disabled={!ready}>
            Review and send
          </button>
        </div>
      </form>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}

      <div className="bc-list-head">
        <h3>Past announcements</h3>
        <span className="bc-list-count">{data.total}</span>
      </div>

      {loading && data.announcements.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {!loading && data.announcements.length === 0 && (
        <div className="bc-empty">
          <div className="bc-empty-icon">📢</div>
          <p className="bc-empty-title">Nothing sent yet</p>
          <p className="bc-empty-text">Announcements you send will be listed here.</p>
        </div>
      )}

      {data.announcements.map((a) => (
        <div key={a._id} className="bc-entry">
          <div className="bc-entry-head">
            <strong className="bc-entry-title">{a.title}</strong>
            <span className="bc-date">{fmtDate(a.createdAt)}</span>
          </div>
          <p className="bc-entry-body">{a.body}</p>

          <div className="bc-meta">
            <MetaItem label="Sent to">{a.recipientCount} users</MetaItem>
            {a.sentByName && <MetaItem label="Sent by">{a.sentByName}</MetaItem>}
            {a.link && (
              <MetaItem label="Opens" wide>
                <span className="bc-mono">{a.link}</span>
              </MetaItem>
            )}
          </div>

          <div className="bc-actions">
            <button type="button" onClick={() => askDelete(a)} style={btn('danger')}>
              Delete
            </button>
          </div>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}

      {confirmOpen && (
        <ConfirmDialog
          title="Send to everyone?"
          message={`"${title.trim()}" will go to ${data.audienceCount} students right now. This can't be unsent.`}
          confirmLabel="Send announcement"
          onConfirm={doSend}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </PageShell>
  );
}