import { useEffect, useState } from 'react';
import {
  getVerificationQueue,
  approveFallbackVerification,
  rejectFallbackVerification,
} from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Notice,
  Field,
  ConfirmDialog,
  PhotoLightbox,
  Thumb,
  CopyText,
  btn,
  errText,
  fmtDate,
} from '../../components/admin/AdminUi';

export default function VerificationQueue() {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    getVerificationQueue()
      .then((res) => {
        setUsers(res.data);
        setError('');
      })
      .catch((err) => setError(errText(err, 'Could not load the queue.')));
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(u) {
    setBusyId(u._id);
    try {
      await approveFallbackVerification(u._id);
      setNotice(`${u.fullName} was approved.`);
      load();
    } catch (err) {
      setError(errText(err, 'Could not approve.'));
    } finally {
      setBusyId(null);
    }
  }

  function askReject(u) {
    setDialog({
      title: `Reject ${u.fullName}'s ID?`,
      message:
        'They are removed from this queue and marked "ID rejected". Their account is not blocked; use Users to ban them if needed.',
      confirmLabel: 'Reject',
      danger: true,
      askReason: 'optional',
      onConfirm: async (reason) => {
        await rejectFallbackVerification(u._id, reason);
        setDialog(null);
        setNotice(`${u.fullName} was rejected.`);
        load();
      },
    });
  }

  return (
    <PageShell
      title="Verification queue"
      subtitle={users ? `${users.length} waiting for a decision` : undefined}
    >
      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning">{error}</Notice>}
      {!users && !error && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}
      {users && users.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Nothing pending.</p>}

      {users &&
        users.map((u) => (
          <div
            key={u._id}
            style={{ border: '1px solid var(--color-border)', borderRadius: 10, padding: 12, marginBottom: 10, background: '#fff' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ fontSize: 15 }}>{u.fullName}</strong>
              {!u.emailVerified && <Chip tone="gold">Email not verified</Chip>}
            </div>
            <Field label="Email"><CopyText value={u.email} /></Field>
            <Field label="Reg no">{u.studentRegNo}</Field>
            <Field label="Phone">{u.phone ? <CopyText value={u.phone} /> : 'Not given'}</Field>
            {u.location && <Field label="Location">{u.location}</Field>}
            <Field label="Signed up">{fmtDate(u.createdAt)}</Field>

            <div style={{ margin: '10px 0' }}>
              {u.fallbackIdPhoto ? (
                <Thumb
                  src={u.fallbackIdPhoto}
                  label="ID photo (tap to enlarge)"
                  size={120}
                  onClick={() => setViewer([{ src: u.fallbackIdPhoto, label: `${u.fullName}: ID photo` }])}
                />
              ) : (
                <span style={{ fontSize: 13, color: 'var(--color-warning)' }}>No ID photo uploaded</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" disabled={busyId === u._id} onClick={() => approve(u)} style={btn('primary')}>
                {busyId === u._id ? 'Approving...' : 'Approve'}
              </button>
              <button type="button" disabled={busyId === u._id} onClick={() => askReject(u)} style={btn('danger')}>
                Reject
              </button>
            </div>
          </div>
        ))}

      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
      {viewer && <PhotoLightbox images={viewer} onClose={() => setViewer(null)} />}
    </PageShell>
  );
}