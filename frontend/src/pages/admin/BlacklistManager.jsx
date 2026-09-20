import { useState, useEffect } from 'react';
import { getBlacklist, addBlacklistImei, removeBlacklistImei } from '../../api/admin.api';

export default function BlacklistManager() {
  const [entries, setEntries] = useState([]);
  const [imei, setImei] = useState('');
  const [error, setError] = useState('');

  function load() {
    getBlacklist().then((res) => setEntries(res.data));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    try {
      await addBlacklistImei(imei);
      setImei('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add');
    }
  }

  async function handleRemove(id) {
    await removeBlacklistImei(id);
    load();
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      <h2>IMEI blacklist (simulated)</h2>
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          placeholder="15-digit test IMEI"
          value={imei}
          onChange={(e) => setImei(e.target.value)}
          maxLength={15}
        />
        <button type="submit">Add</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {entries.map((e) => (
        <div key={e._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e7eb' }}>
          <span>{e.imei}</span>
          <button onClick={() => handleRemove(e._id)}>Remove</button>
        </div>
      ))}
    </div>
  );
}