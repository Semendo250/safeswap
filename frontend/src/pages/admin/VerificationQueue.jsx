import { useState, useEffect } from 'react';
import { getVerificationQueue, approveFallbackVerification } from '../../api/admin.api';

export default function VerificationQueue() {
  const [users, setUsers] = useState([]);

  function load() {
    getVerificationQueue().then((res) => setUsers(res.data));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(userId) {
    await approveFallbackVerification(userId);
    load();
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '1rem' }}>
      <h2>Verification queue</h2>
      {users.length === 0 && <p>Nothing pending.</p>}
      {users.map((u) => (
        <div key={u._id} style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px', marginBottom: '8px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{u.fullName}</p>
          <p style={{ margin: '2px 0', fontSize: '13px', color: '#6b7280' }}>
            {u.email} &middot; Reg {u.studentRegNo}
          </p>
          {u.fallbackIdPhoto && (
            <img src={u.fallbackIdPhoto} alt="ID proof" style={{ width: '100%', maxWidth: '200px', marginTop: '6px', borderRadius: '8px' }} />
          )}
          <button onClick={() => handleApprove(u._id)} style={{ marginTop: '6px' }}>Approve</button>
        </div>
      ))}
    </div>
  );
}