import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import BackButton from '../components/BackButton';
import { getMyDispute, sendDisputeMessage } from '../api/disputes.api';

const STATUS_LABEL = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };
const STATUS_TONE = { open: 'gold', in_progress: 'teal', resolved: 'success', closed: 'muted' };

function fmt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ComplaintThread() {
  const { id } = useParams();
  const { user, loading: authLoading } = useContext(AuthContext);
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const endRef = useRef(null);

  const load = useCallback(
    (silent) =>
      getMyDispute(id)
        .then((res) => {
          setDispute(res.data.dispute);
          setError('');
        })
        .catch((err) => {
          if (silent) return;
          if (err.response && err.response.status === 404) setError("This conversation isn't available.");
          else if (!err.response) setError('Network error. Check your connection and try again.');
          else setError('Could not load this conversation.');
        })
        .finally(() => {
          if (!silent) setLoading(false);
        }),
    [id]
  );

  // Loads the conversation, then checks for new replies every 20 seconds
  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    load(false);
    const timer = setInterval(() => load(true), 20000);
    return () => clearInterval(timer);
  }, [authLoading, user?.id, load]);

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setSendError('');
    try {
      const res = await sendDisputeMessage(id, body);
      setDispute(res.data.dispute);
      setText('');
      setTimeout(() => endRef.current && endRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
    } catch (err) {
      setSendError(
        !err.response
          ? 'Network error. Check your connection and try again.'
          : err.response.data?.error || 'Could not send your message.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="ct-page">
      <style>{`
        .ct-page { max-width: 640px; margin: 0 auto; padding: 20px 16px 60px; }
        .ct-page, .ct-page * { -webkit-user-select: text; user-select: text; }
        .ct-head { margin: 14px 0 16px; }
        .ct-chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .ct-ref { font-size: 13px; font-weight: 700; }
        .ct-subject { margin: 8px 0 0; font-size: 20px; line-height: 1.3; text-align: left; word-break: break-word; }

        .ct-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
        .ct-gold { background: var(--color-gold-bg); color: var(--color-gold); }
        .ct-teal { background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card)); color: var(--color-teal); }
        .ct-success { background: var(--color-success-bg); color: var(--color-success); }
        .ct-muted { background: var(--color-border); color: var(--color-muted); }

        .ct-thread { display: flex; flex-direction: column; gap: 10px; }
        .ct-row { display: flex; }
        .ct-row.ct-me { justify-content: flex-end; }
        .ct-bubble {
          max-width: 88%; padding: 10px 12px; border-radius: 12px;
          background: var(--color-surface); border: 1px solid var(--color-border);
        }
        .ct-me .ct-bubble {
          background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card));
          border-color: color-mix(in srgb, var(--color-teal) 30%, var(--color-border));
        }
        .ct-who { font-size: 12px; font-weight: 600; color: var(--color-muted); margin-bottom: 2px; }
        .ct-text { font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
        .ct-time { margin-top: 4px; font-size: 11px; color: var(--color-muted); }

        .ct-resolution {
          margin-top: 16px; padding: 12px 14px; border-radius: 12px;
          background: var(--color-success-bg); color: var(--color-success); font-size: 14px;
        }
        .ct-resolution strong { display: block; margin-bottom: 2px; }
        .ct-closed {
          margin-top: 16px; padding: 12px 14px; border-radius: 12px; font-size: 14px;
          border: 1px dashed var(--color-border); color: var(--color-muted);
        }

        .ct-form { margin-top: 18px; padding: 14px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-card); }
        .ct-form textarea { margin-bottom: 8px; }
        .ct-error { margin: 0 0 8px; font-size: 13px; color: var(--color-warning); }
        .ct-note { margin: 0 0 8px; font-size: 12px; color: var(--color-muted); }
      `}</style>

      <BackButton />

      {authLoading || (user && loading) ? (
        <p style={{ color: 'var(--color-muted)' }}>Loading...</p>
      ) : !user ? (
        <p>
          <Link to="/login" state={{ from: `/my-complaints/${id}` }}>
            Log in
          </Link>{' '}
          to see this conversation.
        </p>
      ) : error ? (
        <p style={{ color: 'var(--color-warning)' }}>{error}</p>
      ) : dispute ? (
        <>
          <div className="ct-head">
            <div className="ct-chips">
              <span className="ct-ref">{dispute.ref}</span>
              <span className={`ct-chip ct-${STATUS_TONE[dispute.status] || 'muted'}`}>
                {STATUS_LABEL[dispute.status] || dispute.status}
              </span>
            </div>
            <h2 className="ct-subject">{dispute.subject}</h2>
          </div>

          <div className="ct-thread">
            {dispute.messages.map((m) => (
              <div key={m._id} className={m.from === 'student' ? 'ct-row ct-me' : 'ct-row'}>
                <div className="ct-bubble">
                  <div className="ct-who">{m.from === 'student' ? 'You' : m.senderName || 'SafeSwap support'}</div>
                  <div className="ct-text">{m.text}</div>
                  <div className="ct-time">{fmt(m.createdAt)}</div>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {!dispute.canReply && dispute.resolution && (
            <div className="ct-resolution">
              <strong>How it was resolved</strong>
              {dispute.resolution}
            </div>
          )}

          {dispute.canReply ? (
            <form onSubmit={send} className="ct-form">
              <p className="ct-note">An admin will reply here. You will get a notification when they do.</p>
              <textarea
                rows={3}
                placeholder="Write your reply"
                value={text}
                maxLength={1000}
                onChange={(e) => setText(e.target.value)}
              />
              {sendError && <p className="ct-error">{sendError}</p>}
              <button type="submit" disabled={sending || !text.trim()}>
                {sending ? 'Sending...' : 'Send reply'}
              </button>
            </form>
          ) : (
            <div className="ct-closed">
              This conversation is closed. If you still need help, <Link to="/support">send a new message</Link>.
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}