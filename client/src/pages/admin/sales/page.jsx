import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import SalesPanel from '@/components/SalesPanel';
import { money, dShort } from '@/lib/format';

// Sales graph, buying price + supplier of each flight (bulk seats), and which staff may see profit.
export default function AdminSales() {
  return <Shell role="admin" title="Sales and profit">{p => <Sales owner={p?.role === 'admin'} />}</Shell>;
}

function Sales({ owner }) {
  const [denied, setDenied] = useState(false);
  const [rows, setRows] = useState(null);
  const [fl, setFl] = useState({});
  const [ed, setEd] = useState({});     // flight id -> { supplier, buy }
  const [staff, setStaff] = useState([]);
  const [supNames, setSupNames] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const [p, f] = await Promise.all([
      supabase.rpc('admin_flight_profit'),
      supabase.from('flights_with_seats').select('id,airline,flight_no,origin,destination,departure_at'),
    ]);
    if (p.error) { if (/No access/i.test(p.error.message)) setDenied(true); else setError(p.error.message); return; }
    setRows(p.data);
    if (!f.error) setFl(Object.fromEntries(f.data.map(x => [x.id, x])));
    setEd(Object.fromEntries(p.data.map(r => [r.flight_id, { supplier: r.supplier || '', buy: r.buy_price == null ? '' : String(Number(r.buy_price)) }])));
    const su = await supabase.from('suppliers').select('name').eq('active', true).order('name');
    if (!su.error) setSupNames(su.data.map(x => x.name));
    if (owner) {
      const s = await supabase.from('profiles').select('id,email,agency_name,can_see_profit').eq('role', 'staff');
      if (!s.error) setStaff(s.data);
    }
  }, [owner]);
  useEffect(() => { load(); }, [load]);

  async function save(id) {
    setError(''); setMsg(''); setBusy(id);
    const e = ed[id];
    const { error } = await supabase.rpc('owner_set_flight_cost', { p_flight: id, p_supplier: e.supplier, p_buy: e.buy === '' ? null : Number(e.buy) });
    setBusy('');
    if (error) setError(error.message); else { setMsg('Saved.'); load(); }
  }
  async function tick(id, on) {
    setError(''); setMsg('');
    const { error } = await supabase.rpc('owner_set_profit_access', { p_user: id, p_on: on });
    if (error) setError(error.message); else { setStaff(staff.map(s => (s.id === id ? { ...s, can_see_profit: on } : s))); setMsg(on ? 'Staff can now see sales and profit.' : 'Staff can no longer see sales and profit.'); }
  }
  const set = (id, k, v) => setEd({ ...ed, [id]: { ...ed[id], [k]: v } });

  if (denied) return <div className="info">You do not have access to this page. Ask the main admin to tick it for you.</div>;

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      <SalesPanel detailsLink={false} onNoAccess={() => setDenied(true)} />

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Buying price and supplier</h2>
        <p className="muted small" style={{ margin: '0 0 10px' }}>Type what you paid per seat and who you bought the block from. Profit = sale price minus buying price. Leave it empty if you do not want to track it for a flight. Agents never see this.</p>
        <datalist id="sup-list">{supNames.map(n => <option key={n} value={n} />)}</datalist>
        {!rows ? <p className="muted">Loading...</p> : rows.length === 0 ? <p className="muted">No flights yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Flight</th><th>Date</th><th>Seats sold</th><th>Sales</th><th>Bought from</th><th>Buy price per seat</th><th>Profit</th>{owner && <th></th>}</tr></thead>
            <tbody>
              {rows.map(r => {
                const f = fl[r.flight_id]; const e = ed[r.flight_id]; if (!e) return null;
                const changed = e.supplier !== (r.supplier || '') || e.buy !== (r.buy_price == null ? '' : String(Number(r.buy_price)));
                return (
                  <tr key={r.flight_id}>
                    <td>{f ? <><b>{f.flight_no}</b><div className="small muted">{f.origin} → {f.destination}</div></> : '-'}</td>
                    <td>{f ? dShort(f.departure_at) : '-'}</td>
                    <td>{r.seats_sold}</td>
                    <td>{money(r.sales)}</td>
                    <td><input list="sup-list" style={{ minWidth: 130 }} value={e.supplier} disabled={!owner} maxLength={80} onChange={ev => set(r.flight_id, 'supplier', ev.target.value)} placeholder="Supplier" /></td>
                    <td><input type="number" min="0" style={{ width: 120 }} value={e.buy} disabled={!owner} onChange={ev => set(r.flight_id, 'buy', ev.target.value)} placeholder="optional" /></td>
                    <td>{r.profit == null ? <span className="muted small">-</span> : <b className={Number(r.profit) < 0 ? 'neg' : ''}>{money(r.profit)}</b>}</td>
                    {owner && <td><button className={changed ? 'ok' : 'ghost'} disabled={!changed || busy === r.flight_id} onClick={() => save(r.flight_id)}>Save</button></td>}
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        <p className="muted small" style={{ margin: '8px 0 0' }}>Shows flights from the last 90 days and all future flights. Infants count as a seat in the cost, so leave the buying price empty if infants make it wrong.</p>
      </div>

      {owner && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Staff who can see sales and profit</h2>
          {staff.length === 0 ? <p className="muted">You have no staff members yet.</p> : staff.map(s => (
            <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, margin: '8px 0' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={!!s.can_see_profit} onChange={e => tick(s.id, e.target.checked)} /> {s.agency_name || s.email} <span className="muted small">{s.email}</span>
            </label>
          ))}
          <p className="muted small" style={{ margin: '6px 0 0' }}>Staff who are not ticked cannot see the graph, the profit or the buying prices.</p>
        </div>
      )}
    </>
  );
}
