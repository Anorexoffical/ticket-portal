import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { num } from '@/lib/umrah';
import { TYPES, TYPE_LABEL, PERSONS } from '@/lib/umrahPackages';
import { dShort } from '@/lib/format';

const PKEYS = [...TYPES, 'child_bed', 'child_nobed', 'infant'];
const PLABEL = { ...TYPE_LABEL, child_bed: 'Child with bed', child_nobed: 'Child without bed', infant: 'Infant' };
const EMPTY = {
  name: '', days: '', mk_hotel: '', mk_nights: '', md_hotel: '', md_nights: '', flight_out: '', flight_in: '',
  inc_visa: true, inc_transport: true, inc_ziyarat: false, note: '', old_extra: '', allow_agent_discount: true, active: true,
  p: Object.fromEntries(PKEYS.map(k => [k, ''])),
};

export default function AdminPackages() {
  const [pkgs, setPkgs] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [flights, setFlights] = useState([]);
  const [hp, setHp] = useState({});       // hotel id -> SAR prices (owner / staff only)
  const [st, setSt] = useState({ rate: 0, visa: 0 });
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, h, f, pr, s] = await Promise.all([
      supabase.from('umrah_packages').select('*').order('created_at', { ascending: false }),
      supabase.from('umrah_hotels').select('id,name,city').order('name'),
      supabase.from('flights_with_seats').select('id,flight_no,origin,destination,departure_at,active').order('departure_at'),
      supabase.from('umrah_hotel_prices').select('*'),
      supabase.from('umrah_settings').select('*').maybeSingle(),
    ]);
    if (p.error) setError(p.error.message); else setPkgs(p.data);
    if (!h.error) setHotels(h.data);
    if (!f.error) setFlights(f.data);
    if (!pr.error) setHp(Object.fromEntries(pr.data.map(x => [x.hotel_id, x])));
    if (s.data) setSt({ rate: Number(s.data.riyal_rate) || 0, visa: Number(s.data.visa_price_sar) || 0 });
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const hname = id => hotels.find(h => h.id === id)?.name || '-';
  const fl = id => flights.find(f => f.id === id);
  const flText = f => (f ? `${f.flight_no} ${f.origin}-${f.destination} ${dShort(f.departure_at)}` : '-');
  const set = k => e => setForm({ ...form, [k]: e.target.value });
  const tick = k => e => setForm({ ...form, [k]: e.target.checked });
  const setP = k => e => setForm({ ...form, p: { ...form.p, [k]: e.target.value } });

  // rough cost of hotels + visa per person (no flight), so you can set the selling price
  function costHint(f, t) {
    const one = (hid, nights) => {
      const r = hp[hid] && hp[hid]['sar_' + t];
      if (!hid || r == null || !(Number(nights) >= 0)) return null;
      return Number(nights || 0) * (Number(r) / PERSONS[t]);
    };
    const a = one(f.mk_hotel, f.mk_nights), b = one(f.md_hotel, f.md_nights);
    if (a == null && b == null) return null;
    const sar = (a || 0) + (b || 0) + (f.inc_visa ? st.visa : 0);
    return st.rate > 0 ? Math.round(sar * st.rate) : null;
  }

  function openNew() { setEditId(null); setForm({ ...EMPTY, p: { ...EMPTY.p } }); setError(''); setMsg(''); window.scrollTo(0, 0); }
  function openEdit(k, copy) {
    setEditId(copy ? null : k.id); setError(''); setMsg('');
    setForm({
      name: copy ? k.name + ' (copy)' : k.name, days: k.days ?? '', mk_hotel: k.makkah_hotel || '', mk_nights: k.makkah_nights ?? '',
      md_hotel: k.madinah_hotel || '', md_nights: k.madinah_nights ?? '', flight_out: k.flight_out || '', flight_in: k.flight_in || '',
      inc_visa: k.inc_visa, inc_transport: k.inc_transport, inc_ziyarat: k.inc_ziyarat, note: k.note || '',
      old_extra: Number(k.old_extra) > 0 ? String(k.old_extra) : '', allow_agent_discount: k.allow_agent_discount, active: copy ? true : k.active,
      p: Object.fromEntries(PKEYS.map(x => [x, k['p_' + x] != null ? String(k['p_' + x]) : ''])),
    });
    window.scrollTo(0, 0);
  }

  async function save(e) {
    e.preventDefault(); setError(''); setMsg('');
    if (TYPES.every(t => form.p[t] === '')) { setError('Enter at least one adult price.'); return; }
    if (PKEYS.some(k => form.p[k] !== '' && !(Number(form.p[k]) >= 0))) { setError('Prices must be 0 or more.'); return; }
    const row = {
      name: form.name, days: form.days, makkah_hotel: form.mk_hotel, makkah_nights: form.mk_nights, madinah_hotel: form.md_hotel, madinah_nights: form.md_nights,
      flight_out: form.flight_out, flight_in: form.flight_in, inc_visa: form.inc_visa, inc_transport: form.inc_transport, inc_ziyarat: form.inc_ziyarat,
      note: form.note, old_extra: form.old_extra, allow_agent_discount: form.allow_agent_discount, active: form.active, prices: form.p,
    };
    setBusy(true);
    const { error } = await supabase.rpc('admin_save_umrah_package', { p_id: editId, p_row: row });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg(editId ? 'Package updated.' : 'Package added.'); setForm(null); setEditId(null); load();
  }

  async function toggle(k) {
    setError(''); setMsg('');
    const { error } = await supabase.rpc('admin_set_umrah_package_active', { p_id: k.id, p_on: !k.active });
    if (error) setError(error.message); else load();
  }

  const sale = form && Number(form.old_extra) > 0;

  return (
    <Shell role="admin" title="Umrah Packages">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}

      {form && (
        <form className="card" onSubmit={save}>
          <h2>{editId ? 'Edit package' : 'Add package'}</h2>
          <div className="grid">
            <div><label>Package name</label><input value={form.name} onChange={set('name')} required placeholder="e.g. 15 Days Economy Umrah" /></div>
            <div><label>Total days</label><input type="number" min="1" value={form.days} onChange={set('days')} /></div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <label style={{ marginTop: 0 }}>Stay</label>
            <div className="grid">
              <div><label>Makkah hotel</label><select value={form.mk_hotel} onChange={set('mk_hotel')}><option value="">-</option>{hotels.filter(h => h.city === 'Makkah').map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
              <div><label>Makkah nights</label><input type="number" min="0" value={form.mk_nights} onChange={set('mk_nights')} /></div>
              <div><label>Madinah hotel</label><select value={form.md_hotel} onChange={set('md_hotel')}><option value="">-</option>{hotels.filter(h => h.city === 'Madinah').map(h => <option key={h.id} value={h.id}>{h.name}</option>)}</select></div>
              <div><label>Madinah nights</label><input type="number" min="0" value={form.md_nights} onChange={set('md_nights')} /></div>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <label style={{ marginTop: 0 }}>Flights (from your Flights page, optional)</label>
            <div className="grid">
              <div><label>Outbound</label><select value={form.flight_out} onChange={set('flight_out')}><option value="">-</option>{flights.map(f => <option key={f.id} value={f.id}>{flText(f)}{f.active ? '' : ' (hidden)'}</option>)}</select></div>
              <div><label>Inbound (return)</label><select value={form.flight_in} onChange={set('flight_in')}><option value="">-</option>{flights.map(f => <option key={f.id} value={f.id}>{flText(f)}{f.active ? '' : ' (hidden)'}</option>)}</select></div>
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>The flight price is inside the package price below. For another date, use “Copy” on the package and pick the other flights.</p>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <label style={{ marginTop: 0 }}>Package price per person (PKR)</label>
            <div className="grid">
              {PKEYS.map(k => {
                const hint = TYPES.includes(k) ? costHint(form, k) : null;
                return (
                  <div key={k}>
                    <label>{PLABEL[k]}{TYPES.includes(k) ? ' (adult)' : ''}</label>
                    <input type="number" min="0" value={form.p[k]} onChange={setP(k)} />
                    {hint != null && <div className="muted small">Hotels + visa cost ≈ {num(hint)}</div>}
                  </div>
                );
              })}
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>Leave a room type empty if you do not sell it. The cost hint covers hotels and visa only (not the flight) and is shown to you only.</p>
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <label style={{ marginTop: 0 }}>Discount</label>
            <div className="grid">
              <div><label>Old price is higher by (PKR, optional)</label><input type="number" min="0" value={form.old_extra} onChange={set('old_extra')} placeholder="e.g. 10000" /></div>
            </div>
            {sale
              ? <p className="small" style={{ margin: '6px 0 0' }}><b>Sale package:</b> clients see the old price crossed out. Only the sale price applies, so the agent discount is NOT given.</p>
              : <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}><input type="checkbox" style={{ width: 'auto' }} checked={form.allow_agent_discount} onChange={tick('allow_agent_discount')} /> Give the agent&apos;s normal discount on this package (turn OFF when your margin is already low)</label>}
          </div>

          <div className="panel" style={{ marginTop: 12 }}>
            <label style={{ marginTop: 0 }}>Included</label>
            <div className="actions" style={{ flexWrap: 'wrap', gap: 16 }}>
              {[['inc_visa', 'Visa'], ['inc_transport', 'Transport'], ['inc_ziyarat', 'Ziyarat']].map(([k, t]) => (
                <label key={k} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={form[k]} onChange={tick(k)} /> {t}</label>
              ))}
            </div>
            <label>Note for clients (optional)</label>
            <input value={form.note} onChange={set('note')} maxLength={400} placeholder="e.g. Breakfast included, Ajyad side" />
          </div>

          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.active} onChange={tick('active')} /> Active (visible to agents)
          </label>
          <div className="actions" style={{ marginTop: 16 }}>
            <button disabled={busy}>{busy ? 'Saving...' : 'Save package'}</button>
            <button type="button" className="ghost" onClick={() => { setForm(null); setEditId(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {!form && (
        <div className="actions" style={{ marginBottom: 16 }}>
          <button onClick={openNew}>+ Add package</button>
          <Link href="/admin/umrah"><button className="ghost">Back to Umrah</button></Link>
        </div>
      )}

      {!loaded ? <p className="muted">Loading...</p> : pkgs.length === 0 ? (
        <div className="card"><p className="muted">No packages yet. Click “Add package”.</p></div>
      ) : pkgs.map(k => (
        <div className="card" key={k.id} style={{ opacity: k.active ? 1 : 0.55 }}>
          <div className="actions" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0 }}>{k.name} <span className="muted small">{k.days ? `${k.days} days` : ''}</span> {Number(k.old_extra) > 0 && <span className="badge approved">SALE</span>}</h2>
              <div className="small" style={{ marginTop: 4 }}>
                Makkah: <b>{hname(k.makkah_hotel)}</b> {k.makkah_nights != null ? `· ${k.makkah_nights} nights` : ''}<br />
                Madinah: <b>{hname(k.madinah_hotel)}</b> {k.madinah_nights != null ? `· ${k.madinah_nights} nights` : ''}<br />
                Flights: {k.flight_out ? flText(fl(k.flight_out)) : '-'} / {k.flight_in ? flText(fl(k.flight_in)) : '-'}
              </div>
              <div className="small" style={{ marginTop: 6 }}>
                {PKEYS.filter(x => k['p_' + x] != null).map(x => <span key={x} style={{ marginRight: 14, display: 'inline-block' }}>{PLABEL[x]}: <b>{num(k['p_' + x])}</b></span>)}
              </div>
              {!(Number(k.old_extra) > 0) && !k.allow_agent_discount && <div className="muted small">Agent discount is OFF for this package.</div>}
            </div>
            <div className="actions" style={{ flexWrap: 'wrap' }}>
              <span className={'badge ' + (k.active ? 'approved' : 'blocked')}>{k.active ? 'Active' : 'Hidden'}</span>
              <button className="ghost" onClick={() => openEdit(k, false)}>Edit</button>
              <button className="ghost" onClick={() => openEdit(k, true)}>Copy</button>
              <button className={k.active ? 'warn' : 'ok'} onClick={() => toggle(k)}>{k.active ? 'Hide' : 'Show'}</button>
            </div>
          </div>
        </div>
      ))}
    </Shell>
  );
}
