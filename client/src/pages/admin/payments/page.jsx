import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import PayForm from '@/components/PayForm';
import { dt, waNumber, effectiveStatus, money, timeLeft } from '@/lib/format';
import { AGENCY_NAME } from '@/lib/config';

// One page showing every unpaid / part-paid booking, grouped by agent.
export default function PendingPayments() {
  const [rows, setRows] = useState([]);
  const [wa, setWa] = useState({});
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      supabase.from('pending_payments').select('*').order('agency_name').order('hold_expires_at'),
      supabase.from('profiles').select('id,whatsapp').eq('role', 'agent'),
    ]);
    if (p.error || a.error) { setError((p.error || a.error).message); return; }
    setRows(p.data);
    setWa(Object.fromEntries(a.data.map(x => [x.id, x.whatsapp])));
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const g = {};
    rows.filter(r => effectiveStatus(r) !== 'expired').forEach(r => {
      (g[r.agent_id] ||= { id: r.agent_id, name: r.agency_name, items: [], total: 0 }).items.push(r);
      g[r.agent_id].total += Number(r.balance);
    });
    return Object.values(g).sort((a, b) => b.total - a.total);
  }, [rows]);

  const grand = groups.reduce((s, g) => s + g.total, 0);

  async function cancel(r) {
    const warn = Number(r.paid_amount) > 0
      ? `${r.ref} is part-paid (${money(r.paid_amount)}). Cancelling frees the seats but does NOT refund. Remove this booking?`
      : `Remove booking ${r.ref} and free the seats?`;
    if (!confirm(warn)) return;
    const { error } = await supabase.rpc('admin_set_booking_status', { p_booking: r.booking_id, p_status: 'cancelled' });
    if (error) setError(error.message); else { setMsg(`${r.ref} cancelled.`); setError(''); load(); }
  }

  function reminder(g) {
    const num = waNumber(wa[g.id]);
    if (!num) return null;
    const lines = g.items.map(i => `• ${i.ref}: ${money(i.balance)}`).join('\n');
    const text = `Assalam o Alaikum ${g.name},\nPayment reminder from ${AGENCY_NAME}.\n${lines}\nTotal due: ${money(g.total)}\nPlease pay to keep your bookings confirmed. Thank you.`;
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  return (
    <Shell role="admin" title="Pending Payments">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      {!loaded ? <p className="muted">Loading...</p> : (
        <>
          <div className="stats">
            <div className="stat"><span className="muted small">Total pending</span><b className="neg">{money(grand)}</b></div>
            <div className="stat"><span className="muted small">Agents who owe</span><b>{groups.length}</b></div>
          </div>
          {groups.length === 0 && <div className="card"><p className="muted">Nothing pending. All bookings are fully paid.</p></div>}
          {groups.map(g => {
            const link = reminder(g);
            return (
              <div className="card" key={g.id}>
                <div className="flight">
                  <div><div className="route">{g.name}</div><div className="muted small">{g.items.length} booking(s)</div></div>
                  <div className="actions">
                    <div className="price neg">{money(g.total)}</div>
                    {link && <a href={link} target="_blank" rel="noreferrer"><button className="ok" type="button">WhatsApp reminder</button></a>}
                  </div>
                </div>
                <div className="scroll"><table>
                  <thead><tr><th>Ref</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th><th>Hold</th><th></th></tr></thead>
                  <tbody>
                    {g.items.map(r => (
                      <PendingRow key={r.booking_id} r={r} open={open === r.booking_id}
                        toggle={() => setOpen(open === r.booking_id ? null : r.booking_id)}
                        onPaid={() => { setMsg('Payment recorded.'); setError(''); setOpen(null); load(); }}
                        onCancel={() => cancel(r)} />
                    ))}
                  </tbody>
                </table></div>
              </div>
            );
          })}
        </>
      )}
    </Shell>
  );
}

function PendingRow({ r, open, toggle, onPaid, onCancel }) {
  const st = effectiveStatus(r);
  const holdOver = r.status === 'on_hold' && !Number(r.paid_amount) && new Date(r.hold_expires_at) <= Date.now();
  return (
    <>
      <tr>
        <td><b>{r.ref}</b></td><td>{money(r.total_amount)}</td><td>{money(r.paid_amount)}</td>
        <td className="neg">{money(r.balance)}</td>
        <td><span className={'badge ' + st}>{st.replace('_', ' ')}</span></td>
        <td>{r.status === 'on_hold' && Number(r.paid_amount) > 0 ? <span className="pos small">Timer off (paid)</span> : r.status === 'on_hold' ? <><b>{timeLeft(r.hold_expires_at)}</b><div className="muted small">{dt(r.hold_expires_at)}</div></> : '-'}</td>
        <td><div className="actions">
          <button className="ok" onClick={toggle}>{open ? 'Close' : 'Record payment'}</button>
          <button className="bad" onClick={onCancel}>Remove</button>
        </div></td>
      </tr>
      {open && <tr><td colSpan="7">{holdOver ? <div className="info">Hold time is over. Extend it from the Bookings page first.</div> : <PayForm bookingId={r.booking_id} balance={r.balance} onDone={onPaid} />}</td></tr>}
    </>
  );
}
