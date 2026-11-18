import { useState } from 'react';
import { checkReceipt, addReceipt } from '../../api/finance.api';
import { Modal, btn, errText, money } from './AdminUi';

const ICON = { pass: '✓', fail: '✕', warn: '!', info: 'i' };
const COLOR = {
  pass: 'var(--color-success)',
  fail: 'var(--color-warning)',
  warn: 'var(--color-gold)',
  info: 'var(--color-muted)',
};
const EMPTY = { code: '', amount: '', phone: '', name: '', paidAt: '', cost: '' };

// ISO time -> value for a datetime-local box, in Nairobi time
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function fromResult(f) {
  return {
    code: f.code || '',
    amount: f.amount !== null && f.amount !== undefined ? String(f.amount) : '',
    phone: f.phone ? `0${String(f.phone).slice(3)}` : '',
    name: f.name || '',
    paidAt: toLocalInput(f.paidAt),
    cost: f.cost ? String(f.cost) : '',
  };
}

function Row({ label, children }) {
  return (
    <div className="rcp-row">
      <span className="rcp-row-label">{label}</span>
      <span className="rcp-row-value">{children}</span>
    </div>
  );
}

export default function ReceiptDialog({ s, onCancel, onDone }) {
  const [text, setText] = useState('');
  const [manual, setManual] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const [result, setResult] = useState(null);
  const [partialTick, setPartialTick] = useState(false);
  const [phoneTick, setPhoneTick] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isRefund = s.type === 'refund';
  const body = () => (manual ? { text, manual: true, fields } : { text, manual: false });
  const setField = (k, v) => setFields((p) => ({ ...p, [k]: v }));

  async function runCheck() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await checkReceipt(s._id, body());
      const r = res.data;
      setPartialTick(false);
      setPhoneTick(false);
      setReason('');
      if (!manual && !r.complete) {
        setManual(true);
        setFields(fromResult(r.fields));
        setResult(null);
        setError('I could not read everything from that message. Check the details below and fill in what is missing.');
      } else {
        setResult(r);
      }
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  const ready =
    result &&
    !result.blocking &&
    (!result.softFails || reason.trim().length >= 3) &&
    (!result.needsPhoneTick || phoneTick) &&
    (!result.needsPartialTick || partialTick);

  async function confirm() {
    if (busy || !ready) return;
    setBusy(true);
    setError('');
    try {
      const res = await addReceipt(s._id, {
        ...body(),
        phoneConfirmed: phoneTick,
        partialConfirmed: partialTick,
        overrideReason: reason.trim(),
      });
      onDone(res.data);
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  }

  const f = result ? result.fields : null;

  return (
    <Modal title={isRefund ? 'Add refund receipt' : 'Add payout receipt'} onClose={onCancel} busy={busy}>
      <style>{`
        .rcp-intro { margin: 0 0 10px; font-size: 14px; line-height: 1.5; }
        .rcp-row { display: flex; justify-content: space-between; gap: 12px; padding: 5px 0; font-size: 13px; }
        .rcp-row-label { color: var(--color-muted); flex-shrink: 0; }
        .rcp-row-value { font-weight: 600; text-align: right; word-break: break-word; }
        .rcp-box { border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); margin: 8px 0 12px; padding: 4px 0; }
        .rcp-check { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; font-size: 13px; line-height: 1.45; }
        .rcp-icon {
          flex: 0 0 20px; width: 20px; height: 20px; border-radius: 50%; color: #fff;
          display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
        }
        .rcp-check-label { font-weight: 600; }
        .rcp-tick { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; margin: 10px 0 0; line-height: 1.45; }
        .rcp-tick input { width: auto; min-width: 0; margin-top: 2px; }
        .rcp-field { margin-bottom: 8px; }
        .rcp-field label { display: block; margin-bottom: 2px; font-size: 11px; font-weight: 600; color: var(--color-muted); }
        .rcp-note { margin: 0 0 10px; padding: 8px 10px; border-radius: 8px; font-size: 12px; line-height: 1.5; background: var(--color-gold-bg); color: var(--color-gold); }
        .rcp-error { margin: 8px 0 0; font-size: 13px; color: var(--color-warning); }
        .rcp-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 14px; flex-wrap: wrap; }
      `}</style>

      <p className="rcp-intro">
        {isRefund ? 'Refund' : 'Pay'} <strong>{money(s.remaining)}</strong> to <strong>{s.sendTo.name}</strong>
        {s.sendTo.phone ? ` on ${s.sendTo.phone}` : ''} in M-Pesa first
        {s.paidSoFar > 0 ? ` (${money(s.paidSoFar)} was already sent)` : ''}. Then paste the whole confirmation SMS below.
      </p>

      {/* Step 1: paste the message */}
      {!result && !manual && (
        <>
          <textarea
            rows={5}
            maxLength={2000}
            placeholder="Paste the full M-Pesa confirmation message here"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {error && <p className="rcp-error">{error}</p>}
          <div className="rcp-actions">
            <button type="button" onClick={() => setManual(true)} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
              Enter by hand
            </button>
            <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={runCheck}
              disabled={busy || !text.trim()}
              style={btn('primary', { padding: '9px 16px' })}
            >
              {busy ? 'Checking...' : 'Check message'}
            </button>
          </div>
        </>
      )}

      {/* Step 1b: type the details by hand */}
      {!result && manual && (
        <>
          <p className="rcp-note">These details will be saved as "entered by hand".</p>
          <div className="rcp-field">
            <label>M-Pesa code (10 letters and numbers)</label>
            <input value={fields.code} maxLength={10} autoCapitalize="characters" onChange={(e) => setField('code', e.target.value.toUpperCase())} />
          </div>
          <div className="rcp-field">
            <label>Amount sent (KES)</label>
            <input type="number" inputMode="decimal" min="0" value={fields.amount} onChange={(e) => setField('amount', e.target.value)} />
          </div>
          <div className="rcp-field">
            <label>Recipient phone (optional)</label>
            <input type="tel" value={fields.phone} onChange={(e) => setField('phone', e.target.value)} />
          </div>
          <div className="rcp-field">
            <label>Recipient name (optional)</label>
            <input value={fields.name} maxLength={80} onChange={(e) => setField('name', e.target.value)} />
          </div>
          <div className="rcp-field">
            <label>Date and time sent</label>
            <input type="datetime-local" value={fields.paidAt} onChange={(e) => setField('paidAt', e.target.value)} />
          </div>
          <div className="rcp-field">
            <label>Transaction cost (optional)</label>
            <input type="number" inputMode="decimal" min="0" value={fields.cost} onChange={(e) => setField('cost', e.target.value)} />
          </div>
          {error && <p className="rcp-error">{error}</p>}
          <div className="rcp-actions">
            <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={runCheck}
              disabled={busy || !fields.code || !fields.amount || !fields.paidAt}
              style={btn('primary', { padding: '9px 16px' })}
            >
              {busy ? 'Checking...' : 'Check details'}
            </button>
          </div>
        </>
      )}

      {/* Step 2: what was read and what was checked */}
      {result && (
        <>
          {result.manual && <p className="rcp-note">Entered by hand. This will be saved as "entered by hand".</p>}

          <div className="rcp-box">
            <Row label="Code">{f.code || '-'}</Row>
            <Row label="Amount">{f.amount ? money(f.amount) : '-'}</Row>
            <Row label="Sent to">{f.phone ? `0${String(f.phone).slice(3)}` : 'No number in the message'}</Row>
            <Row label="Name">{f.name || '-'}</Row>
            <Row label="Time">{f.paidAt ? toLocalInput(f.paidAt).replace('T', ' ') : '-'}</Row>
            <Row label="Transaction cost">{money(f.cost || 0)}</Row>
          </div>

          {result.checks.map((c) => (
            <div key={c.key} className="rcp-check">
              <span className="rcp-icon" style={{ background: COLOR[c.status] }}>
                {ICON[c.status]}
              </span>
              <span>
                <span className="rcp-check-label">{c.label}: </span>
                {c.message}
              </span>
            </div>
          ))}

          {result.needsPartialTick && (
            <label className="rcp-tick">
              <input type="checkbox" checked={partialTick} onChange={(e) => setPartialTick(e.target.checked)} />
              <span>This is a part payment. The rest will be sent in another receipt.</span>
            </label>
          )}
          {result.needsPhoneTick && (
            <label className="rcp-tick">
              <input type="checkbox" checked={phoneTick} onChange={(e) => setPhoneTick(e.target.checked)} />
              <span>I sent it to the number on the order ({result.expected.phone}).</span>
            </label>
          )}

          {result.blocking && (
            <p className="rcp-error">This cannot be saved until the red items marked above are fixed.</p>
          )}
          {!result.blocking && result.softFails > 0 && (
            <>
              <p className="rcp-error">Some checks failed. You can still save it by giving a reason (it is logged).</p>
              <textarea
                rows={2}
                maxLength={300}
                placeholder="Reason for overriding (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </>
          )}
          {error && <p className="rcp-error">{error}</p>}

          <div className="rcp-actions">
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setError('');
              }}
              disabled={busy}
              style={btn('outline', { padding: '9px 16px' })}
            >
              Back
            </button>
            <button type="button" onClick={onCancel} disabled={busy} style={btn('outline', { padding: '9px 16px' })}>
              Cancel
            </button>
            <button type="button" onClick={confirm} disabled={busy || !ready} style={btn('primary', { padding: '9px 16px' })}>
              {busy ? 'Saving...' : result.softFails ? `Override and save ${money(f.amount)}` : `Confirm ${money(f.amount)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}