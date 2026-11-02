import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { dt, money } from '@/lib/format';

// Shows every important change in the system: who did what, and when.
export default function Activity() {
  const [rows, setRows] = useState([]);
  const [people, setPeople] = useState({});
  const [refs, setRefs] = useState({});
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [a, p, b, f] = await Promise.all([
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('profiles').select('id,agency_name,role'),
        supabase.from('bookings').select('id,ref').limit(2000),
        supabase.from('flights').select('id,flight_no,origin,destination'),
      ]);
      const err = a.error || p.error || b.error || f.error;
      if (err) { setError(err.message); return; }
      setRows(a.data);
      setPeople(Object.fromEntries(p.data.map(x => [x.id, x.role === 'admin' ? 'Main Agency' : x.agency_name])));
      setRefs({
        ...Object.fromEntries(b.data.map(x => [x.id, `booking ${x.ref}`])),
        ...Object.fromEntries(f.data.map(x => [x.id, `flight ${x.flight_no} (${x.origin}-${x.destination})`])),
        ...Object.fromEntries(p.data.map(x => [x.id, x.agency_name])),
      });
      setLoaded(true);
    })();
  }, []);

  const describe = r => {
    const d = r.detail || {};
    const t = refs[r.target] || 'item';
    switch (r.action) {
      case 'agent_status': return `Agent ${t} set to ${d.status}`;
      case 'booking_status': return `${cap(t)} set to ${d.status}`;
      case 'extend_hold': return `Hold extended by ${d.hours}h on ${t}`;
      case 'payment': return `Payment ${money(d.amount)}${d.method ? ' (' + d.method + ')' : ''} recorded on ${t}`;
      case 'issue_ticket': return `Ticket issued for ${t}`;
      case 'passenger_edit': return `Passenger edited: ${nm(d.before)} → ${nm(d.after)}`;
      case 'flight_insert': return `Flight added: ${d.flight}`;
      case 'flight_update': return `Flight updated: ${d.flight}`;
      case 'flight_delete': return `Flight deleted: ${d.flight}`;
      case 'edit_unlock': return `Agent editing ${d.unlocked ? 'UNLOCKED' : 'locked'} for ${t}`;
      case 'set_pnr': return `PNR set to ${d.pnr || '(empty)'} on ${t}`;
      case 'set_flight_pnr': return `PNR set to ${d.pnr || '(empty)'} on ${t}`;
      default: return r.action;
    }
  };

  const groups = {
    all: () => true,
    payments: r => r.action === 'payment',
    bookings: r => ['booking_status', 'extend_hold', 'issue_ticket', 'edit_unlock', 'set_pnr', 'set_flight_pnr'].includes(r.action),
    passengers: r => r.action === 'passenger_edit',
    flights: r => r.action.startsWith('flight_') || r.action === 'set_flight_pnr',
    agents: r => r.action === 'agent_status',
  };
  const shown = useMemo(() => rows.filter(groups[filter]), [rows, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Shell role="owner" title="Activity Log">
      {error && <div className="error">{error}</div>}
      <div className="card">
        <div className="tabs">
          {Object.keys(groups).map(k => (
            <button key={k} className={filter === k ? '' : 'ghost'} onClick={() => setFilter(k)}>{k[0].toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
        {!loaded ? <p className="muted">Loading...</p> : shown.length === 0 ? <p className="muted">No activity yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}><td style={{ whiteSpace: 'nowrap' }}>{dt(r.created_at)}</td><td>{people[r.actor] || 'System'}</td><td>{describe(r)}</td></tr>
              ))}
            </tbody>
          </table></div>
        )}
        <p className="muted small">Shows the latest 300 changes. Passenger edits show the old and new name.</p>
      </div>
    </Shell>
  );
}

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const nm = o => (o ? `${o.first_name || ''} ${o.last_name || ''} / ${o.passport_number || ''}`.trim() : '?');
