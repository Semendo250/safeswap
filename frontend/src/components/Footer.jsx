import { useContext } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { WHATSAPP_URL, WHATSAPP_LABEL, PHONE_LABEL, PHONE_TEL, PHONE_SMS, SUPPORT_EMAIL } from '../utils/contact';

const OFFERS = [
  'IMEI-checked phone listings',
  'Verified student accounts',
  'M-Pesa payment held until handover',
  'Campus safe meetup zones',
  'In-app chat and alerts',
  'Trust scores and reporting',
];

export default function Footer() {
  const { user } = useContext(AuthContext);
  const { pathname } = useLocation();
  const year = new Date().getFullYear();

  // Logged-in people get the short footer everywhere except the landing page
  const compact = !!user && pathname !== '/';

  if (compact) {
    return (
      <footer className="sf-compact">
        <div className="sf-compact-inner">
          <span>&copy; {year} SafeSwap. All rights reserved.</span>
          <nav aria-label="Footer">
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/support">Support</Link>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="sf">
      <div className="sf-wrap">
        <div className="sf-grid">
          <div className="sf-brand">
            <img src="/logo-full.svg" alt="SafeSwap" />
            <p>
              A verified secondhand marketplace for Maseno University students. Buy and sell phones and everyday
              items without the risk.
            </p>
          </div>

          <div>
            <h4>What SafeSwap offers</h4>
            <ul className="sf-offers">
              {OFFERS.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4>Support</h4>
            <ul>
              <li>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                  WhatsApp {WHATSAPP_LABEL}
                </a>
              </li>
                            <li>
                <a href={PHONE_TEL}>Call {PHONE_LABEL}</a>
              </li>
              <li>
                <a href={PHONE_SMS}>Send a text (SMS)</a>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} style={{ overflowWrap: 'anywhere' }}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li>
                <Link to="/support">Help and safety</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4>Legal</h4>
            <ul>
              <li>
                <Link to="/terms">Terms and Conditions</Link>
              </li>
              <li>
                <Link to="/privacy">Privacy Policy</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="sf-safety">
          <strong>Phone safety:</strong> every phone listing needs a valid IMEI and a proof photo, is checked against
          our blacklist, and is reviewed by an admin before it goes live.{' '}
          <Link to="/support">See how the IMEI check works</Link>
        </div>

        <div className="sf-bottom">
          <span>&copy; {year} SafeSwap. All rights reserved.</span>
          <span>Made for Maseno University students.</span>
        </div>
      </div>
    </footer>
  );
}