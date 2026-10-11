import { useEffect, useState } from 'react';
import { getAnnouncements, sendAnnouncement } from '../../api/admin.api';
import { PageShell, Notice, Pager, ConfirmDialog, Field, btn, errText, fmtDate } from '../../components/admin/AdminUi';

const box = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 12,
  background: 'var(--color-card)',
  marginBottom: 10,
};

function Counter({ value, max }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--color-muted)', display: 'block', textAlign: 'right', marginBottom: 6 }}>
      {value.length}/{max}
    </span>
  );
}

export default function Broadcast() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setNotice(`Sent to ${res.data.recipientCount} users. Push alerts are going out now.`);
    setTitle('');
    setBody('');
    setLink('');
    setPage(1);
    setReloadKey((k) => k + 1);
  }

  return (
    <PageShell
      title="Broadcast"
      subtitle={`Send a notification to every active user (${data.audienceCount} right now). It appears in their bell and as a push alert.`}
    >
      <form onSubmit={openConfirm} style={box}>
        <input
          placeholder="Title, e.g. Scheduled maintenance tonight"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Counter value={title} max={80} />
        <textarea
          rows={4}
          placeholder="Message"
          value={body}
          maxLength={300}
          onChange={(e) => setBody(e.target.value)}
        />
        <Counter value={body} max={300} />
        <input
          placeholder="Page to open when tapped (optional), e.g. /browse"
          value={link}
          maxLength={200}
          onChange={(e) => setLink(e.target.value)}
          style={{ marginBottom: 10 }}
        />

        {ready && (
          <div
            style={{
              border: '1px dashed var(--color-border)',
              borderRadius: 8,
              padding: '8px 10px',
              marginBottom: 10,
              background: 'var(--color-surface)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>How it will look</div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{title.trim()}</div>
            <div style={{ fontSize: 13, color: 'var(--color-muted)' }}>{body.trim()}</div>
          </div>
        )}

        <button type="submit" disabled={!ready} style={btn('primary', { padding: '9px 16px' })}>
          Review and send
        </button>
      </form>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}

      <h3 style={{ margin: '22px 0 8px', fontSize: 16, textAlign: 'left' }}>Past announcements</h3>
      {loading && data.announcements.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {!loading && data.announcements.length === 0 && (
        <p style={{ color: 'var(--color-muted)' }}>Nothing sent yet.</p>
      )}

      {data.announcements.map((a) => (
        <div key={a._id} style={box}>
          <strong style={{ fontSize: 14 }}>{a.title}</strong>
          <p style={{ margin: '4px 0 8px', fontSize: 13, color: 'var(--color-muted)', wordBreak: 'break-word' }}>
            {a.body}
          </p>
          <Field label="Sent to">{a.recipientCount} users</Field>
          {a.link && <Field label="Opens">{a.link}</Field>}
          <Field label="Sent">
            {fmtDate(a.createdAt)}
            {a.sentByName ? ` by ${a.sentByName}` : ''}
          </Field>
        </div>
      ))}

      <Pager page={page} pages={data.pages} onPage={setPage} />

      {confirmOpen && (
        <ConfirmDialog
          title="Send to everyone?"
          message={`"${title.trim()}" will go to ${data.audienceCount} users right now. This can't be unsent.`}
          confirmLabel="Send announcement"
          onConfirm={doSend}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </PageShell>
  );
}