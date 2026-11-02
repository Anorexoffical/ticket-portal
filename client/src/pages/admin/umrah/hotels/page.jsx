import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { KINDS, KIND_LABEL, PERSONS, num } from '@/lib/umrah';

const EMPTY = { name: '', city: 'Makkah', distance_m: '', area: '', active: true, quick: '',
  prices: { sharing: '', double: '', triple: '', quad: '', quint: '' } };
const unit = k => (k === 'sharing' ? 'per person' : 'per room');

export default function AdminHotels() {
  const [hotels, setHotels] = useState([]);
  const [prices, setPrices] = useState({});      // hotel id -> { sharing, double, ... } in SAR
  const [st, setSt] = useState({ rate: '', visa: '', updated: null });
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [h, p, s] = await Promise.all([
      supabase.from('umrah_hotels').select('*').order('city').order('name'),
      supabase.from('umrah_hotel_prices').select('*'),
      supabase.from('umrah_settings').select('*').eq('id', 1).single(),
    ]);
    if (h.error) setError(h.error.message); else setHotels(h.data);
    if (!p.error) setPrices(Object.fromEntries(p.data.map(x => [x.hotel_id, {
      sharing: x.sar_sharing, double: x.sar_double, triple: x.sar_triple, quad: x.sar_quad, quint: x.sar_quint }])));
    if (!s.error && s.data) setSt({ rate: String(Number(s.data.riyal_rate) || ''), visa: String(Number(s.data.visa_price_sar) || ''), updated: s.data.updated_at });
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const rate = Number(st.rate) || 0;
  const pkr = sar => Math.round(Number(sar) * rate);
  const set = k => e => setForm({ ...form, [k]: e.target.value });
  const setPrice = k => e => setForm({ ...form, prices: { ...form.prices, [k]: e.target.value } });

  async function saveSettings(e) {
    e.preventDefault(); setError(''); setMsg('');
    if (!(Number(st.rate) > 0)) { setError('Enter the riyal rate (PKR for 1 SAR).'); return; }
    setBusy(true);
    const { error } = await supabase.rpc('admin_set_umrah_settings', { p_rate: Number(st.rate), p_visa: Number(st.visa) || 0 });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg('Settings saved.'); load();
  }

  function openNew() { setEditId(null); setForm({ ...EMPTY, prices: { ...EMPTY.prices } }); setError(''); setMsg(''); window.scrollTo(0, 0); }
  function openEdit(h) {
    const p = prices[h.id] || {};
    const pr = {};
    KINDS.forEach(k => { pr[k] = p[k] != null ? String(Number(p[k])) : ''; });
    setEditId(h.id); setError(''); setMsg('');
    setForm({ name: h.name, city: h.city, distance_m: h.distance_m ?? '', area: h.area || '', active: h.active, quick: '', prices: pr });
    window.scrollTo(0, 0);
  }

  // one per-person rate -> fills every room price (you can still change each one by hand)
  function fillQuick() {
    const r = Number(form.quick);
    if (form.quick === '' || !(r >= 0)) { setError('Type the per-person rate first.'); return; }
    setError('');
    const pr = {};
    KINDS.forEach(k => { pr[k] = String(Math.round(r * PERSONS[k] * 100) / 100); });
    setForm({ ...form, prices: pr });
  }

  async function save(e) {
    e.preventDefault(); setError(''); setMsg('');
    const row = { name: form.name, city: form.city, distance_m: form.distance_m, area: form.area, active: form.active, prices: form.prices };
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_umrah_hotel_v2', { p_id: editId, p_row: row });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg(editId ? 'Hotel updated.' : 'Hotel added.'); setForm(null); setEditId(null); load();
  }

  async function toggle(h) {
    setError(''); setMsg('');
    const row = { name: h.name, city: h.city, distance_m: h.distance_m ?? '', area: h.area || '', active: !h.active };   // no prices key = prices stay
    const { error } = await supabase.rpc('admin_save_umrah_hotel_v2', { p_id: h.id, p_row: row });
    if (error) setError(error.message); else load();
  }

  return (
    <Shell role="admin" title="Umrah Hotels">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}

      <form className="card" onSubmit={saveSettings}>
        <h2>Umrah settings</h2>
        <div className="grid">
          <div><label>Riyal rate (PKR for 1 SAR) - change it daily</label><input type="number" min="0" step="0.01" value={st.rate} onChange={e => setSt({ ...st, rate: e.target.value })} placeholder="e.g. 75" /></div>
          <div><label>MOFA / Visa price (SAR per person)</label><input type="number" min="0" step="0.01" value={st.visa} onChange={e => setSt({ ...st, visa: e.target.value })} placeholder="e.g. 300" /></div>
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <button disabled={busy}>Save settings</button>
          {st.updated && <span className="muted small">Last updated: {new Date(st.updated).toLocaleString('en-GB')}</span>}
        </div>
      </form>

      {form && (
        <form className="card" onSubmit={save}>
          <h2>{editId ? 'Edit hotel' : 'Add hotel'}</h2>
          <div className="grid">
            <div><label>Hotel name</label><input value={form.name} onChange={set('name')} required placeholder="e.g. Hilton Makkah" /></div>
            <div><label>City</label><select value={form.city} onChange={set('city')}><option>Makkah</option><option>Madinah</option></select></div>
            <div><label>Distance from Haram (metres)</label><input type="number" min="0" value={form.distance_m} onChange={set('distance_m')} placeholder="e.g. 300" /></div>
            <div><label>Location / side</label><input value={form.area} onChange={set('area')} maxLength={80} placeholder="e.g. Ajyad, Aziziyah" /></div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <label style={{ marginTop: 0 }}>Rates in Saudi Riyal (SAR) per night</label>
            <div className="actions" style={{ marginBottom: 8 }}>
              <input type="number" min="0" step="0.01" style={{ width: 160 }} value={form.quick} onChange={set('quick')} placeholder="Per-person rate" />
              <button type="button" className="ghost" onClick={fillQuick}>Fill room prices from this</button>
              <span className="muted small">Optional shortcut: one per-person rate fills every room. You can still change each price below.</span>
            </div>
            <div className="grid">
              {KINDS.map(k => (
                <div key={k}>
                  <label>{KIND_LABEL[k]} ({unit(k)})</label>
                  <input type="number" min="0" step="0.01" value={form.prices[k]} onChange={setPrice(k)} />
                  {form.prices[k] !== '' && (
                    <div className="muted small">
                      {k !== 'sharing' && `${num(Number(form.prices[k]) / PERSONS[k])} SAR per person`}
                      {rate > 0 ? `${k !== 'sharing' ? ' · ' : ''}PKR ${num(pkr(form.prices[k]))} ${unit(k)}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {rate <= 0 && <p className="muted small" style={{ margin: '6px 0 0' }}>Enter the riyal rate above to see PKR amounts.</p>}
          </div>

          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Available (agents can use this hotel)
          </label>
          <div className="actions" style={{ marginTop: 16 }}>
            <button disabled={busy}>{busy ? 'Saving...' : 'Save hotel'}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {!form && (
        <div className="actions" style={{ marginBottom: 16 }}>
          <button onClick={openNew}>+ Add hotel</button>
          <Link href="/admin/umrah"><button className="ghost">Back to Umrah</button></Link>
        </div>
      )}

      {!loaded ? <p className="muted">Loading...</p> : hotels.length === 0 ? (
        <div className="card"><p className="muted">No hotels yet. Click “Add hotel”.</p></div>
      ) : hotels.map(h => {
        const p = prices[h.id] || {};
        const has = KINDS.filter(k => p[k] != null);
        return (
          <div className="card" key={h.id} style={{ opacity: h.active ? 1 : 0.55 }}>
            <div className="actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>{h.name}</h2>
                <div className="muted small">
                  {h.city}{h.distance_m != null ? ` · ${h.distance_m} m from Haram` : ''}{h.area ? ` · ${h.area}` : ''}
                </div>
                <div className="small" style={{ marginTop: 6 }}>
                  {has.length === 0 ? <span className="neg">No rates yet - press Edit to add</span> : has.map(k => (
                    <span key={k} style={{ marginRight: 14, display: 'inline-block' }}>
                      {KIND_LABEL[k]}: <b>{num(p[k])} SAR</b> {unit(k)}{rate > 0 ? ` = PKR ${num(pkr(p[k]))}` : ''}
                    </span>
                  ))}
                </div>
              </div>
              <div className="actions" style={{ flexWrap: 'wrap' }}>
                <span className={'badge ' + (h.active ? 'approved' : 'blocked')}>{h.active ? 'Available' : 'Hidden'}</span>
                <button className="ghost" onClick={() => openEdit(h)}>Edit</button>
                <button className={h.active ? 'warn' : 'ok'} onClick={() => toggle(h)}>{h.active ? 'Hide' : 'Show'}</button>
              </div>
            </div>
          </div>
        );
      })}
    </Shell>
  );
}
