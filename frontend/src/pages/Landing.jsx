import { Link } from 'react-router-dom';

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
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ color: 'var(--color-primary)' }}>
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
              <Link to="/signup" className="lp-btn lp-btn-outline">Create account</Link>
              <button type="button" className="lp-textlink" onClick={scrollToHow}>
                See how it works
              </button>
            </div>
            <p className="lp-note">Sign up with your university email to get a verified badge.</p>
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
          <p>Create an account with your university email, or look around first.</p>
          <div className="lp-actions">
            <Link to="/signup" className="lp-btn lp-btn-light">Create account</Link>
            <Link to="/browse" className="lp-btn lp-btn-ghost-light">Browse listings</Link>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <p>SafeSwap. Verified secondhand for Maseno University students.</p>
          <nav aria-label="Footer">
            <Link to="/browse">Browse</Link>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

const CSS = `
.lp { color: var(--color-ink); }
.lp *, .lp *::before, .lp *::after { box-sizing: border-box; }
.lp h1, .lp h2, .lp h3, .lp p, .lp ul, .lp ol { margin: 0; }
.lp-wrap { width: 100%; max-width: 1080px; margin: 0 auto; padding: 0 20px; }
.lp-check { color: var(--color-primary); flex-shrink: 0; }

/* Buttons */
.lp-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 13px 22px; border-radius: 10px; font-size: 15px; font-weight: 600;
  text-decoration: none; text-align: center; cursor: pointer; line-height: 1.2;
  transition: background 0.15s, transform 0.1s;
}
.lp-btn:active { transform: translateY(1px); }
.lp-btn:focus-visible, .lp-textlink:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--color-teal) 45%, transparent); outline-offset: 2px;
}
.lp-btn-primary { background: var(--color-primary); color: #fff; border: 1.5px solid var(--color-primary); }
.lp-btn-outline { background: #fff; color: var(--color-primary); border: 1.5px solid var(--color-primary); }
.lp-btn-light { background: #fff; color: var(--color-primary); border: 1.5px solid #fff; }
.lp-btn-ghost-light { background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.7); }
.lp-textlink {
  background: none; border: none; box-shadow: none; border-radius: 6px;
  min-width: 0; min-height: 0; width: auto; padding: 8px 4px;
  color: var(--color-teal); font-size: 15px; font-weight: 600; cursor: pointer;
}

/* Hero */
.lp-hero { padding: 36px 0 44px; }
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
.lp-mock-photo {
  height: 140px; display: flex; align-items: center; justify-content: center;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 8%, #fff);
}
.lp-mock-body { padding: 16px 18px 18px; }
.lp-mock-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.lp-mock-title { font-size: 17px; font-weight: 700; }
.lp-mock-price { margin-top: 2px; font-size: 15px; font-weight: 600; color: var(--color-primary); }
.lp-mock-tag {
  font-size: 11px; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
  background: var(--color-surface); color: var(--color-muted); border: 1px solid