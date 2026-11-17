import { useState, useRef } from 'react';

// Pill textarea that grows up to 120px, Enter to send, Shift+Enter for a new line.
// `onSend` may be async. If it resolves to `false` the text is kept, so a failed
// send doesn't lose what the user typed.
export default function ChatInput({ onSend, onTyping }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const hasText = text.trim().length > 0;

  async function submit() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const ok = await onSend(content);
      if (ok !== false) {
        setText('');
        if (inputRef.current) inputRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    submit();
  }

  function handleChange(e) {
    setText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    onTyping?.();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form onSubmit={handleSubmit} style={s.row} className="msg-input-row">
      <textarea
        ref={inputRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Type a message"
        maxLength={1000}
        rows={1}
        style={{
          ...s.input,
          borderColor: focused ? 'var(--color-primary)' : 'var(--color-border)',
        }}
      />
      <button
        type="submit"
        aria-label="Send message"
        disabled={!hasText || sending}
        // keeps the textarea focused so the mobile keyboard stays open
        onMouseDown={(e) => e.preventDefault()}
        style={{ ...s.sendBtn, ...(!hasText ? s.sendBtnDisabled : {}) }}
      >
        {sending ? (
          <span style={{ fontSize: 18, letterSpacing: 2, lineHeight: 1 }}>···</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        )}
      </button>
    </form>
  );
}

const s = {
  row: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid var(--color-border)',
    alignItems: 'flex-end',
    background: 'var(--color-card)',
    boxSizing: 'border-box',
    width: '100%',
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: '10px 16px',
    border: '1px solid var(--color-border)',
    borderRadius: 22,
    fontSize: 14.5,
    lineHeight: 1.5,
    outline: 'none',
    background: 'var(--color-surface)',
    color: 'var(--color-ink)',
    transition: 'border-color 0.15s',
    resize: 'none',
    maxHeight: 120,
    overflowY: 'auto',
    display: 'block',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: 44,
    height: 44,
    // index.css gives every button a 110px minimum width, which made this an oval
    minWidth: 0,
    padding: 0,
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'flex-end',
    boxShadow: '0 2px 8px color-mix(in srgb, var(--color-primary) 30%, transparent)',
    transition: 'all 0.15s',
  },
  sendBtnDisabled: {
    background: 'var(--color-border)',
    color: 'var(--color-muted)',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};