import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { WHATSAPP_URL, WHATSAPP_LABEL, PHONE_LABEL, PHONE_TEL, PHONE_SMS, SUPPORT_EMAIL } from '../utils/contact';

export default function Support() {
  return (
    <div className="legal-page">
      <BackButton />
      <h1>Help and safety</h1>
      <p className="legal-updated">Contact us, learn how SafeSwap keeps deals safe, and find quick answers.</p>

      <div className="help-contact">
        <a className="help-btn" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          <span className="help-btn-icon" aria-hidden="true">💬</span>
          <span>
            <strong>WhatsApp</strong>
            <small>{WHATSAPP_LABEL}</small>
          </span>
        </a>
                <a className="help-btn" href={PHONE_TEL}>
          <span className="help-btn-icon" aria-hidden="true">📞</span>
          <span>
            <strong>Call us</strong>
            <small>{PHONE_LABEL}</small>
          </span>
        </a>
        <a className="help-btn" href={PHONE_SMS}>
          <span className="help-btn-icon" aria-hidden="true">💬</span>
          <span>
            <strong>Send a text (SMS)</strong>
            <small>{PHONE_LABEL}</small>
          </span>
        </a>
        <a className="help-btn" href={`mailto:${SUPPORT_EMAIL}`}>
          <span className="help-btn-icon" aria-hidden="true">✉️</span>
          <span>
            <strong>Email</strong>
            <small>{SUPPORT_EMAIL}</small>
          </span>
        </a>
      </div>

      <h2 id="imei">How the IMEI check keeps phone deals safe</h2>
      <p>
        Every phone has a unique 15-digit IMEI number. Stolen phones are a real risk in secondhand sales, so SafeSwap
        puts every phone listing through the steps below before anyone can buy it.
      </p>

      <ol className="help-steps">
        <li>
          <strong>A valid IMEI is required.</strong> The seller must enter a 15-digit IMEI. We verify it with the
          standard IMEI checksum, so typing mistakes and made-up numbers do not pass.
        </li>
        <li>
          <strong>Blacklist check.</strong> The IMEI is compared against the SafeSwap blacklist of blocked devices. A
          phone that matches is marked as blacklisted and flagged.
        </li>
        <li>
          <strong>Proof photo.</strong> The seller uploads one photo that shows the phone's IMEI screen (dial *#06#)
          together with their National ID, School ID or School Temporary ID, both clearly visible. This shows the seller
          really has the phone in hand and ties the listing to a real person.
        </li>
        <li>
          <strong>Admin review before it goes live.</strong> A phone listing is not visible to buyers until an admin
          approves it. The admin checks that the IMEI in the listing matches the proof photo. Flagged or blacklisted
          phones get extra scrutiny, and an admin can only approve one by recording a reason in the activity log.
        </li>
        <li>
          <strong>Reports and trust.</strong> Anyone can report a suspicious listing. Admins review reports, remove
          listings that break the rules, and lower the seller's trust score or ban the account.
        </li>
        <li>
          <strong>Payment is held.</strong> When you pay with M-Pesa, SafeSwap holds the payment until you confirm you
          received the item.
        </li>
      </ol>

      <div className="help-note">
        <strong>What the IMEI check cannot do.</strong> It lowers the risk but it is not a guarantee. The blacklist
        covers devices that SafeSwap has blocked. It is not a national or police database, so a stolen phone that has
        never been reported to us can still pass. Always check the phone yourself at the meetup: dial *#06# and make
        sure the IMEI on the phone matches the listing before you confirm the handover.
      </div>

      <h2>Quick answers</h2>

      <details className="help-faq">
        <summary>How does payment work?</summary>
        <p>
          You pay with M-Pesa. SafeSwap holds the payment, and it is released to the seller after you confirm the
          handover. Only confirm once you have the item and you are happy with it.
        </p>
      </details>

      <details className="help-faq">
        <summary>The item is not as described. What should I do?</summary>
        <p>
          Do not confirm the handover. Contact us on WhatsApp or email straight away with the listing name and what is
          wrong, and an admin will look into it.
        </p>
      </details>

      <details className="help-faq">
        <summary>How do I report a suspicious listing?</summary>
        <p>
          Open the listing and use the report option. Admins review every report. You can also message us directly if
          it is urgent.
        </p>
      </details>

      <details className="help-faq">
        <summary>Why is my phone listing not showing yet?</summary>
        <p>
          Phone listings are reviewed by an admin before they go live. You get a notification as soon as yours is
          approved. Until then only you can see it.
        </p>
      </details>

      <details className="help-faq">
        <summary>How do I change my phone number or location?</summary>
        <p>Go to Profile, open the Edit profile tab, update your details and save.</p>
      </details>

      <details className="help-faq">
        <summary>I am not getting notifications.</summary>
        <p>
          Open the bell icon and tap Turn on, then allow notifications when asked. If you blocked them earlier, allow
          them again in your browser or phone settings for SafeSwap, then reload the app.
        </p>
      </details>

      <p style={{ marginTop: 24 }}>
        Read our <Link to="/terms">Terms and Conditions</Link> and <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}