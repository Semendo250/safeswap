import { useEffect, useRef, useState } from 'react';

// A refresh button that visibly reacts: the icon spins, the label changes and the button
// is highlighted while it works. busy: pass true while the page is loading.
// Without busy it still shows the effect for a moment after every click.
export default function RefreshButton({ onClick, busy = false, label = 'Refresh' }) {
  const [pressed, setPressed] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const spinning = busy || pressed;

  function handleClick() {
    if (spinning) return;
    setPressed(true);
    timer.current = setTimeout(() => setPressed(false), 700);
    onClick();
  }

  return (
    <>
      <style>{`
        button.rb-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          min-width: 112px; align-self: auto; padding: 7px 12px;
          font-size: 13px; font-weight: 600; line-height: 1.2; border-radius: var(--radius);
          background: var(--color-card); color: var(--color-ink); border: 1px solid var(--color-border);
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s, background 0.15s, transform 0.1s;
        }
        button.rb-btn:hover:not(.rb-busy) {
          background: var(--color-card); border-color: var(--color-teal); color: var(--color-teal);
        }
        button.rb-btn:active:not(.rb-busy) { transform: scale(0.95); }
        button.rb-btn:focus-visible { outline: 2px solid var(--color-teal); outline-offset: 2px; }
        button.rb-btn.rb-busy, button.rb-btn.rb-busy:hover {
          cursor: default; border-color: var(--color-teal); color: var(--color-teal);
          background: color-mix(in srgb, var(--color-teal) 10%, var(--color-card));
        }
        .rb-icon { display: block; flex-shrink: 0; }
        .rb-busy .rb-icon { animation: rb-spin 0.8s linear infinite; }
        @keyframes rb-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .rb-busy .rb-icon { animation: none; } }
      `}</style>
      <button
        type="button"
        onClick={handleClick}
        aria-busy={spinning}
        aria-disabled={spinning}
        className={spinning ? 'rb-btn rb-busy' : 'rb-btn'}
      >
        <svg
          className="rb-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
        <span>{spinning ? 'Refreshing...' : label}</span>
      </button>
    </>
  );
}