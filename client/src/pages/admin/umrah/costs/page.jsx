import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { UmrahStyle } from '@/components/UmrahBits';
import { num } from '@/lib/umrah';

const ROOMS = ['sharing', 'double', 'triple', 'quad', 'quint'];
const s = v => (v == null ? '' : String(Number(v)));

// Visa prices (15 / 28 / 80 days, in SAR) and your buying costs + suppliers for visas and hotels.
// Only the main admin edits. Buying prices are visible to the main admin and to staff he ticked. Agents see neither.
export default function Costs() {
  return <Shell role="admin" title="Visa prices and costs">{p => <C owner={p?.role === 'admin'} />}</Shell>;
}

function C({ owner }) {
  const [rate, setRate] = useState(0);
  const [visa, setVisa] = useState([]);
  const [vEd, setVEd] = useState({});
  const [hotels, setHotels] = useState([]);
  const [sell, setSell] = useState({});
  const [hEd, setHEd] = useState({});
  const [can, setCan] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    const hp = await supabase.rpc('has_profit');
    const canP = !hp.error && hp.data === true;
    setCan(canP);
    const [st, vt, vc, h, hp2, hc] = await Promise.all([
      supabase.from('umrah_settings').select('riyal_rate').limit(1),
      supabase.from('umrah_visa_types').select('*').order('days'),
      supabase.from('umrah_visa_cost').select('*'),
      supabase.from('umrah_hotels').select('id,name,city').order('city').order('name'),
      supabase.from('umrah_hotel_prices').select('*'),
      supabase.from('umrah_hotel_cost').select('*'),
    ]);
    if (vt.error) { setError(vt.error.message); setLoaded(true); return; }
    setRate(Number(st.data?.[0]?.riyal_rate) || 0);
    setVisa(vt.data);
    const vcm = Object.fromEntries((vc.data || []).map(x => [x.days, x]));
    setVEd(Object.fromEntries(vt.data.map(r => [r.days, { price: s(r.price_sar), active: r.active, buy: s(vcm[r.days]?.buy_sar), supplier: vcm[r.days]?.supplier || '' }])));
    setHotels(h.data || []);
    setSell(Object.fromEntries((hp2.data || []).map(x => [x.hotel_id, x])));
    const hcm = Object.fromEntries((hc.data || []).map(x => [x.hotel_id, x]));
    setHEd(Object.fromEntries((h.data || []).map(x => [x.id, { supplier: hcm[x.id]?.supplier || '', ...Object.fromEntries(ROOMS.map(r => [r, s(hcm[x.id]?.['buy_' + r])])) }])));
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveVisa(days) {
    setError(''); setMsg(''); setBusy('v' + days);
    const e = vEd[days];
    let r = await supabase.rpc('owner_save_visa_type', { p_days: days, p_price_sar: e.price === '' ? null : Number(e.price), p_active: e.active });
    if (!r.error) r = await supabase.rpc('owner_save_visa_cost', { p_days: days, p_buy_sar: e.buy === '' ? null : Number(e.buy), p_supplier: e.supplier });
    setBusy('');
    if (r.error) setError(r.error.message); else { setMsg(`${days} day visa saved.`); load(); }
  }
  async function saveHotel(id) {
    setError(''); setMsg(''); setBusy('h' + id);
    const { error } = await supabase.rpc('owner_save_hotel_cost', { p_hotel: id, p_row: hEd[id] });
    setBusy('');
    if (error) setError(error.message); else { setMsg('Hotel cost saved.'); load(); }
  }
  const setV = (d, k, v) => setVEd({ ...vEd, [d]: { ...vEd[d], [k]: v } });
  const setH = (id, k, v) => setHEd({ ...hEd, [id]: { ...hEd[id], [k]: v } });
  const rows = (rate, p, b) => (p !== '' && b !== '' ? Math.round((Number(p) - Number(b)) * rate) : null);

  return (
    <div className="um">
      <UmrahStyle />
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      <div className="actions" style={{ marginBottom: 12 }}><Link href="/admin/umrah"><button className="ghost">← Back to Umrah</button></Link></div>
      {!loaded ? <p className="muted">Loading...</p> : (
        <>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Visa only prices <span className="muted small">in SAR · riyal rate today: {rate || 'not set'}</span></h2>
            <p className="muted small" style={{ margin: '0 0 10px' }}>The selling price is what agents pay for a visa-only order (changed to PKR with your daily riyal rate). Children and infants pay the same. Leave the price empty to hide that visa from agents.</p>
            <div className="scroll"><table>
              <thead><tr><th>Visa</th><th>Selling price (SAR)</th><th>Agent pays (PKR)</th><th>Shown</th>{can && <><th>Bought from</th><th>Buy price (SAR)</th><th>Profit per visa (PKR)</th></>}{owner && <th></th>}</tr></thead>
              <tbody>
                {visa.map(v => {
                  const e = vEd[v.days]; if (!e) return null;
                  const pr = rows(rate, e.price, e.buy);
                  return (
                    <tr key={v.days}>
                      <td><b>{v.days} days</b></td>
                      <td><input type="number" min="0" step="0.01" style={{ width: 110 }} disabled={!owner} value={e.price} onChange={ev => setV(v.days, 'price', ev.target.value)} placeholder="SAR" /></td>
                      <td>{e.price !== '' && rate ? `PKR ${num(Math.round(Number(e.price) * rate))}` : '-'}</td>
                      <td><input type="checkbox" style={{ width: 'auto' }} disabled={!owner} checked={e.active} onChange={ev => setV(v.days, 'active', ev.target.checked)} /></td>
                      {can && <>
                        <td><input style={{ minWidth: 120 }} maxLength={80} disabled={!owner} value={e.supplier} onChange={ev => setV(v.days, 'supplier', ev.target.value)} placeholder="Supplier" /></td>
                        <td><input type="number" min="0" step="0.01" style={{ width: 110 }} disabled={!owner} value={e.buy} onChange={ev => setV(v.days, 'buy', ev.target.value)} placeholder="optional" /></td>
                        <td>{pr == null ? <span className="muted small">-</span> : <b className={pr < 0 ? 'neg' : ''}>PKR {num(pr)}</b>}</td>
                      </>}
                      {owner && <td><button disabled={busy === 'v' + v.days} onClick={() => saveVisa(v.days)}>Save</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          </div>

          {can ? (
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Hotel buying prices <span className="muted small">in SAR per night · optional</span></h2>
              <p className="muted small" style={{ margin: '0 0 10px' }}>Type who you bought the rooms from and what you pay. The small grey number is your selling price, for comparison. Sharing is per person, the other types are per room.</p>
              <div className="scroll"><table>
                <thead><tr><th>Hotel</th><th>Bought from</th>{ROOMS.map(r => <th key={r}>{r[0].toUpperCase() + r.slice(1)}</th>)}{owner && <th></th>}</tr></thead>
                <tbody>
                  {hotels.map(h => {
                    const e = hEd[h.id]; if (!e) return null;
                    return (
                      <tr key={h.id}>
                        <td><b>{h.name}</b><div className="small muted">{h.city}</div></td>
                        <td><input style={{ minWidth: 120 }} maxLength={80} disabled={!owner} value={e.supplier} onChange={ev => setH(h.id, 'supplier', ev.target.value)} placeholder="Supplier" /></td>
                        {ROOMS.map(r => (
                          <td key={r}><input type="number" min="0" step="0.01" style={{ width: 86 }} disabled={!owner} value={e[r]} onChange={ev => setH(h.id, r, ev.target.value)} placeholder="-" />
                            <div className="small muted">sell {sell[h.id]?.['sar_' + r] != null ? s(sell[h.id]['sar_' + r]) : '-'}</div></td>
                        ))}
                        {owner && <td><button disabled={busy === 'h' + h.id} onClick={() => saveHotel(h.id)}>Save</button></td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          ) : (
            <div className="info">Buying prices and suppliers are hidden for your account. The main admin can tick them for you on the Sales page.</div>
          )}
        </>
      )}
    </div>
  );
}
