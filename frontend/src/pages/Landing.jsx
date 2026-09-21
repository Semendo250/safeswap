import { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const STEPS = [
  {
    title: 'Find something',
    text: 'Browse phones and everyday items from students on campus, then message the seller in the app.',
  },
  {
    title: 'Pick a safe zone',
    text: 'Agree where to meet. Choose from the library entrance, main gate, student center or a hostel common room.',
  },
  {
    title: 'Pay with M-Pesa',
    text: 'Your payment is held by SafeSwap. It does not go straight to the seller.',
  },
  {
    title: 'Confirm the handover',
    text: 'Once you have the item and confirm, the payment is released to the seller.',
  },
];

const FEATURES = [
  {
    title: 'IMEI check on every phone',
    text: 'Phone listings are checked against a blacklist. Flagged devices are held for review instead of going live.',
  },
  {
    title: 'Proof photo from phone sellers',
    text: 'Sellers upload a photo of the phone next to their student ID before it can be listed.',
  },
  {
    title: 'Verified accounts',
    text: 'Every seller shows how they were verified, by university email or by admin approval.',
  },
  {
    title: 'Trust scores',
    text: "Each seller carries a trust score on their listings, so you know who you're dealing with.",
  },
  {
    title: 'Report anything suspicious',
    text: 'Report a listing and admins review it.',
  },
  {
    title: 'Chat in the app',
    text: 'Ask questions and arrange the meetup without leaving SafeSwap.',
  },
];

const ZONES = ['Library entrance', 'Main gate', 'Student center', 'Hostel common room'];

function scrollToHow() {
  const el = document.getElementById('how-it-works');
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function CheckIcon({ size = 20 }) {
  return (
    <svg className="lp-check" width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="currentColor" opacity="0.12" />
      <path
        d="M5.5 10.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ color: 'var(--lp-primary)' }}>
      <path
        d="M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" fill="currentColor" />
    </svg>
  );
}

function PhoneArt() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="18" y="6" width="28" height="52" rx="6" fill="none" stroke="currentColor" strokeWidth="3" />
      <line x1="27" y1="12" x2="37" y2="12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="50" r="2.2" fill="currentColor" />
    </svg>
  );
}

export default function Landing() {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;

  return (
    <div className="lp">
      <style>{CSS}</style>

      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-wrap lp-hero-grid">
          <div>
            <h1 className="lp-h1">Buy and sell secondhand on campus without the risk.</h1>
            <p className="lp-lead">
              SafeSwap checks phone IMEIs against a blacklist, verifies students, and holds your M-Pesa payment
              until you confirm the handover.
            </p>
            <div className="lp-actions">
              <Link to="/browse" className="lp-btn lp-btn-primary">Browse listings</Link>
              {user ? (
                <Link to="/create-listing" className="lp-btn lp-btn-outline">Create a listing</Link>
              ) : (
                <Link to="/signup" className="lp-btn lp-btn-outline">Create account</Link>
              )}
              <button type="button" className="lp-textlink" onClick={scrollToHow}>
                See how it works
              </button>
            </div>
            {!user && <p className="lp-note">Sign up with your university email to get a verified badge.</p>}
          </div>

          {/* Sample listing: shows the checks every deal goes through */}
          <div className="lp-mock" aria-hidden="true">
            <div className="lp-mock-photo">
              <PhoneArt />
            </div>
            <div className="lp-mock-body">
              <div className="lp-mock-top">
                <div>
                  <p className="lp-mock-title">Samsung A04e</p>
                  <p className="lp-mock-price">KES 9,500</p>
                </div>
                <span className="lp-mock-tag">Example listing</span>
              </div>
              <ul className="lp-mock-checks">
                <li><CheckIcon size={18} /> IMEI checked: clean</li>
                <li><CheckIcon size={18} /> Seller verified with university email</li>
                <li><CheckIcon size={18} /> Meetup at Library entrance</li>
                <li><CheckIcon size={18} /> M-Pesa payment held until you confirm</li>
              </ul>
              <div className="lp-mock-pay">Pay with M-Pesa</div>
            </div>
          </div>
        </div>
      </section>

      {/* How a deal works */}
      <section id="how-it-works" className="lp-band lp-section" aria-labelledby="lp-how-title">
        <div className="lp-wrap">
          <h2 id="lp-how-title" className="lp-h2">How a deal works</h2>
          <p className="lp-sub">Four steps from finding an item to the seller getting paid.</p>
          <ol className="lp-steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className="lp-step">
                <span className="lp-step-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Safety features */}
      <section className="lp-section" aria-labelledby="lp-safe-title">
        <div className="lp-wrap">
          <h2 id="lp-safe-title" className="lp-h2">Safety built into every listing</h2>
          <p className="lp-sub">
            You shouldn't have to trust a stranger. SafeSwap gives you something to check instead.
          </p>
          <ul className="lp-features">
            {FEATURES.map((f) => (
              <li key={f.title} className="lp-feature">
                <CheckIcon />
                <div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Safe zones */}
      <section className="lp-wrap lp-zones-wrap" aria-labelledby="lp-zones-title">
        <div className="lp-zones">
          <div>
            <h2 id="lp-zones-title" className="lp-h2">Meet where people are around</h2>
            <p className="lp-sub">
              When you agree a deal, pick one of four campus safe zones for the handover.
            </p>
          </div>
          <div className="lp-pills">
            {ZONES.map((z) => (
              <span key={z} className="lp-pill"><PinIcon /> {z}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section className="lp-cta" aria-labelledby="lp-cta-title">
        <div className="lp-wrap">
          <h2 id="lp-cta-title" className="lp-h2">Ready to swap safely?</h2>
          <p>
            {user
              ? 'Browse what is for sale, or list something of your own.'
              : 'Create an account with your university email, or look around first.'}
          </p>
          <div className="lp-actions">
            {user ? (
              <>
                <Link to="/browse" className="lp-btn lp-btn-light">Browse listings</Link>
                <Link to="/create-listing" className="lp-btn lp-btn-ghost-light">Create a listing</Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="lp-btn lp-btn-light">Create account</Link>
                <Link to="/browse" className="lp-btn lp-btn-ghost-light">Browse listings</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <p>SafeSwap. Verified secondhand for Maseno University students.</p>
          <nav aria-label="Footer">
            <Link to="/browse">Browse</Link>
            {!user && (
              <>
                <Link to="/login">Log in</Link>
                <Link to="/signup">Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.lp {
  /* Maseno University colours */
  --lp-primary: #126567;  /* deep teal */
  --lp-light: #65C1CF;    /* light teal (tints only) */
  --lp-gold: #F0B256;     /* gold accent */
  --lp-dark: #0B2E30;     /* text on gold */
  --lp-tint: color-mix(in srgb, var(--lp-light) 16%, #fff);
  color: var(--color-ink);
}
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp h1, .lp h2, .lp h3, .lp p, .lp ul, .lp ol { margin: 0; }
.lp-wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 20px; }
.lp-check { color: var(--lp-primary); flex-shrink: 0; }

/* Buttons */
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 13px 22px; border-radius: 10px; font-size: 15px; font-weight: 600;
  text-decoration: none; text-align: center; cursor: pointer; line-height: 1.2;
  transition: background 0.15s, transform 0.1s;
}
.lp-btn:active { transform: translateY(1px); }
.lp-btn:focus-visible, .lp-textlink:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--lp-primary) 45%, transparent); outline-offset: 2px;
}
.lp-btn-primary { background: var(--lp-primary); color: #fff; border: 1.5px solid var(--lp-primary); }
.lp-btn-primary:hover { background: color-mix(in srgb, var(--lp-primary) 86%, #000); }
.lp-btn-outline { background: #fff; color: var(--lp-primary); border: 1.5px solid var(--lp-primary); }
.lp-btn-outline:hover { background: var(--lp-tint); }
/* Main button in the dark band is gold (class name kept so the page code doesn't change) */
.lp-btn-light { background: var(--lp-gold); color: var(--lp-dark); border: 1.5px solid var(--lp-gold); }
.lp-btn-light:hover { background: color-mix(in srgb, var(--lp-gold) 88%, #fff); }
.lp-btn-ghost-light { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.7); }
.lp-textlink {
  background: none; border: none; box-shadow: none; border-radius: 6px;
  min-width: 0; min-height: 0; width: auto; padding: 8px 4px;
  color: var(--lp-primary); font-size: 15px; font-weight: 600; cursor: pointer;
}

/* Hero */
.lp-hero { padding: 36px 0 44px; background: linear-gradient(180deg, var(--lp-tint) 0%, #fff 100%); }
.lp-hero-grid { display: grid; gap: 36px; align-items: center; }
.lp-h1 { font-size: clamp(32px, 8vw, 54px); line-height: 1.08; font-weight: 800; letter-spacing: -0.025em; }
.lp-lead {
  margin-top: 16px; max-width: 520px; font-size: 17px; line-height: 1.6;
  color: color-mix(in srgb, var(--color-ink) 72%, #fff);
}
.lp-actions { margin-top: 26px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
.lp-note { margin-top: 14px; font-size: 13px; color: var(--color-muted); }

/* Sample listing card */
.lp-mock {
  width: 100%; max-width: 380px; margin: 0 auto; background: #fff;
  border: 1px solid var(--color-border); border-radius: 16px; overflow: hidden;
  box-shadow: 0 14px 34px rgba(0,0,0,0.08);
}
.lp-mock::before { content: ''; display: block; height: 4px; background: var(--lp-gold); }
.lp-mock-photo {
  height: 140px; display: flex; align-items: center; justify-content: center;
  color: var(--lp-primary);
  background: color-mix(in srgb, var(--lp-light) 22%, #fff);
}
.lp-mock-body { padding: 16px 18px 18px; }
.lp-mock-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.lp-mock-title { font-size: 17px; font-weight: 700; }
.lp-mock-price { margin-top: 2px; font-size: 15px; font-weight: 600; color: var(--lp-primary); }
.lp-mock-tag {
  font-size: 11px; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
  background: var(--color-surface); color: var(--color-muted); border: 1px solid var(--color-border);
}
.lp-mock-checks { list-style: none; padding: 0; margin-top: 14px; display: grid; gap: 10px; }
.lp-mock-checks li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; line-height: 1.4; }
.lp-mock-pay {
  margin-top: 16px; padding: 12px; border-radius: 10px; text-align: center;
  background: var(--lp-primary); color: #fff; font-size: 15px; font-weight: 600;
}

/* Sections */
.lp-section { padding: 48px 0; }
.lp-band { background: var(--lp-tint); }
#how-it-works { scroll-margin-top: 72px; }
.lp-h2 { font-size: clamp(24px, 5.5vw, 34px); line-height: 1.15; font-weight: 800; letter-spacing: -0.02em; }
.lp-sub {
  margin-top: 10px; max-width: 560px; font-size: 16px; line-height: 1.6;
  color: color-mix(in srgb, var(--color-ink) 72%, #fff);
}

/* Steps */
.lp-steps { list-style: none; padding: 0; margin-top: 28px; display: grid; gap: 22px; }
.lp-step { display: flex; gap: 14px; }
.lp-step-num {
  flex-shrink: 0; width: 32px; height: 32px; border-radius: 50%;
  background: var(--lp-primary); color: #fff; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.lp-step h3 { font-size: 16px; font-weight: 700; }
.lp-step p { margin-top: 4px; font-size: 14px; line-height: 1.55; color: var(--color-muted); }

/* Features */
.lp-features { list-style: none; padding: 0; margin-top: 26px; display: grid; gap: 0 48px; }
.lp-feature { display: flex; gap: 12px; padding: 18px 0; border-top: 1px solid var(--color-border); }
.lp-feature h3 { font-size: 16px; font-weight: 700; }
.lp-feature p { margin-top: 4px; font-size: 14px; line-height: 1.55; color: var(--color-muted); }

/* Safe zones */
.lp-zones-wrap { padding-bottom: 48px; }
.lp-zones {
  display: grid; gap: 20px; padding: 28px 22px; border-radius: 16px;
  background: var(--lp-tint);
  border: 1px solid color-mix(in srgb, var(--lp-light) 45%, #fff);
}
.lp-pills { display: flex; flex-wrap: wrap; gap: 10px; }
.lp-pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 999px;
  background: #fff; border: 1px solid var(--color-border); font-size: 14px; font-weight: 600;
}

/* Final call to action */
.lp-cta { background: var(--lp-primary); color: #fff; text-align: center; padding: 52px 0; }
.lp-cta .lp-h2 { color: #fff; }
.lp-cta p { margin: 10px auto 0; max-width: 480px; line-height: 1.6; color: rgba(255,255,255,0.88); }
.lp-cta .lp-actions { justify-content: center; }

/* Footer */
.lp-footer { border-top: 1px solid var(--color-border); padding: 22px 0 28px; font-size: 13px; color: var(--color-muted); }
.lp-footer-inner { display: flex; flex-wrap: wrap; gap: 10px 24px; justify-content: space-between; align-items: center; }
.lp-footer nav { display: flex; gap: 18px; }
.lp-footer a { color: var(--color-muted); text-decoration: none; }

@media (max-width: 480px) {
  .lp-actions .lp-btn { flex: 1 1 100%; }
}

@media (min-width: 860px) {
  .lp-hero { padding: 72px 0 80px; }
  .lp-hero-grid { grid-template-columns: 1.1fr 0.9fr; gap: 56px; }
  .lp-mock { justify-self: end; }
  .lp-section { padding: 72px 0; }
  .lp-steps { grid-template-columns: repeat(4, 1fr); gap: 28px; }
  .lp-step { flex-direction: column; gap: 12px; }
  .lp-features { grid-template-columns: 1fr 1fr; }
  .lp-zones-wrap { padding-bottom: 72px; }
  .lp-zones { grid-template-columns: 1fr 1fr; align-items: center; padding: 40px; gap: 32px; }
  .lp-cta { padding: 72px 0; }
}
`;