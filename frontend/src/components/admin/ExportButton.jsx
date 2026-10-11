import { useState } from 'react';
import { downloadExport } from '../../api/admin.api';
import { btn } from './AdminUi';

// With a file download the error arrives as a blob, so it has to be read before it can be shown
async function exportErrorText(err) {
  if (!err.response) return 'Network error. Check your connection and try again.';
  try {
    const data = err.response.data;
    const text = data && typeof data.text === 'function' ? await data.text() : '';
    const json = JSON.parse(text);
    if (json && typeof json.error === 'string' && json.error) return json.error;
  } catch (e) {
    // not JSON, fall through
  }
  return 'Could not export. Try again.';
}

// kind: 'payments' | 'users'. params are sent to the server as filters.
export default function ExportButton({ kind, params, label = 'Export CSV', onDone, onError }) {
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await downloadExport(kind, params);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `safeswap-${kind}-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      if (onDone) onDone('Export downloaded. Open it in Excel or Google Sheets.');
    } catch (err) {
      const message = await exportErrorText(err);
      if (onError) onError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={run} disabled={busy} style={btn('outline')}>
      {busy ? 'Preparing...' : label}
    </button>
  );
}