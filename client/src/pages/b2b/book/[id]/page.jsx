import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import CountrySelect from '@/components/CountrySelect';
import AirlineLogo from '@/components/AirlineLogo';
import { dt, money, holdText } from '@/lib/format';
import { TITLES, TYPES, blankPassenger, passportShort, toISODate, typeProblem } from '@/lib/passenger';
import { matchCountry } from '@/lib/countries';
import { legsMap, sectorText } from '@/lib/legs';
import useDiscount, { priceFor } from '@/lib/useDiscount';

const REQUIRED = ['title', 'first_name', 'last_name', 'dob', 'passport_number', 'passport_expiry', 'nationality'];

export default function Book() {
  const { id } = useParams();
  const router = useRouter();
  const [flight, setFlight] = useState(null);
  const [legs, setLegs] = useState([]);
  const [pax, setPax] = useState([blankPassenger()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const disc = useDiscount();

  useEffect(() => {
    supabase.from('flights_with_seats').select('*').eq('id', id).single()
      .then(({ data, error }) => { if (error) setError('Flight not found.'); else setFlight(data); });
    supabase.from('flight_legs').select('*').eq('flight_id', id).then(({ data }) => { if (data) setLegs(legsMap(data)[id] || []); });
    try {
      // pax_selection: set by the BookModal on the flights page
      const sel = JSON.parse(sessionStorage.getItem('pax_selection') || 'null');
      if (sel && sel.flight_id === id && Array.isArray(sel.pax) && sel.pax.length && sel.expires > Date.now()) {
        setPax(sel.pax.map(p => ({ ...blankPassenger(), ...p })));
        sessionStorage.removeItem('pax_selection');
        return;
      }
      sessionStorage.removeItem('pax_selection');
      // legacy rebook
      const r = JSON.parse(sessionStorage.getItem('rebook') || 'null');
      if (r && r.flight_id === id && Array.isArray(r.passengers) && r.passengers.length) {
        setPax(r.passengers.map(p => ({ ...blankPassenger(), ...p })));
      }
      sessionStorage.removeItem('rebook');
    } catch { /* ignore */ }
  }, [id]);

  const upd = (i, k, v) => setPax(pax.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  // Paste from Excel. Columns: Title, First name, Last name, Type, DOB, Passport no, Passport expiry, Nationality
  // (the old 6-column order without Title and Type also works)
  function importPaste() {
    const out = paste.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const c = l.split(/\t|,/).map(x => x.trim());
      const t = (c[0] || '').toUpperCase().replace('.', '');
      const hasTitle = TITLES.some(([v]) => v === t);
      const [title, first, last, type, dob, pp, exp, nat] = hasTitle ? [t, c[1], c[2], c[3], c[4], c[5], c[6], c[7]] : ['', c[0], c[1], 'adult', c[2], c[3], c[4], c[5]];
      const ty = (type || 'adult').toLowerCase();
      return {
        title, first_name: first || '', last_name: last || '',
        pax_type: ty.startsWith('c') ? 'child' : ty.startsWith('i') ? 'infant' : 'adult',
        dob: toISODate(dob), passport_number: pp || '', passport_expiry: toISODate(exp), nationality: matchCountry(nat),
      };
    });
    if (out.length === 0) return;
    setPax(out); setShowPaste(false); setPaste('');
  }

  // returns { hard: 'error text' or '', soft: [warnings] }
  function check() {
    if (!flight) return { hard: 'Flight not loaded.', soft: [] };
    if (pax.length > flight.seats_left) return { hard: `Only ${flight.seats_left} seats left.`, soft: [] };
    const dep = new Date(flight.departure_at);
    const soft = [];
    for (let i = 0; i < pax.length; i++) {
      const p = pax[i], who = `Passenger ${i + 1}`;
      if (!p.title) return { hard: `${who}: choose a title (Mr, Mrs, ...).`, soft };
      if (REQUIRED.some(k => !String(p[k]).trim())) return { hard: `${who}: fill all fields.`, soft };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dob) || isNaN(new Date(p.dob))) return { hard: `${who}: date of birth is not valid.`, soft };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.passport_expiry) || isNaN(new Date(p.passport_expiry))) return { hard: `${who}: passport expiry is not valid.`, soft };
      if (new Date(p.dob) >= new Date()) return { hard: `${who}: date of birth must be in the past.`, soft };
      if (new Date(p.passport_expiry) <= dep) return { hard: `${who} (${p.first_name} ${p.last_name}): passport expires before the flight.`, soft };
      if (passportShort(p.passport_expiry, dep)) soft.push(`${p.first_name} ${p.last_name}: passport is valid for less than 6 months after the flight date`);
      const tp = typeProblem(p.pax_type, p.dob, dep);
      if (tp) soft.push(`${p.first_name} ${p.last_name} ${tp}`);
    }
    return { hard: '', soft };
  }

  async function submit() {
    const { hard, soft } = check();
    if (hard) { setError(hard); window.scrollTo(0, 0); return; }
    if (soft.length && !confirm(`Please check before booking:\n\n• ${soft.join('\n• ')}\n\nA passport must normally be valid for at least 6 months after travel, or the passenger may be refused boarding.\n\nBook anyway?`)) return;
    setBusy(true); setError('');
    const { error } = await supabase.rpc('create_booking', { p_flight_id: id, p_passengers: pax });
    setBusy(false);
    if (error) { setError(error.message); window.scrollTo(0, 0); return; }
    router.push('/agent/bookings?new=1');
  }

  return (
    <Shell role="agent" title="Book flight">
      {error && <div className="error">{error}</div>}
      {flight && (
        <>
          <div className="card flight">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <AirlineLogo flightNo={flight.flight_no} airline={flight.airline} size={44} />
              <div>
                <div className="route">{legs.length ? sectorText(flight, legs) : `${flight.origin} → ${flight.destination}`}</div>
                <div><b>{flight.airline}</b> · {flight.flight_no}</div>
                {legs.length > 1 && <div className="small">{legs.map((l, i) => <div key={i}>{l.journey === 1 && (i === 0 || legs[i - 1].journey === 0) ? 'Return: ' : ''}{l.flight_no} {l.origin}→{l.destination} · {dt(l.departure_at)}</div>)}</div>}
                <div className="muted small">Departs {dt(flight.departure_at)} · {flight.seats_left} seats left</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="price">{money(priceFor(flight.price, disc))}</div><div className="muted small">per passenger</div>
            </div>
          </div>

          <div className="info">Your booking will be placed <b>ON HOLD for {holdText(flight.hold_minutes || flight.hold_hours * 60)}</b>. Pay within this time to confirm it (if the flight is close, or it is after office hours, the hold time may be shorter or start later - your exact end time shows in My Bookings), or it will be cancelled automatically. Enter names exactly as in the passport. <b>The passport must be valid for at least 6 months after the flight date.</b></div>

          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="ghost" onClick={() => setShowPaste(!showPaste)}>{showPaste ? 'Close paste box' : 'Paste many passengers (from Excel)'}</button>
          </div>
          {showPaste && (
            <div className="card">
              <p className="small muted">One passenger per line, separated by TAB (copy from Excel) or comma, in this order:<br /><b>Title, First name, Last name, Type (adult/child/infant), DOB, Passport no, Passport expiry, Nationality</b><br />Dates can be 1990-05-21, 21/05/1990 or 21MAY1990.</p>
              <textarea rows="6" value={paste} onChange={e => setPaste(e.target.value)} placeholder="Mr, Ali, Khan, adult, 21/05/1990, AB1234567, 21/05/2032, Pakistan" />
              <button style={{ marginTop: 8 }} onClick={importPaste}>Use this list (replaces current passengers)</button>
            </div>
          )}

          {pax.map((p, i) => {
            const dep = flight.departure_at;
            const short = passportShort(p.passport_expiry, dep);
            const tp = typeProblem(p.pax_type, p.dob, dep);
            return (
              <div className="card" key={i}>
                <div className="top" style={{ marginBottom: 0 }}>
                  <h2 style={{ margin: 0 }}>Passenger {i + 1}</h2>
                  {pax.length > 1 && <button className="ghost" onClick={() => setPax(pax.filter((_, j) => j !== i))}>Remove</button>}
                </div>
                <div className="grid">
                  <div><label>Title</label>
                    <select value={p.title} onChange={e => upd(i, 'title', e.target.value)}>
                      <option value="">Select</option>{TITLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
                  <div><label>First name</label><input value={p.first_name} onChange={e => upd(i, 'first_name', e.target.value)} /></div>
                  <div><label>Last name</label><input value={p.last_name} onChange={e => upd(i, 'last_name', e.target.value)} /></div>
                  <div><label>Passenger type</label>
                    <select value={p.pax_type} onChange={e => upd(i, 'pax_type', e.target.value)}>
                      {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select></div>
                  <div><label>Date of birth</label><input type="date" value={p.dob} onChange={e => upd(i, 'dob', e.target.value)} /></div>
                  <div><label>Passport number</label><input value={p.passport_number} onChange={e => upd(i, 'passport_number', e.target.value)} /></div>
                  <div><label>Passport expiry</label><input type="date" value={p.passport_expiry} onChange={e => upd(i, 'passport_expiry', e.target.value)} /></div>
                  <div><label>Nationality</label><CountrySelect value={p.nationality} onChange={v => upd(i, 'nationality', v)} /></div>
                </div>
                {short && <div className="error">Passport is valid for less than 6 months after the flight date. 6 months validity is required for travel, and the passenger may be refused boarding.</div>}
                {tp && <div className="info" style={{ background: '#fff3d6', color: '#8a5a00' }}>Check type: passenger {tp}.</div>}
              </div>
            );
          })}

          <div className="actions" style={{ marginBottom: 16 }}>
            <button className="ghost" disabled={pax.length >= Math.min(50, flight.seats_left)} onClick={() => setPax([...pax, blankPassenger()])}>+ Add passenger</button>
          </div>

          <div className="card flight">
            <div><div className="muted small">{pax.length} passenger(s) × {money(flight.price)}</div><div className="price">Total {money(priceFor(flight.price, disc) * pax.length)}</div></div>
            <button disabled={busy} onClick={submit}>{busy ? 'Booking...' : 'Place booking on hold'}</button>
          </div>
        </>
      )}
    </Shell>
  );
}
