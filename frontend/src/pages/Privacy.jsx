import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { WHATSAPP_URL, WHATSAPP_LABEL, SUPPORT_EMAIL } from '../utils/contact';

export default function Privacy() {
  return (
    <div className="legal-page">
      <BackButton />
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: 11 October 2026</p>

      <p>
        This policy explains what personal information SafeSwap collects, why we collect it, and the choices you have.
        We handle your information in line with the Data Protection Act, 2019 of Kenya.
      </p>

      <h2>1. What we collect</h2>
      <ul>
        <li>Account details: your name, email address, phone number and password (stored in protected form).</li>
        <li>Profile details: your profile picture and the location you choose to add.</li>
        <li>
          Verification details: your university email, or your ID photo if you are verified by admin approval, and any
          student registration number you provide.
        </li>
        <li>
          Listing details: titles, descriptions, prices, photos, and for phones, the IMEI and the proof photo of the
          IMEI screen with your ID.
        </li>
        <li>Messages you send to other users in the app chat.</li>
        <li>
          Payment records: the M-Pesa phone number used, the amount, the receipt and the status of each payment. We do
          not see or store your M-Pesa PIN.
        </li>
        <li>Reports you make or that are made about you or your listings.</li>
        <li>
          Device information needed to send notifications, and your login session and display preferences (such as dark
          mode), which are stored on your device.
        </li>
      </ul>

      <h2>2. How we use it</h2>
      <ul>
        <li>To create and verify your account and keep the marketplace safe.</li>
        <li>To run listings, chat and payments between buyers and sellers.</li>
        <li>To check phones (IMEI checks and proof photos) and review reports.</li>
        <li>To send you notifications about your account, listings, messages and payments.</li>
        <li>To prevent fraud and abuse, and to resolve disputes.</li>
        <li>To meet our legal obligations.</li>
      </ul>

      <h2>3. What other users can see</h2>
      <p>
        Your name, profile picture, trust score, verification badge and listings are visible to other users. Logged-in
        buyers can also see the phone number and location you add on your profile. Your ID photo and your phone proof
        photos are used for verification and safety checks and are reviewed by SafeSwap admins. Your password is never
        visible to anyone.
      </p>

      <h2>4. Who we share information with</h2>
      <p>We do not sell your personal information. We use trusted service providers to run SafeSwap, including:</p>
      <ul>
        <li>Image hosting, to store profile, listing and proof photos.</li>
        <li>Firebase (Google), to deliver push notifications.</li>
        <li>M-Pesa (Safaricom), to process payments.</li>
        <li>Database and hosting providers, to store and serve the app.</li>
      </ul>
      <p>We may also share information when the law requires it, or to protect users from fraud or harm.</p>

      <h2>5. Notifications</h2>
      <p>
        If you turn on notifications, we store a device token so we can reach your device. You can turn notifications
        off at any time in your browser or phone settings.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        We keep your information while your account is active. If your account is deleted, your profile, listings and
        messages are removed. Payment records may be kept for as long as needed for accounting, dispute handling and
        legal reasons.
      </p>

      <h2>7. Security</h2>
      <p>
        We use reasonable technical measures to protect your information, such as encrypted connections and protected
        password storage. No system is perfectly secure, so please use a strong password and keep it private.
      </p>

      <h2>8. Your rights</h2>
      <p>
        You can ask to see the information we hold about you, correct it, or ask us to delete it, and you can object to
        certain uses. You can edit your phone number, location and picture yourself under Profile. For anything else,
        contact us using the details below.
      </p>

      <h2>9. Changes to this policy</h2>
      <p>
        We may update this policy from time to time. The date at the top shows when it was last changed.
      </p>

      <h2>10. Contact us</h2>
      <p>
        WhatsApp us on{' '}
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          {WHATSAPP_LABEL}
        </a>{' '}
        or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our{' '}
        <Link to="/terms">Terms and Conditions</Link>.
      </p>
    </div>
  );
}