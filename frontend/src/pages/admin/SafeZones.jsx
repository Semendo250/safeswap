import { useEffect, useState } from 'react';
import {
  getSafeZonesAdmin,
  createSafeZone,
  updateSafeZone,
  deleteSafeZone,
} from '../../api/admin.api';
import {
  PageShell,
  Chip,
  Notice,
  Modal,
  ConfirmDialog,
  btn,
  errText,
} from '../../components/admin/AdminUi';

const box = {
  border: '1px solid var(--color-border)',
  borderRadius: 10,
  padding: 12,
  background: 'var(--color-card)',
  marginBottom: 10,
};

function RenameModal({ zone, onClose, onSaved }) {
  const [name, setName] = useState(zone.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await updateSafeZone(zone._id, { name });
      onSaved();
    } catch (err) {
      setError(errText(err, 'Could not rename.'));
      setBusy(false);
    }
  }

  return (
    <Modal title="Rename meetup spot" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        {zone.listingCount > 0 && (
          <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-muted)' }}>
            {zone.listingCount} listing{zone.listingCount === 1 ? '' : 's'} use this spot and will show the new name.
          </p>
        )}
        <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} style={{ marginBottom: 10 }} />
        {error && <p style={{ color: 'var(--color-warning)', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            style={btn('primary', { padding: '9px 16px' })}
          >
            {busy ? 'Saving...' : 'Save name'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function SafeZones() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSafeZonesAdmin()
      .then((res) => {
        if (!cancelled) setZones(res.data.zones || []);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load meetup spots.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  async function add(e) {
    e.preventDefault();
    if (adding) return;
    setAdding(true);
    setError('');
    setNotice('');
    try {
      await createSafeZone(newName.trim());
      setNotice(`"${newName.trim()}" added. Users can pick it right away.`);
      setNewName('');
      reload();
    } catch (err) {
      setError(errText(err, 'Could not add the spot.'));
    } finally {
      setAdding(false);
    }
  }

  async function toggle(z) {
    setError('');
    setNotice('');
    try {
      await updateSafeZone(z._id, { active: !z.active });
      setNotice(z.active ? `"${z.name}" is now hidden from the picker.` : `"${z.name}" is visible again.`);
      reload();
    } catch (err) {
      setError(errText(err, 'Could not update the spot.'));
    }
  }

  function askDelete(z) {
    setDialog({
      title: `Delete "${z.name}"?`,
      message: 'This removes the spot for good. If any listing uses it, hide it instead.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        await deleteSafeZone(z._id);
        setDialog(null);
        setNotice(`"${z.name}" was deleted.`);
        reload();
      },
    });
  }

  const activeCount = zones.filter((z) => z.active).length;

  return (
    <PageShell
      title="Meetup spots"
      subtitle={`${activeCount} spot${activeCount === 1 ? '' : 's'} users can pick right now. Changes apply straight away.`}
    >
      <form onSubmit={add} style={{ ...box, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          placeholder="New spot, e.g. Cafeteria entrance"
          value={newName}
          maxLength={60}
          onChange={(e) => setNewName(e.target.value)}
          style={{ flex: 1, minWidth: 180 }}
        />
        <button
          type="submit"
          disabled={adding || newName.trim().length < 2}
          style={btn('primary', { padding: '9px 16px' })}
        >
          {adding ? 'Adding...' : 'Add spot'}
        </button>
      </form>

      {notice && <Notice onClose={() => setNotice('')}>{notice}</Notice>}
      {error && <Notice tone="warning" onClose={() => setError('')}>{error}</Notice>}
      {loading && zones.length === 0 && <p style={{ color: 'var(--color-muted)' }}>Loading...</p>}

      {zones.map((z) => (
        <div key={z._id} style={box}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ fontSize: 15, wordBreak: 'break-word' }}>{z.name}</strong>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                <Chip tone={z.active ? 'success' : 'muted'}>{z.active ? 'Visible' : 'Hidden'}</Chip>
                <Chip tone="muted">
                  Used by {z.listingCount} listing{z.listingCount === 1 ? '' : 's'}
                </Chip>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setRenaming(z)} style={btn('outline')}>
                Rename
              </button>
              <button type="button" onClick={() => toggle(z)} style={btn('outline')}>
                {z.active ? 'Hide' : 'Show'}
              </button>
              <button type="button" onClick={() => askDelete(z)} style={btn('danger')}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}

      {renaming && (
        <RenameModal
          zone={renaming}
          onClose={() => setRenaming(null)}
          onSaved={() => {
            setRenaming(null);
            setNotice('Meetup spot renamed.');
            reload();
          }}
        />
      )}
      {dialog && <ConfirmDialog {...dialog} onCancel={() => setDialog(null)} />}
    </PageShell>
  );
}