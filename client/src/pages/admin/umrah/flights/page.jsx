import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import AirlineLogo from '@/components/AirlineLogo';
import { LegCols } from '@/components/FlightParts';
import { legsMap } from '@/lib/legs';
import { cityName } from '@/lib/cities';
import { num } from '@/lib/umrah';
import { dShort } from '@/lib/format';

// Mark which of your existing flights are Umrah flights, and set the child / infant / extra amounts for each.
// Your ticket portal is not changed: this only adds a tag.
export default function AdminUmrahFlights() {
  const [rows, setRows] = useState([]);
  const [flights, setFlights] = useState({});
  const [legs, setLegs] = useState({});
  const [lm, setLm] = useState({});
  const [stay, setStay] = useState({});
  const [ed, setEd] = useState({});
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [u, f, l] = await Promise.all([
      supabase.from('umrah_flights').select('*').order('created_at', { ascending: false }),
      supabase.from('flights_with_seats').select('*').order('departure_at'),
      supabase.from('flight_legs').select('*').order('journey').order('seq'),
    ]);
    if (u.error) { setError(u.error.message); setLoaded(true); return; }
    setRows(u.data);
    if (!f.error) setFlights(Object.fromEntries(f.data.map(x => [x.id, x])));
    if (!l.error) { const m = {}; l.data.forEach(x => { (m[x.flight_id] = m[x.flight_id] || []).push(x); }); setLegs(m); setLm(legsMap(l.data)); }
    setEd(Object.fromEntries(u.data.map(r => [r.flight_id, {
      active: r.active, extra_pp: String(r.extra_pp), child_discount: String(r.child_discount), infant_fee: String(r.infant_fee),
      allow_agent_discount: r.allow_agent_discount, nights_override: r.nights_override ?? '',
    }])));
    const st = {};
    await Promise.all(u.data.map(async r => { const s = await supabase.rpc('umrah_stay_info', { p_flight: r.flight_id }); if (!s.error) st[r.flight_id] = s.data; }));
    setStay(st); setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const hasReturn = id => (legs[id] || []).some(x => x.journey === 1);
  const label = f => `${f.flight_no} ${f.origin}-${f.destination} ${dShort(f.departure_at)}`;
  const choices = useMemo(() => Object.values(flights).filter(f => f.active && new Date(f.departure_at) > Date.now() && !rows.some(r => r.flight_id === f.id)), [flights, rows]);

  // "ISB → JED 10 Nov" for going and for return, from the legs of the trip
  function trip(id) {
    const f = flights[id]; const L = legs[id] || [];
    const go = L.filter(x => x.journey === 0), back = L.filter(x => x.journey === 1);
    const one = (a, fb) => (a.length ? `${a[0].origin} → ${a[a.length - 1].destination} · ${dShort(a[0].departure_at)}` : fb);
    return { go: one(go, f ? `${f.origin} → ${f.destination} · ${dShort(f.departure_at)}` : '-'), back: back.length ? one(back, '') : null };
  }

  async function add() {
    if (!pick) return;
    setError(''); setMsg(''); setBusy(true);
    const { error } = await supabase.rpc('admin_save_umrah_flight', { p_flight: pick, p_row: { active: true } });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setPick(''); setMsg('Added as an Umrah flight. Set the child, infant and extra amounts below.'); load();
  }
  async function save(id) {
    setError(''); setMsg(''); setBusy(true);
    const { error } = await supabase.rpc('admin_save_umrah_flight', { p_flight: id, p_row: ed[id] });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg('Saved.'); load();
  }
  async function remove(id) {
    if (!confirm('Remove this flight from Umrah? Agents will no longer see it in the package builder.')) return;
    setError(''); setMsg('');
    const { error } = await supabase.rpc('admin_remove_umrah_flight', { p_flight: id });
    if (error) setError(error.message); else { setMsg('Removed.'); load(); }
  }
  const set = (id, k, v) => setEd({ ...ed, [id]: { ...ed[id], [k]: v } });

  return (
    <Shell role="admin" title="Umrah Flights">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}

      <div className="card">
        <label style={{ marginTop: 0 }}>Add an Umrah flight (choose from your Flights page)</label>
        <div className="actions" style={{ flexWrap: 'wrap' }}>
          <select style={{ maxWidth: 420 }} value={pick} onChange={e => setPick(e.target.value)}>
            <option value="">- choose a flight -</option>
            {choices.map(f => <option key={f.id} value={f.id}>{label(f)}{hasReturn(f.id) ? ' (return trip)' : ' (one way)'}</option>)}
          </select>
          <button disabled={!pick || busy} onClick={add}>Add as Umrah flight</button>
          <Link href="/admin/umrah"><button className="ghost">Back to Umrah</button></Link>
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>Use a <b>return trip</b>: the going and return flights are one entry, and the dates decide how long the client stays.</p>
      </div>

      {!loaded ? <p className="muted">Loading...</p> : rows.length === 0 ? (
        <div className="card"><p className="muted">No Umrah flights yet. Choose one above.</p></div>
      ) : rows.map(r => {
        const f = flights[r.flight_id]; const e = ed[r.flight_id]; const s = stay[r.flight_id]; const t = trip(r.flight_id);
        if (!f || !e) return null;
        return (
          <div className="card fz" key={r.flight_id} style={{ opacity: e.active ? 1 : 0.6 }}>
            <div className="fzhead">
              <AirlineLogo flightNo={f.flight_no} airline={f.airline} size={34} />
              <span className="fzpath">{cityName(f.origin)} – {cityName(f.destination)}{hasReturn(r.flight_id) ? ' (return trip)' : ' (one way)'}</span>
              <span className="muted small">ticket price PKR {num(f.price)} per passenger</span>
            </div>
            <div className="fzrow">
              <LegCols f={f} legs={lm[r.flight_id]} />
              <div className="fzcol fzmid">{f.meal || '-'}</div>
              <div className="fzcol fzmid">{s && s.nights != null ? <><b>{s.nights}</b> nights<div className="small muted">stay in KSA</div></> : <b className="neg small">stay not known - set the nights below</b>}</div>
              <div className="fzcol fzmid"><span className={'badge ' + (e.active ? 'approved' : 'blocked')}>{e.active ? 'Shown to agents' : 'Hidden'}</span><div style={{ marginTop: 6 }}><button className="bad" onClick={() => remove(r.flight_id)}>Remove</button></div></div>
            </div>

            <div className="grid" style={{ marginTop: 10 }}>
              <div><label>Infant ticket price (PKR)</label><input type="number" min="0" value={e.infant_fee} onChange={ev => set(r.flight_id, 'infant_fee', ev.target.value)} /><div className="muted small">Visa is added on top.</div></div>
              <div><label>Child ticket discount (PKR)</label><input type="number" min="0" value={e.child_discount} onChange={ev => set(r.flight_id, 'child_discount', ev.target.value)} /><div className="muted small">Leave 0 if the airline gives none.</div></div>
              <div><label>Optional extra per person (PKR)</label><input type="number" min="0" value={e.extra_pp} onChange={ev => set(r.flight_id, 'extra_pp', ev.target.value)} /><div className="muted small">E.g. extra transport. The agent can tick it on or off.</div></div>
              <div><label>Set nights by hand (only if wrong)</label><input type="number" min="1" value={e.nights_override} onChange={ev => set(r.flight_id, 'nights_override', ev.target.value)} placeholder="auto" /></div>
            </div>
            <div className="actions" style={{ marginTop: 10, flexWrap: 'wrap', gap: 16 }}>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={e.allow_agent_discount} onChange={ev => set(r.flight_id, 'allow_agent_discount', ev.target.checked)} /> Give the agent&apos;s normal ticket discount (turn OFF when your margin is low)</label>
              <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, margin: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={e.active} onChange={ev => set(r.flight_id, 'active', ev.target.checked)} /> Shown to agents</label>
              <button disabled={busy} onClick={() => save(r.flight_id)}>Save</button>
            </div>
          </div>
        );
      })}
    </Shell>
  );
}
