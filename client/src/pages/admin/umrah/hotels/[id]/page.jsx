import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { stars, num, fmtD, priceUnit, roomText, sortRooms } from '@/lib/umrah';

// One hotel: nightly rates (sale price; cost price only for the owner) and how many rooms can be sold per date range.
export default function HotelDetail() {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [rates, setRates] = useState([]);
  const [costs, setCosts] = useState({});
  const [allots, setAllots] = useState([]);
  const [rf, setRf] = useState(null);   // rate form: { rt, id, from, to, sale, cost }
  const [af, setAf] = useState(null);   // allotment form: { rt, id, from, to, rooms }
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const h = await supabase.from('umrah_hotels').select('*, umrah_room_types(*)').eq('id', id).single();
    if (h.error) { setError(h.error.message); return; }
    setHotel(h.data);
    const ids = (h.data.umrah_room_types || []).map(r => r.id);
    if (ids.length === 0) { setRates([]); setAllots([]); setCosts({}); return; }
    const [r, c, a] = await Promise.all([
      supabase.from('umrah_hotel_rates').select('*').in('room_type_id', ids).order('date_from'),
      supabase.from('umrah_rate_costs').select('*'),   // only the owner gets rows back
      supabase.from('umrah_room_allotment').select('*').in('room_type_id', ids).order('date_from'),
    ]);
    if (r.error) setError(r.error.message); else setRates(r.data);
    if (!c.error) setCosts(Object.fromEntries(c.data.map(x => [x.rate_id, x.cost_price])));
    if (a.error) setError(a.error.message); else setAllots(a.data);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function saveRate(e) {
    e.preventDefault(); setError(''); setMsg('');
    const { rt, id: rid, from, to, sale, cost } = rf;
    if (!from || !to) { setError('Enter both dates.'); return; }
    if (to < from) { setError('The end date must not be before the start date.'); return; }
    if (sale === '' || !(Number(sale) >= 0)) { setError('Enter the sale price.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_umrah_rate', {
      p_rate: rid || null, p_room_type: rt, p_from: from, p_to: to, p_sale: Number(sale),
      p_cost: cost === '' || cost == null ? null : Number(cost),
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg('Rate saved.'); setRf(null); load();
  }
  async function deleteRate(rid) {
    if (!confirm('Delete this rate?')) return;
    setError(''); setMsg('');
    const { error } = await supabase.rpc('admin_delete_umrah_rate', { p_rate: rid });
    if (error) setError(error.message); else { setMsg('Rate deleted.'); load(); }
  }

  async function saveAllot(e) {
    e.preventDefault(); setError(''); setMsg('');
    const { rt, id: aid, from, to, rooms } = af;
    if (!from || !to) { setError('Enter both dates.'); return; }
    if (to < from) { setError('The end date must not be before the start date.'); return; }
    if (rooms === '' || !(Number(rooms) >= 0)) { setError('Enter the number of rooms.'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_umrah_allotment', { p_id: aid || null, p_room_type: rt, p_from: from, p_to: to, p_rooms: parseInt(rooms, 10) });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg('Rooms saved.'); setAf(null); load();
  }
  async function deleteAllot(aid) {
    if (!confirm('Delete these rooms?')) return;
    setError(''); setMsg('');
    const { error } = await supabase.rpc('admin_delete_umrah_allotment', { p_id: aid });
    if (error) setError(error.message); else { setMsg('Deleted.'); load(); }
  }

  return (
    <Shell role="admin" title={hotel ? hotel.name : 'Hotel'}>{p => { const owner = p?.role === 'admin'; return (
      <>
        {error && <div className="error">{error}</div>}
        {msg && <div className="good">{msg}</div>}
        <div className="actions" style={{ marginBottom: 16 }}>
          <Link href="/admin/umrah/hotels"><button className="ghost">← Back to hotels</button></Link>
        </div>
        {!hotel ? <p className="muted">Loading...</p> : (
          <>
            <div className="card">
              <b>{hotel.name}</b> <span className="muted small">{stars(hotel.stars)} · {hotel.city}{hotel.meal_plan ? ` · ${hotel.meal_plan}` : ''}</span>
              <div className="muted small">Prices below are {priceUnit(hotel.pricing_type)}.</div>
            </div>

            {sortRooms(hotel.umrah_room_types).length === 0 && <div className="card"><p className="muted">This hotel has no room types yet. Go back and press Edit to add rooms.</p></div>}

            {sortRooms(hotel.umrah_room_types).map(rt => {
              const rr = rates.filter(x => x.room_type_id === rt.id);
              const aa = allots.filter(x => x.room_type_id === rt.id);
              return (
                <div className="card" key={rt.id}>
                  <h2>{roomText(rt)} <span className="muted small">· {rt.total_rooms} rooms in the hotel</span></h2>

                  <h3 style={{ marginBottom: 6 }}>Nightly rates</h3>
                  {rr.length === 0 ? <p className="muted small">No rates yet.</p> : (
                    <div className="scroll"><table>
                      <thead><tr><th>From</th><th>To</th><th>Sale price</th>{owner && <th>Cost</th>}{owner && <th>Profit</th>}<th></th></tr></thead>
                      <tbody>
                        {rr.map(x => (
                          <tr key={x.id}>
                            <td>{fmtD(x.date_from)}</td><td>{fmtD(x.date_to)}</td><td><b>{num(x.sale_price)}</b></td>
                            {owner && <td>{costs[x.id] != null ? num(costs[x.id]) : '-'}</td>}
                            {owner && <td>{costs[x.id] != null ? num(Number(x.sale_price) - Number(costs[x.id])) : '-'}</td>}
                            <td><div className="actions" style={{ flexWrap: 'nowrap' }}>
                              <button className="ghost" onClick={() => setRf({ rt: rt.id, id: x.id, from: x.date_from, to: x.date_to, sale: String(x.sale_price), cost: costs[x.id] != null ? String(costs[x.id]) : '' })}>Edit</button>
                              <button className="bad" onClick={() => deleteRate(x.id)}>Delete</button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}
                  {rf && rf.rt === rt.id ? (
                    <form className="panel" onSubmit={saveRate} style={{ marginTop: 10 }}>
                      <div className="grid">
                        <div><label>From date</label><input type="date" value={rf.from} onChange={e => setRf({ ...rf, from: e.target.value })} required /></div>
                        <div><label>To date</label><input type="date" value={rf.to} onChange={e => setRf({ ...rf, to: e.target.value })} required /></div>
                        <div><label>Sale price ({priceUnit(hotel.pricing_type)})</label><input type="number" min="0" value={rf.sale} onChange={e => setRf({ ...rf, sale: e.target.value })} required /></div>
                        {owner && <div><label>Your cost price (private)</label><input type="number" min="0" value={rf.cost} onChange={e => setRf({ ...rf, cost: e.target.value })} /></div>}
                      </div>
                      <div className="actions" style={{ marginTop: 10 }}>
                        <button disabled={busy}>{busy ? 'Saving...' : 'Save rate'}</button>
                        <button type="button" className="ghost" onClick={() => setRf(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ marginTop: 10 }}><button className="ghost" onClick={() => setRf({ rt: rt.id, id: null, from: '', to: '', sale: '', cost: '' })}>+ Add rate</button></div>
                  )}

                  <h3 style={{ margin: '18px 0 6px' }}>Rooms available to sell</h3>
                  {aa.length === 0 ? <p className="muted small">No dates yet. Add the dates and how many rooms you can sell.</p> : (
                    <div className="scroll"><table>
                      <thead><tr><th>From</th><th>To</th><th>Rooms</th><th></th></tr></thead>
                      <tbody>
                        {aa.map(x => (
                          <tr key={x.id}>
                            <td>{fmtD(x.date_from)}</td><td>{fmtD(x.date_to)}</td><td><b>{x.rooms}</b></td>
                            <td><div className="actions" style={{ flexWrap: 'nowrap' }}>
                              <button className="ghost" onClick={() => setAf({ rt: rt.id, id: x.id, from: x.date_from, to: x.date_to, rooms: String(x.rooms) })}>Edit</button>
                              <button className="bad" onClick={() => deleteAllot(x.id)}>Delete</button>
                            </div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table></div>
                  )}
                  {af && af.rt === rt.id ? (
                    <form className="panel" onSubmit={saveAllot} style={{ marginTop: 10 }}>
                      <div className="grid">
                        <div><label>From date</label><input type="date" value={af.from} onChange={e => setAf({ ...af, from: e.target.value })} required /></div>
                        <div><label>To date</label><input type="date" value={af.to} onChange={e => setAf({ ...af, to: e.target.value })} required /></div>
                        <div><label>Rooms (max {rt.total_rooms})</label><input type="number" min="0" max={rt.total_rooms} value={af.rooms} onChange={e => setAf({ ...af, rooms: e.target.value })} required /></div>
                      </div>
                      <div className="actions" style={{ marginTop: 10 }}>
                        <button disabled={busy}>{busy ? 'Saving...' : 'Save rooms'}</button>
                        <button type="button" className="ghost" onClick={() => setAf(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ marginTop: 10 }}><button className="ghost" onClick={() => setAf({ rt: rt.id, id: null, from: '', to: '', rooms: '' })}>+ Add rooms</button></div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </>
    ); }}</Shell>
  );
}
