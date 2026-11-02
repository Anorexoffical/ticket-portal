'use client';
import { useState } from 'react';
import { supabase } from '../lib/db';

// Admin: record a payment (full or part) for one booking.
export default function PayForm({ bookingId, balance, onDone }) {
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    setErr('');
    const n = Number(amount);
    if (!(n > 0)) { setErr('Enter an amount.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('admin_record_payment', {
      p_booking: bookingId, p_amount: n, p_method: method, p_note: note || null,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onDone && onDone();
  }

  return (
    <div>
      <div className="row">
        <div><label>Amount received</label><input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        <div><label>Method</label>
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option>Cash</option><option>Bank transfer</option><option>Online / Easypaisa / JazzCash</option><option>Cheque</option>
          </select>
        </div>
        <div><label>Note (optional)</label><input value={note} onChange={e => setNote(e.target.value)} placeholder="Receipt no. etc." /></div>
        <button className="ok" disabled={busy} onClick={save}>{busy ? 'Saving...' : 'Record payment'}</button>
      </div>
      {err && <div className="error">{err}</div>}
    </div>
  );
}
