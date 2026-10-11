import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { WHATSAPP_URL, WHATSAPP_LABEL, SUPPORT_EMAIL } from '../utils/contact';

export default function Terms() {
  return (
    <div className="legal-page">
      <BackButton />
      <h1>Terms and Conditions</h1>
      <p className="legal-updated">Last updated: 11 October 2026</p>

      <p>
        These terms explain how you may use SafeSwap. By creating an account or using the app, you agree to them. If you
        do not agree, please do not use SafeSwap.
      </p>

      <h2>1. About SafeSwap</h2>
      <p>
        SafeSwap is an online marketplace where Maseno University students buy and sell phones and everyday items.
        SafeSwap connects buyers and sellers and provides safety tools. We are not the seller of the items listed, and
        we are not a party to the sale between a buyer and a seller.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>Give accurate information when you sign up and keep it up to date.</li>
        <li>
          Accounts are verified either with a university email or by admin approval. We may approve, reject or suspend
          an account at our discretion.
        </li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>Do not create accounts for other people or use fake identities or documents.</li>
      </ul>

      <h2>3. Listings</h2>
      <ul>
        <li>Describe items honestly and use real photos of the item you are selling.</li>
        <li>
          Do not list stolen, counterfeit, illegal or dangerous items, or anything you do not have the right to sell.
        </li>
        <li>
          Phone listings need a valid IMEI and a proof photo showing the IMEI screen next to your ID. Entering a false
          IMEI or a misleading proof photo is a serious breach of these terms.
        </li>
        <li>
          Phone listings are reviewed by an admin before they go live. We may remove or refuse any listing, and we may
          hold a listing for review at any time.
        </li>
      </ul>

      <h2>4. IMEI and safety checks</h2>
      <p>
        We check phone IMEIs for a valid format and against the SafeSwap blacklist, and we require a proof photo. These
        checks reduce risk but do not guarantee that a phone is genuine or lawfully owned. Buyers should inspect the
        phone and confirm its IMEI at the meetup before confirming the handover. You can read how the checks work on the{' '}
        <Link to="/support">Help and safety</Link> page.
      </p>

      <h2>5. Payments</h2>
      <ul>
        <li>Payments are made with M-Pesa.</li>
        <li>
          SafeSwap holds the payment until the buyer confirms the handover, and then the payment is released to the
          seller. It does not go straight to the seller when you pay.
        </li>
        <li>Only confirm the handover once you have received the item and are satisfied with it.</li>
        <li>
          If something goes wrong, contact support before confirming. Disputes and refund requests are reviewed by
          SafeSwap admins, and we decide each case on the facts.
        </li>
        <li>You are responsible for entering the correct phone number when paying.</li>
      </ul>

      <h2>6. Meeting safely</h2>
      <p>
        When you agree a deal, choose one of the campus safe zones for the handover. Meet in a place where other people
        are around. SafeSwap is not responsible for what happens at a meetup, so please use good judgement.
      </p>

      <h2>7. Acceptable use</h2>
      <ul>
        <li>No fraud, scams, harassment, threats or abusive messages.</li>
        <li>No fake reports, fake reviews or attempts to manipulate trust scores.</li>
        <li>No attempts to bypass SafeSwap payments or safety checks.</li>
        <li>No scraping, hacking or interfering with the app or other users' accounts.</li>
      </ul>

      <h2>8. Reports, removals and bans</h2>
      <p>
        Users can report listings and behaviour. Admins review reports and may remove listings, lower trust scores,
        suspend or ban accounts, or delete accounts that break these terms. If you think a decision was a mistake,
        contact support and we will look at it again.
      </p>

      <h2>9. Our responsibility</h2>
      <p>
        We work to keep SafeSwap safe and available, but we cannot promise it will always be free of errors or
        interruptions. We do not guarantee the quality, safety or legality of items listed by users. To the extent the
        law allows, SafeSwap is not liable for losses arising from deals between users. Nothing in these terms limits
        any right you have under Kenyan consumer law that cannot be limited.
      </p>

      <h2>10. Changes to these terms</h2>
      <p>
        We may update these terms from time to time. The date at the top shows when they were last changed. If you keep
        using SafeSwap after an update, you accept the new terms.
      </p>

      <h2>11. Governing law</h2>
      <p>These terms are governed by the laws of Kenya.</p>

      <h2>12. Contact us</h2>
      <p>
        Questions about these terms? WhatsApp us on{' '}
        <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
          {WHATSAPP_LABEL}
        </a>{' '}
        or email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. See also our{' '}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </div>
  );
}