import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import AirlineLogo from '@/components/AirlineLogo';
import { LegCols } from '@/components/FlightParts';
import { UmrahStyle, Stepper, StayBar } from '@/components/UmrahBits';
import { legsMap } from '@/lib/legs';
import { cityName } from '@/lib/cities';
import { num } from '@/lib/umrah';
import { TYPE_LABEL } from '@/lib/umrahPackages';
import { dShort } from '@/lib/format';

const ROOMS = ['sharing', 'double', 'triple', 'quad', 'quint'];
const ROOM_SHORT = { sharing: 'Sharing', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
const ROOM_SUB = { sharing: 'per person, mixed', double: '2 people', triple: '3 people', quad: '4 people', quint: '5 people' };
const PART_CITY = ['Makkah', 'Madinah', 'Makkah'];   // the usual Umrah order: Makkah, then Madinah, then Makkah again
const MEM = 'umrah_build_v1';

// the room that fits the group (adults + children with a bed): one group fills one room
function suggestRoom(n) {
  if (n <= 1) return 'sharing';
  if (n <= 5) return ['', '', 'double', 'triple', 'quad', 'quint'][n];
  for (const [r, c] of [['quint', 5], ['quad', 4], ['triple', 3], ['double', 2]]) if (n % c === 0) return r;
  return 'sharing';
}

// ---- dividing the nights between the hotel parts ----
// Divide evenly. When it does not divide exactly, the Makkah parts get the extra night first.
const EXTRA_FIRST = [0, 2, 1];
function even(total, idxs) {
  const k = idxs.length, base = Math.floor(total / k);
  let rem = total - base * k;
  const out = {};
  idxs.forEach(i => { out[i] = base; });
  EXTRA_FIRST.filter(i => idxs.includes(i)).forEach(i => { if (rem > 0) { out[i] += 1; rem -= 1; } });
  return out;
}
// edits = the parts the agent changed by hand ([part, nights]), oldest first. The other parts always fill what is left.
function allocate(total, active, edits) {
  if (!total || active.length === 0) return {};
  if (active.length === 1) return { [active[0]]: total };
  const ed = edits.filter(e => active.includes(e[0])).slice(-(active.length - 1));
  const locked = Object.fromEntries(ed.map(e => [e[0], e[1]]));
  const free = active.filter(i => !(i in locked));
  const rest = total - ed.reduce((s, e) => s + e[1], 0);
  if (rest < free.length) return even(total, active);   // the hand edits no longer fit: back to automatic
  return { ...locked, ...even(rest, free) };
}

// The agent builds a package: people, Umrah flight (fixes the stay), hotels in up to 3 parts, room. The price shows by itself (PKR only, from the database).
export default function Build() {
  return <Shell role="agent" title="Build a package">{p => <Builder agency={p?.agency_name || ''} />}</Shell>;
}

function Builder({ agency }) {
  const [flights, setFlights] = useState([]);
  const [legRows, setLegRows] = useState({});
  const [lm, setLm] = useState({});
  const [stays, setStays] = useState({});
  const [extras, setExtras] = useState({});
  const [hotels, setHotels] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pax, setPax] = useState({ a: 2, cb: 0, cn: 0, i: 0 });
  const [fid, setFid] = useState('');
  const [h1, setH1] = useState('');
  const [h2, setH2] = useState('');
  const [h3, setH3] = useState('same');          // 'same' = the same hotel as part 1
  const [edits, setEdits] = useState([]);
  const [roomPick, setRoomPick] = useState('');   // '' = automatic (suggested from the group size)
  const [extra, setExtra] = useState(false);
  const [visa, setVisa] = useState(true);      // visa included in the price
  const [markup, setMarkup] = useState('');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showFl, setShowFl] = useState(false);
  const [ready, setReady] = useState(false);      // saved choices have been read
  const seq = useRef(0);
  const saved = useRef({});

  // ---- load data + remember last choices ----
  useEffect(() => {
    (async () => {
      try {
        setMarkup(localStorage.getItem('umrah_markup') || '');
        const s = JSON.parse(localStorage.getItem(MEM) || '{}');
        saved.current = s || {};
        if (s.pax && ['a', 'cb', 'cn', 'i'].every(k => Number.isInteger(s.pax[k]) && s.pax[k] >= 0 && s.pax[k] <= 60)) setPax(s.pax);
        if (ROOMS.includes(s.roomPick)) setRoomPick(s.roomPick);
      } catch (e) { /* storage blocked: fine */ }
      setReady(true);
      const u = await supabase.from('umrah_flights').select('flight_id,extra_pp').eq('active', true);
      if (u.error) { setError(u.error.message); setLoaded(true); return; }
      const ids = u.data.map(x => x.flight_id);
      setExtras(Object.fromEntries(u.data.map(x => [x.flight_id, Number(x.extra_pp) || 0])));
      const none = { data: [] };
      const [f, l, h] = await Promise.all([
        ids.length ? supabase.from('flights_with_seats').select('*').in('id', ids).eq('active', true).gt('departure_at', new Date().toISOString()).order('departure_at') : none,
        ids.length ? supabase.from('flight_legs').select('*').in('flight_id', ids).order('journey').order('seq') : none,
        supabase.from('umrah_hotels').select('id,name,city,distance_m,area').eq('active', true).order('name'),
      ]);
      if (f.error) setError(f.error.message); else setFlights(f.data);
      if (l.data) {
        const m = {}; l.data.forEach(x => { (m[x.flight_id] = m[x.flight_id] || []).push(x); });
        setLegRows(m); setLm(legsMap(l.data));
      }
      if (h.data) {
        setHotels(h.data);
        const s = saved.current;   // the hotels used last time, if they still exist
        if (s.h1 && h.data.some(x => x.id === s.h1 && x.city === 'Makkah')) setH1(s.h1);
        if (s.h2 && h.data.some(x => x.id === s.h2 && x.city === 'Madinah')) setH2(s.h2);
      }
      if (f.data) {
        const st = {};
        await Promise.all(f.data.map(async x => { const s = await supabase.rpc('umrah_stay_info', { p_flight: x.id }); if (!s.error) st[x.id] = s.data; }));
        setStays(st);
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(MEM, JSON.stringify({ pax, roomPick, h1, h2 })); } catch (e) { /* ignore */ }
  }, [ready, pax, roomPick, h1, h2]);

  const hotelOf = id => hotels.find(h => h.id === id);
  const flightOf = id => flights.find(f => f.id === id);
  function trip(f) {
    const L = legRows[f.id] || [];
    const go = L.filter(x => x.journey === 0), back = L.filter(x => x.journey === 1);
    const one = (a, fb) => (a.length ? `${a[0].origin} → ${a[a.length - 1].destination} · ${dShort(a[0].departure_at)}` : fb);
    return { go: one(go, `${f.origin} → ${f.destination} · ${dShort(f.departure_at)}`), back: back.length ? one(back, '') : null };
  }
  const pathText = f => {
    const L = (legRows[f.id] || []).filter(x => x.journey === 0);
    const a = L.length ? L[0].origin : f.origin, b = L.length ? L[L.length - 1].destination : f.destination;
    return `${cityName(a)} – ${cityName(b)}${(legRows[f.id] || []).some(x => x.journey === 1) ? ' (return trip)' : ''}`;
  };

  const stay = stays[fid] || null;
  const stayN = stay && stay.nights ? Number(stay.nights) : 0;
  const slotHotels = [h1, h2, h3 === 'same' ? h1 : h3];
  const active = [0, 1, 2].filter(i => slotHotels[i]);
  const nightsOf = allocate(stayN, active, edits);
  const enough = stayN >= active.length;
  const group = pax.a + pax.cb;
  const suggested = suggestRoom(group);
  const room = roomPick || suggested;
  const extraPP = extras[fid] || 0;
  const key = JSON.stringify([fid, pax, slotHotels, nightsOf, room, extra && extraPP > 0, visa]);
  const fresh = res && res.key === key;
  const m = Number(markup) || 0;

  function pickFlight(id) { setFid(id); setRes(null); setError(''); setEdits([]); setShowFl(false); }
  function setHotel(setter, v) { setter(v); setEdits([]); }
  function setNights(i, v) {
    const k = active.length;
    let ed = [...edits.filter(e => e[0] !== i && active.includes(e[0])), [i, v]].slice(-(k - 1));
    const lockedOthers = ed.filter(e => e[0] !== i).reduce((s, e) => s + e[1], 0);
    const maxv = stayN - lockedOthers - (k - ed.length);
    const val = Math.min(Math.max(v, 1), Math.max(maxv, 1));
    ed = ed.map(e => (e[0] === i ? [i, val] : e));
    setEdits(ed);
  }
  const setP = (k, v) => setPax(p => ({ ...p, [k]: v }));

  // ---- the price: works itself out a moment after any change ----
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const my = ++seq.current;   // anything older is ignored
    if (!loaded) return;
    setError('');
    if (!fid || pax.a < 1) { setRes(null); setBusy(false); return; }
    if (active.length > 0 && !stayN) { setRes(null); setBusy(false); setError('The stay length of this flight is not set yet. Choose another flight or remove the hotels.'); return; }
    if (active.length > 0 && !enough) { setRes(null); setBusy(false); setError(`This stay has only ${stayN} nights, so it cannot have ${active.length} hotel parts. Leave a part empty.`); return; }
    const hs = active.map(i => ({ hotel: slotHotels[i], nights: nightsOf[i] }));
    setBusy(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('umrah_quote', {
        p_flight: fid, p_adults: pax.a, p_cb: pax.cb, p_cn: pax.cn, p_inf: pax.i, p_room: room, p_hotels: hs, p_extra: extra && extraPP > 0, p_visa: visa,
      });
      if (my !== seq.current) return;
      setBusy(false);
      if (error) { setError(error.message); setRes(null); return; }
      const f = flightOf(fid);
      setRes({
        key, q: data,
        snap: { pax: { ...pax }, visa, room, nights: stayN, trip: f ? trip(f) : null, flight: f, hotels: active.map(i => ({ ...hotelOf(slotHotels[i]), nights: nightsOf[i] })) },
      });
    }, 350);
    return () => clearTimeout(t);
  }, [key, loaded]);
  /* eslint-enable react-hooks/exhaustive-deps */

  function saveMarkup(v) { setMarkup(v); try { localStorage.setItem('umrah_markup', v); } catch (e) { /* ignore */ } }

  let lines = [], payers = 0, clientTotal = 0;
  if (res) {
    const q = res.q, p = res.snap.pax;
    lines = [['Adult', p.a, q.adult + m], ['Child with bed', p.cb, q.child_bed + m], ['Child without bed', p.cn, q.child_nobed + m], ['Infant', p.i, q.infant]].filter(x => x[1] > 0);
    payers = p.a + p.cb + p.cn;
    clientTotal = q.total + payers * m;
  }

  function whatsapp() {
    const sn = res.snap, p = sn.pax;
    const text = [
      '*Umrah package*',
      sn.trip ? `Going: ${sn.trip.go}` : '',
      sn.trip && sn.trip.back ? `Return: ${sn.trip.back}` : '',
      sn.nights ? `Stay: ${sn.nights} nights` : '',
      ...sn.hotels.map(h => `${h.city}: ${h.name} - ${h.nights} nights${h.distance_m != null ? ` (${h.distance_m} m)` : ''}${h.area ? `, ${h.area}` : ''}`),
      sn.hotels.length ? `Room: ${TYPE_LABEL[sn.room]}` : '',
      sn.visa ? 'Visa included' : 'Visa not included',
      `Passengers: ${p.a} adult${p.cb ? `, ${p.cb} child with bed` : ''}${p.cn ? `, ${p.cn} child without bed` : ''}${p.i ? `, ${p.i} infant` : ''}`,
      ...lines.map(l => `${l[0]}: PKR ${num(l[2])} each`),
      `*Total: PKR ${num(clientTotal)}*`,
      agency,
    ].filter(Boolean).join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  const hotelOpts = city => hotels.filter(h => h.city === city).map(h => <option key={h.id} value={h.id}>{h.name}{h.distance_m != null ? ` · ${h.distance_m} m` : ''}{h.area ? ` · ${h.area}` : ''}</option>);
  const nightOpts = Array.from({ length: Math.max(stayN - (active.length - 1), 1) }, (_, n) => n + 1);
  const ok = !!res && !!fresh;

  return (
    <div className="um">
      <UmrahStyle />
      <style>{'@media print{.topbar,.paystrip,.noprint,.topmain>h1{display:none!important}.topmain{padding:0!important}}'}</style>
      <div className="noprint actions" style={{ marginBottom: 12 }}><Link href="/agent/umrah"><button className="ghost">← Back to Umrah</button></Link></div>
      {error && <div className="error noprint">{error}</div>}

      <div className="um-layout">
        {/* ---------- left: the steps ---------- */}
        <div className="um-form noprint">
          <div className="card um-sec">
            <h2><span className="um-num">1</span>Passengers</h2>
            <div className="um-steps">
              <Stepper label="Adults" value={pax.a} min={0} onChange={v => setP('a', v)} />
              <Stepper label="Children with bed" hint="Pays like an adult" value={pax.cb} onChange={v => setP('cb', v)} />
              <Stepper label="Children without bed" hint="Flight and visa only" value={pax.cn} onChange={v => setP('cn', v)} />
              <Stepper label="Infants" hint="Ticket and visa only" value={pax.i} onChange={v => setP('i', v)} />
            </div>
            {pax.a < 1 && <p className="neg small" style={{ margin: '10px 0 0' }}>At least 1 adult is needed.</p>}
          </div>

          <div className="um-sec" style={{ margin: '18px 0 8px' }}><h2 style={{ margin: 0 }}><span className="um-num">2</span>Umrah flight <small>the dates decide the stay</small></h2></div>
          {!loaded ? <p className="muted">Loading...</p> : flights.length === 0 ? (
            <div className="card"><p className="muted">No Umrah flights are available right now. If you expected to see some, please ask the main agency.</p></div>
          ) : flights.map(f => {
            const s = stays[f.id];
            const sel = fid === f.id;
            return (
              <div className="card fz" key={f.id} style={sel ? { borderColor: '#0369a1', borderWidth: 2 } : undefined}>
                <div className="fzhead">
                  <AirlineLogo flightNo={f.flight_no} airline={f.airline} size={34} />
                  <span className="fzpath">{pathText(f)}</span>
                </div>
                <div className="fzrow">
                  <LegCols f={f} legs={lm[f.id]} />
                  <div className="fzcol fzmid">{f.meal || '-'}</div>
                  <div className="fzcol fzmid">{s && s.nights ? <><b>{s.nights}</b> nights<div className="small muted">stay in KSA</div></> : <span className="muted small">stay not set</span>}</div>
                  <div className="fzcol fzmid fzbtn"><button className={sel ? 'ok' : 'book'} onClick={() => pickFlight(f.id)}>{sel ? '✓ Selected' : 'Choose'}</button></div>
                </div>
              </div>
            );
          })}

          <div className="card um-sec">
            <h2><span className="um-num">3</span>Hotels <small>Makkah → Madinah → Makkah</small></h2>
            {!fid ? <p className="um-hint" style={{ marginTop: 0 }}>Choose the flight first. Its dates decide the number of nights.</p> : !stayN ? (
              <p className="neg small">The stay length of this flight is not set yet. You can still price the flight and visa only. Please ask the main agency to set it.</p>
            ) : (
              <p style={{ margin: '0 0 12px' }}>Stay in Saudi Arabia: <b>{stayN} nights</b>. The parts always add up to exactly this.</p>
            )}
            {[0, 1, 2].map(i => {
              const city = PART_CITY[i];
              const on = !!slotHotels[i];
              const value = i === 0 ? h1 : i === 1 ? h2 : h3;
              const setter = i === 0 ? setH1 : i === 1 ? setH2 : setH3;
              return (
                <div className={'um-slot ' + (city === 'Makkah' ? 'mk' : 'md')} key={i}>
                  <div>
                    <label>Part {i + 1} · {city}</label>
                    <select value={value} onChange={e => setHotel(setter, e.target.value)}>
                      {i === 2 && <option value="same">{h1 ? `Same hotel as part 1 (${hotelOf(h1)?.name || ''})` : 'Same hotel as part 1'}</option>}
                      <option value="">- none -</option>
                      {hotelOpts(city)}
                    </select>
                  </div>
                  <div>
                    <label>Nights</label>
                    {on && stayN > 0 ? (
                      active.length === 1 ? <div className="um-n">{nightsOf[i]}</div> : (
                        <select value={nightsOf[i] || 1} onChange={e => setNights(i, parseInt(e.target.value, 10) || 1)}>
                          {nightOpts.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      )
                    ) : <div className="muted small" style={{ padding: '12px 0' }}>-</div>}
                  </div>
                </div>
              );
            })}
            {active.length > 1 && stayN > 0 && <p className="um-hint">{active.map(i => nightsOf[i]).join(' + ')} = <b>{stayN} nights</b>. Change one part and the others adjust by themselves.</p>}
            {active.length > 0 && stayN > 0 && !enough && <p className="neg small">Only {stayN} nights: leave a part empty.</p>}
            {active.length === 0 && <p className="um-hint">No hotel chosen: the price will be flight and visa only.</p>}
          </div>

          <div className="card um-sec">
            <h2><span className="um-num">4</span>Room type</h2>
            <div className="um-chips" role="radiogroup" aria-label="Room type">
              {ROOMS.map(r => (
                <button key={r} type="button" role="radio" aria-checked={room === r} className={room === r ? '' : 'ghost'} style={{ minHeight: 48, flex: '1 1 96px', lineHeight: 1.2 }} onClick={() => setRoomPick(r === suggested && !roomPick ? '' : r)}>
                  {ROOM_SHORT[r]}<div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{ROOM_SUB[r]}</div>
                </button>
              ))}
            </div>
            <p className="um-hint">
              {roomPick
                ? <>You chose this room. <a href="#" onClick={e => { e.preventDefault(); setRoomPick(''); }}>Use the suggestion ({ROOM_SHORT[suggested]})</a></>
                : <>Suggested for {group} {group === 1 ? 'person' : 'people'} with a bed: <b>{ROOM_SHORT[suggested]}</b>. Tap another to change.</>}
            </p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={visa} onChange={e => setVisa(e.target.checked)} /> Include the visa in the price
            </label>
            {extraPP > 0 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={extra} onChange={e => setExtra(e.target.checked)} /> Add the optional extra service (+PKR {num(extraPP)} per adult and child)
              </label>
            )}
          </div>
        </div>

        {/* ---------- right: the live price / client card ---------- */}
        <div className="um-side">
          <div className="um-live noprint">{busy ? 'Working out the price…' : ok ? 'Price is up to date' : ''}</div>
          {!res ? (
            <div className="um-empty noprint"><b>Your price will show here</b>Choose an Umrah flight. It works out by itself, no button needed.</div>
          ) : (
            <div className={'um-res' + (fresh ? '' : ' um-stale')}>
              {agency && <div className="um-agency">{agency}</div>}
              <div className="um-title">Umrah package</div>
              <div className="um-sum">
                {res.snap.trip && <div>Going: <b>{res.snap.trip.go}</b></div>}
                {res.snap.trip && res.snap.trip.back && <div>Return: <b>{res.snap.trip.back}</b></div>}
              </div>
              <StayBar total={res.snap.nights} parts={res.snap.hotels} />
              <div className="um-chips um-blk">
                {res.snap.hotels.length > 0 && <span className="um-chip">{TYPE_LABEL[res.snap.room]} room</span>}
                <span className="um-chip">{res.snap.visa ? 'Visa included' : 'Visa not included'}</span>
                <span className="um-chip">{res.snap.pax.a} adult{res.snap.pax.a === 1 ? '' : 's'}{res.snap.pax.cb ? ` · ${res.snap.pax.cb} child (bed)` : ''}{res.snap.pax.cn ? ` · ${res.snap.pax.cn} child (no bed)` : ''}{res.snap.pax.i ? ` · ${res.snap.pax.i} infant` : ''}</span>
              </div>
              <div className="um-blk">
                <table className="um-price"><tbody>
                  {lines.map(l => <tr key={l[0]}><td>{l[0]} × {l[1]}</td><td>PKR {num(l[2])} each</td></tr>)}
                </tbody></table>
                <div className="um-total"><span className="t">Total</span><span className="v"><small>PKR</small>{num(clientTotal)}</span></div>
              </div>
              {res.q.warning && <div className="info" style={{ marginTop: 12 }}>{res.q.warning}</div>}

              <div className="noprint">
                <div className="um-agent">
                  <div className="actions" style={{ flexWrap: 'wrap' }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>Your profit per person (PKR)</label>
                    <input type="number" min="0" step="100" style={{ width: 110 }} value={markup} onChange={e => saveMarkup(e.target.value)} placeholder="0" />
                  </div>
                  <div className="small" style={{ marginTop: 8 }}>You pay the agency: <b>PKR {num(res.q.total)}</b> · Your profit: <b>PKR {num(payers * m)}</b> <span className="muted">(not printed or sent)</span></div>
                </div>
                <div className="actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                  <button disabled={!ok} onClick={() => window.print()}>Print / Save as PDF</button>
                  <button className="ok" disabled={!ok} onClick={whatsapp}>Send on WhatsApp</button>
                  {res.snap.flight && <button className="ghost" onClick={() => setShowFl(!showFl)}>{showFl ? 'Hide' : 'Show'} full flight details</button>}
                </div>
                {showFl && res.snap.flight && (
                  <div className="card fz" style={{ marginTop: 10 }}>
                    <div className="fzhead"><AirlineLogo flightNo={res.snap.flight.flight_no} airline={res.snap.flight.airline} size={34} /><span className="fzpath">{pathText(res.snap.flight)}</span></div>
                    <div className="fzrow"><LegCols f={res.snap.flight} legs={lm[res.snap.flight.id]} />
                      <div className="fzcol fzmid">{res.snap.flight.baggage || '-'}</div><div className="fzcol fzmid">{res.snap.flight.meal || '-'}</div></div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* phone: floating bar with the total and the two main actions */}
      <div className="um-space noprint" />
      <div className="um-dock noprint">
        <div className="in">
          <div className="s">{res ? 'Total for the client' : 'Total'}<b>{res ? `PKR ${num(clientTotal)}` : '—'}</b></div>
          <div className="b">
            <button disabled={!ok} onClick={() => window.print()}>PDF</button>
            <button className="ok" disabled={!ok} onClick={whatsapp}>WhatsApp</button>
          </div>
        </div>
      </div>
    </div>
  );
}
