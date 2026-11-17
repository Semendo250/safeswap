import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { getConversations } from '../api/chat.api';
import Avatar from '../components/Avatar';
import ChatTicks from '../components/ChatTicks';
import Chat from './Chat';
import useIsDesktop from '../utils/useIsDesktop';

const DAY_MS = 24 * 60 * 60 * 1000;

// WhatsApp-style time: the clock time today, then "Yesterday", the weekday, or the date
function listTime(value) {
  const d = new Date(value);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / DAY_MS);
  if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: '2-digit' });
}

function previewOf(c) {
  if (c.lastDeleted) return 'This message was deleted';
  return c.lastMessage || '';
}

function EmptyPane() {
  return (
    <div className="ib-empty-pane">
      <div className="ib-empty-icon">
        <svg
          width="34"
          height="34"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <h3>SafeSwap Messages</h3>
      <p>
        Pick a conversation to read and reply. Pay through SafeSwap and meet at a safe zone, so your money stays
        protected until the handover.
      </p>
    </div>
  );
}

export default function Inbox() {
  const isDesktop = useIsDesktop();
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // Opening /chat/:listingId on a wide screen shows that chat in the right-hand pane
  const urlListing = params.listingId || '';
  const withParam = searchParams.get('with') || '';
  const urlReceiver = location.state?.receiverId || (/^[a-f\d]{24}$/i.test(withParam) ? withParam : '');
  const [selected, setSelected] = useState(
    urlListing ? { listingId: urlListing, receiverId: urlReceiver } : null
  );

  useEffect(() => {
    if (urlListing) setSelected({ listingId: urlListing, receiverId: urlReceiver });
  }, [urlListing, urlReceiver]);

  const load = useCallback(() => {
    return getConversations()
      .then((res) => {
        setConversations(res.data || []);
        setError('');
      })
      .catch((err) => {
        setError(
          !err.response ? 'Network error. Check your connection and try again.' : 'Could not load your messages.'
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, 15000);
    return () => clearInterval(timer);
  }, [load]);

  // The open chat tells us when something changed, so the list catches up right away
  const activityTimer = useRef(null);
  const handleActivity = useCallback(() => {
    clearTimeout(activityTimer.current);
    activityTimer.current = setTimeout(load, 900);
  }, [load]);
  useEffect(() => () => clearTimeout(activityTimer.current), []);

  const isSel = (c) =>
    !!selected &&
    c.listingId === selected.listingId &&
    (!selected.receiverId || c.otherUser.id === selected.receiverId);
  const unreadOf = (c) => (isDesktop && isSel(c) ? 0 : c.unread || 0);

  const unreadChats = conversations.filter((c) => unreadOf(c) > 0).length;
  const q = query.trim().toLowerCase();
  const visible = conversations.filter((c) => {
    if (filter === 'unread' && unreadOf(c) === 0) return false;
    if (!q) return true;
    return [c.otherUser.fullName, c.listingTitle, c.lastMessage].some((t) =>
      String(t || '').toLowerCase().includes(q)
    );
  });
  const selConv = isDesktop ? conversations.find(isSel) : null;

  function openRow(c, e) {
    if (!isDesktop) return; // phones: the link opens the full-screen chat
    e.preventDefault();
    setSelected({ listingId: c.listingId, receiverId: c.otherUser.id });
  }

  return (
    <div className="ib-shell">
      <style>{`
        .ib-shell {
          display: flex; height: calc(100dvh - 60px); max-width: 1320px; margin: 0 auto;
          background: var(--color-card); box-sizing: border-box;
        }
        @media (min-width: 900px) {
          .ib-shell { border-left: 1px solid var(--color-border); border-right: 1px solid var(--color-border); }
        }
        .ib-left { display: flex; flex-direction: column; width: 100%; min-width: 0; background: var(--color-card); }
        .ib-right { display: none; }
        @media (min-width: 900px) {
          .ib-left { width: 380px; flex: 0 0 380px; border-right: 1px solid var(--color-border); }
          .ib-right { display: flex; flex-direction: column; flex: 1; min-width: 0; min-height: 0; }
        }

        .ib-head { padding: 14px 14px 8px; flex-shrink: 0; }
        .ib-head-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .ib-title { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
        .ib-count {
          min-width: 24px; padding: 2px 8px; border-radius: 999px; text-align: center; font-size: 12px;
          font-weight: 700; color: var(--color-teal);
          background: color-mix(in srgb, var(--color-primary) 12%, transparent);
        }
        .ib-search { position: relative; }
        .ib-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-muted); pointer-events: none; }
        .ib-search input { padding: 10px 14px 10px 38px; border-radius: 999px; background: var(--color-surface); font-size: 14px; }
        .ib-chips { display: flex; gap: 8px; margin-top: 10px; }
        button.ib-chip {
          display: inline-flex; align-items: center; gap: 6px; align-self: auto; min-width: 0;
          padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 600;
          background: var(--color-surface); color: var(--color-ink); border: 1px solid var(--color-border);
        }
        button.ib-chip:hover { background: var(--color-surface); color: var(--color-teal); border-color: var(--color-teal); }
        button.ib-chip.active, button.ib-chip.active:hover {
          background: var(--color-primary); border-color: var(--color-primary); color: #fff;
        }
        .ib-chip-n {
          min-width: 18px; padding: 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 700;
          background: var(--color-teal); color: #fff;
        }
        button.ib-chip.active .ib-chip-n { background: #fff; color: var(--color-primary); }

        .ib-list { flex: 1; min-height: 0; overflow-y: auto; border-top: 1px solid var(--color-border); }
        a.ib-row {
          display: flex; align-items: center; gap: 12px; padding: 11px 14px; color: inherit;
          border-bottom: 1px solid var(--color-border); text-decoration: none; transition: background 0.15s;
        }
        a.ib-row:hover { background: var(--color-surface); text-decoration: none; }
        a.ib-row.active { background: color-mix(in srgb, var(--color-teal) 12%, var(--color-card)); }
        .ib-main { min-width: 0; flex: 1; }
        .ib-line { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .ib-name { min-width: 0; font-size: 15px; font-weight: 500; color: var(--color-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib-name.strong { font-weight: 700; }
        .ib-time { flex-shrink: 0; font-size: 12px; color: var(--color-muted); }
        .ib-time.hot { color: var(--color-teal); font-weight: 700; }
        .ib-item { margin: 1px 0 2px; font-size: 12px; color: var(--color-teal); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ib-preview {
          display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 13px;
          color: var(--color-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ib-preview.strong { color: var(--color-ink); font-weight: 600; }
        .ib-preview.deleted { font-style: italic; }
        .ib-preview span { overflow: hidden; text-overflow: ellipsis; }
        .ib-badge {
          flex-shrink: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; background: var(--color-teal); color: #fff;
        }
        [data-theme="dark"] .ib-badge, [data-theme="dark"] .ib-chip-n { color: #0e1518; }

        .ib-note { padding: 28px 18px; text-align: center; font-size: 14px; color: var(--color-muted); line-height: 1.6; }
        .ib-note strong { display: block; margin-bottom: 4px; font-size: 15px; color: var(--color-ink); }

        .ib-empty-pane {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 24px; text-align: center; background-color: var(--color-surface);
          background-image:
            radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--color-teal) 9%, transparent) 0 2px, transparent 3px),
            radial-gradient(circle at 72% 68%, color-mix(in srgb, var(--color-teal) 7%, transparent) 0 2px, transparent 3px);
          background-size: 46px 46px, 62px 62px;
        }
        .ib-empty-icon {
          width: 76px; height: 76px; margin-bottom: 14px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--color-teal); background: color-mix(in srgb, var(--color-teal) 14%, var(--color-card));
        }
        .ib-empty-pane h3 { margin: 0 0 6px; font-size: 20px; }
        .ib-empty-pane p { max-width: 360px; margin: 0; font-size: 14px; line-height: 1.6; color: var(--color-muted); }
      `}</style>

      <div className="ib-left">
        <div className="ib-head">
          <div className="ib-head-top">
            <h2 className="ib-title">Messages</h2>
            {conversations.length > 0 && <span className="ib-count">{conversations.length}</span>}
          </div>
          <div className="ib-search">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="search"
              placeholder="Search name, item or message"
              value={query}
              maxLength={60}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="ib-chips">
            <button
              type="button"
              className={filter === 'all' ? 'ib-chip active' : 'ib-chip'}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={filter === 'unread' ? 'ib-chip active' : 'ib-chip'}
              onClick={() => setFilter('unread')}
            >
              Unread
              {unreadChats > 0 && <span className="ib-chip-n">{unreadChats}</span>}
            </button>
          </div>
        </div>

        <div className="ib-list">
          {loading && <p className="ib-note">Loading...</p>}

          {!loading && error && conversations.length === 0 && (
            <div className="ib-note">
              <p style={{ margin: '0 0 10px' }}>{error}</p>
              <button type="button" onClick={load}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && conversations.length === 0 && (
            <div className="ib-note">
              <strong>No messages yet</strong>
              Visit a listing and message the seller to start a conversation.
              <div style={{ marginTop: 10 }}>
                <Link to="/browse">Browse listings</Link>
              </div>
            </div>
          )}

          {conversations.length > 0 && visible.length === 0 && (
            <p className="ib-note">
              {filter === 'unread' && !q ? 'No unread conversations.' : 'No conversations match your search.'}
            </p>
          )}

          {visible.map((c) => {
            const unread = unreadOf(c);
            const active = isDesktop && isSel(c);
            return (
              <Link
                key={`${c.listingId}-${c.otherUser.id}`}
                to={`/chat/${c.listingId}`}
                state={{ receiverId: c.otherUser.id }}
                onClick={(e) => openRow(c, e)}
                className={active ? 'ib-row active' : 'ib-row'}
              >
                <Avatar src={c.otherUser.profilePicture} name={c.otherUser.fullName} size={48} />
                <div className="ib-main">
                  <div className="ib-line">
                    <span className={unread > 0 ? 'ib-name strong' : 'ib-name'}>{c.otherUser.fullName}</span>
                    <span className={unread > 0 ? 'ib-time hot' : 'ib-time'}>{listTime(c.lastMessageAt)}</span>
                  </div>
                  <div className="ib-item">{c.listingTitle}</div>
                  <div className="ib-line">
                    <span
                      className={`ib-preview${unread > 0 ? ' strong' : ''}${c.lastDeleted ? ' deleted' : ''}`}
                    >
                      {c.lastFromMe && !c.lastDeleted && <ChatTicks read={c.lastRead} delivered={false} size={15} />}
                      <span>{previewOf(c)}</span>
                    </span>
                    {unread > 0 && <span className="ib-badge">{unread > 99 ? '99+' : unread}</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="ib-right">
        {isDesktop && selected ? (
          <Chat
            key={`${selected.listingId}-${selected.receiverId || 'x'}`}
            embedded
            listingId={selected.listingId}
            receiverId={selected.receiverId || undefined}
            otherName={selConv ? selConv.otherUser.fullName : undefined}
            otherPhoto={selConv ? selConv.otherUser.profilePicture : undefined}
            onActivity={handleActivity}
          />
        ) : (
          <EmptyPane />
        )}
      </div>
    </div>
  );
}