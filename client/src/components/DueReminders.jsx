'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/db';
import { effectiveStatus, money, waNumber } from '../lib/format';
import useBanks from '../lib/useBanks';
import { reminderText } from '../lib/pay';

const dayKey = () => 'reminded-' + new Date().toISOString().slice(0, 10);
const readDone = () => { try { return JSON.parse(localStorage.getItem(dayKey()) || '[]'); } catch { return []; } };

// Today's payment reminders: every agent who still owes money, with a one-click WhatsApp message.
// A tick shows who was already reminded today (it resets every day).
export default function DueReminders() {
  const [rows, setRows] = useState([]);
  const [wa, setWa] = useState({});
  const [done, setDone] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const { banks } = useBanks();

  useEffect(() => {
    setDone(readDone());
    Promise.all([
      supabase.from('pending_payments').select('*'),
      supabase.from('profiles').select('id,whatsapp').eq('role', 'agent'),
    ]).then(([p, a]) => {
      if (!p.error) setRows(p.data);
      if (!a.error) setWa(Object.fromEntries(a.data.map(x => [x.id, x.whatsapp])));
      setLoaded(true);
    });
  }, []);

  const groups = useMemo(() => {
    const g = {};
    rows.filter(r => effectiveStatus(r) !== 'expired' && Number(r.balance) > 0).forEach(r => {
      (g[r.agent_id] ||= { id: r.agent_id, name: r.agency_name, items: [], total: 0 }).items.push(r);
      g[r.agent_id].total += Number(r.balance);
    });
    return Object.values(g).sort((a, b) => b.total - a.total);
  }, [rows]);

  function link(g) {
    const num = waNumber(wa[g.id]);
    if (!num) return null;
    const text = reminderText(g, banks);
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }
  function mark(id) {
    const next = [...new Set([...done, id])];
    setDone(next);
    try { localStorage.setItem(dayKey(), JSON.stringify(next)); } catch { /* ignore */ }
  }

  if (!loaded || groups.length === 0) return null;
  const left = groups.filter(g => !done.includes(g.id)).length;
  return (
    <div className="card">
      <h2>Payment reminders for today <span className="badge" style={{ marginLeft: 8, background: left ? '#fff3d6' : '#dcf5e7', color: left ? '#8a5a00' : '#0d6b38' }}>{left ? `${left} to remind` : 'All done today'}</span></h2>
      <div className="scroll"><table>
        <thead><tr><th>Agent</th><th>Bookings</th><th>Total due</th><th></th></tr></thead>
        <tbody>
          {groups.map(g => {
            const l = link(g);
            const d = done.includes(g.id);
            return (
              <tr key={g.id}>
                <td><b>{g.name}</b></td>
                <td>{g.items.length}</td>
                <td className="neg">{money(g.total)}</td>
                <td>{l ? <a href={l} target="_blank" rel="noreferrer" onClick={() => mark(g.id)}><button type="button" className={d ? 'ghost' : 'ok'}>{d ? '✓ Reminded - send again' : 'Remind on WhatsApp'}</button></a> : <span className="muted small">No WhatsApp number</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <p className="muted small">Tip: press the green buttons every morning. Each message already includes your bank account details. A tick means you reminded that agent today (resets daily).</p>
    </div>
  );
}
