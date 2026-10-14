import { useState } from 'react';
import { messageUser } from '../../api/admin.api';
import { Modal, btn, errText } from './AdminUi';

// Starts a conversation with a student. It shows up in Complaints and in the student's My complaints page.
export default function MessageUserModal({ user, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await messageUser(user._id, { subject: subject.trim(), text: text.trim() });
      onSent(res.data);
    } catch (err) {
      setError(errText(err, 'Could not send the message.'));
      setBusy(false);
    }
  }

  const ready = subject.trim().length >= 3 && text.trim().length >= 1;

  return (
    <Modal title={`Message ${user.fullName}`} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-muted)', lineHeight: 1.5 }}>
          They get a notification and can read and answer this in their My complaints page. The conversation also
          appears under Complaints.
        </p>
        <input
          placeholder="Subject"
          value={subject}
          maxLength={120}
          onChange={(e) => setSubject(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        <textarea
          rows={5}
          placeholder="Your message"
          value={text}
          maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          style={{ marginBottom: 8 }}
        />
        {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
            Cancel
          </button>
          <button type="submit" disabled={busy || !ready} style={btn('primary', { padding: '9px 16px' })}>
            {busy ? 'Sending...' : 'Send message'}
          </button>
        </div>
      </form>
    </Modal>
  );
}