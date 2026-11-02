import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { UmrahStyle, Stepper, StayBar, suggestRoom } from '@/components/UmrahBits';
import { num } from '@/lib/umrah';
import { TYPE_LABEL } from '@/lib/umrahPackages';

const ROOMS = ['sharing', 'double', 'triple', 'quad', 'quint'];
const ROOM_SHORT = { sharing: 'Sharing', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
const ROOM_SUB = { sharing: 'per person, mixed', double: '2 people', triple: '3 people', quad: '4 people', quint: '5 people' };
const PART_CITY = ['Makkah', 'Madinah', 'Makkah'];
const MEM = 'umrah_hotel_v1';

// Hotel only: no flight and no visa. The agent chooses the hotels and the nights freely. PKR only.
export default function HotelOnly() {
  return <Shell role="agent" title="Hotel only">{p => <Hotel agency={p?.agency_name || ''} />}</Shell>;
}

function Hotel({ agency }) {
  const [hotels, setHotels] = useState(null);
  const [pax, setPax] = useState({ a: 2, cb: 0 });
  const [parts, setParts] = useState([{ h: '', n: 5 }, { h: '', n: 4 }, { h: '', n: 3 }]);
  const [roomPick, setRoomPick] = useState('');
  const [markup, setMarkup] = useState('');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const seq = useRef(0);
  const saved = useRef({});

  useEffect(() => {
    (async () => {
      try {
        setMarkup(localStorage.getItem('umrah_markup_hotel') || '');
        const s = JSON.parse(localStorage.getItem(MEM) || '{}'); saved.current = s || {};
        if (s.pax && ['a', 'cb'].every(k => Number.isInteger(s.pax[k]) && s.pax[k] >= 0 && s.pax[k] <= 60)) setPax(s.pax);
        if (ROOMS.includes(s.roomPick)) setRoomPick(s.roomPick);
      } catch (e) { /* ignore */ }
      setReady(true);
      const { data, error } = await supabase.from('umrah_hotels').select('id,name,city,distance_m,area').eq('active', true).order('name');
      if (error) { setError(error.message); setHotels([]); return; }
      setHotels(data);
      const s = saved.current;
      if (Array.isArray(s.h)) setParts(ps => ps.map((p, i) => (s.h[i] && data.some(x => x.id === s.h[i] && x.city === PART_CITY[i]) ? { ...p, h: s.h[i] } : p)));
    })();
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(MEM, JSON.stringify({ pax, roomPick, h: parts.map(p => p.h) })); } catch (e) { /* ignore */ }
  }, [ready, pax, roomPick, parts]);

  const hotelOf = id => (hotels || []).find(h => h.id === id);
  const group = pax.a + pax.cb;
  const suggested = suggestRoom(group);
  const room = roomPick || suggested;
  const active = [0, 1, 2].filter(i => parts[i].h);
  const key = JSON.stringify([pax, room, active.map(i => [parts[i].h, parts[i].n])]);
  const setPart = (i, k, v) => setParts(ps => ps.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const my = ++seq.current;
    if (!hotels) return;
    setError('');
    if (active.length === 0 || pax.a < 1) { setRes(null); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('umrah_hotel_quote', { p_adults: pax.a, p_cb: pax.cb, p_room: room, p_hotels: active.map(i => ({ hotel: parts[i].h, nights: parts[i].n })) });
      if (my !== seq.current) return;
      setBusy(false);
      if (error) { setError(error.message); setRes(null); return; }
      setRes({ key, q: data, room, parts: active.map(i => ({ ...hotelOf(parts[i].h), nights: parts[i].n })) });
    }, 350);
    return () => clearTimeout(t);
  }, [key, hotels]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const m = Number(markup) || 0;
  const fresh = res && res.key === key;
  const each = res ? res.q.each + m : 0;
  const total = res ? res.q.total + res.q.people * m : 0;
  function saveMarkup(v) { setMarkup(v); try { localStorage.setItem('umrah_markup_hotel', v); } catch (e) { /* ignore */ } }
  function whatsapp() {
    const text = ['*Umrah hotel (no flight, no visa)*', ...res.parts.map(h => `${h.city}: ${h.name} - ${h.nights} nights${h.distance_m != null ? ` (${h.distance_m} m)` : ''}${h.area ? `, ${h.area}` : ''}`),
      `Room: ${TYPE_LABEL[res.room]}`, `People: ${res.q.people}`, `Per person: PKR ${num(each)}`, `*Total: PKR ${num(total)}*`, agency].filter(Boolean).join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }
  const opts = city => (hotels || []).filter(h => h.city === city).map(h => <option key={h.id} value={h.id}>{h.name}{h.distance_m != null ? ` · ${h.distance_m} m` : ''}{h.area ? ` · ${h.area}` : ''}</option>);

  return (
    <div className="um">
      <UmrahStyle />
      <style>{'@media print{.topbar,.paystrip,.noprint,.topmain>h1{display:none!important}.topmain{padding:0!important}}'}</style>
      <div className="noprint actions" style={{ marginBottom: 12 }}><Link href="/agent/umrah"><button className="ghost">← Back to Umrah</button></Link></div>
      {error && <div className="error noprint">{error}</div>}
      <div className="um-layout">
        <div className="um-form noprint">
          <div className="card um-sec">
            <h2><span className="um-num">1</span>People</h2>
            <div className="um-steps">
              <Stepper label="Adults" value={pax.a} onChange={v => setPax(p => ({ ...p, a: v }))} />
              <Stepper label="Children with bed" hint="Pays like an adult" value={pax.cb} onChange={v => setPax(p => ({ ...p, cb: v }))} />
            </div>
            <p className="um-hint">Hotel only has no flight and no visa. A child without a bed is not part of a hotel price.</p>
          </div>
          <div className="card um-sec">
            <h2><span className="um-num">2</span>Hotels and nights <small>Makkah → Madinah → Makkah</small></h2>
            {!hotels ? <p className="muted">Loading...</p> : [0, 1, 2].map(i => (
              <div className={'um-slot ' + (PART_CITY[i] === 'Makkah' ? 'mk' : 'md')} key={i} style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                <div>
                  <label>Part {i + 1} · {PART_CITY[i]}</label>
                  <select value={parts[i].h} onChange={e => setPart(i, 'h', e.target.value)}><option value="">- none -</option>{opts(PART_CITY[i])}</select>
                </div>
                {parts[i].h && <Stepper label="Nights" min={1} max={60} value={parts[i].n} onChange={v => setPart(i, 'n', v)} />}
              </div>
            ))}
          </div>
          <div className="card um-sec">
            <h2><span className="um-num">3</span>Room type</h2>
            <div className="um-chips" role="radiogroup" aria-label="Room type">
              {ROOMS.map(r => (
                <button key={r} type="button" role="radio" aria-checked={room === r} className={room === r ? '' : 'ghost'} style={{ minHeight: 48, flex: '1 1 96px', lineHeight: 1.2 }} onClick={() => setRoomPick(r === suggested && !roomPick ? '' : r)}>
                  {ROOM_SHORT[r]}<div style={{ fontSize: 11, fontWeight: 500, opacity: 0.85 }}>{ROOM_SUB[r]}</div>
                </button>
              ))}
            </div>
            <p className="um-hint">{roomPick ? <>You chose this room. <a href="#" onClick={e => { e.preventDefault(); setRoomPick(''); }}>Use the suggestion ({ROOM_SHORT[suggested]})</a></> : <>Suggested for {group} {group === 1 ? 'person' : 'people'}: <b>{ROOM_SHORT[suggested]}</b>. Tap another to change.</>}</p>
          </div>
        </div>
        <div className="um-side">
          <div className="um-live noprint">{busy ? 'Working out the price…' : fresh ? 'Price is up to date' : ''}</div>
          {!res ? <div className="um-empty noprint"><b>Your price will show here</b>Choose at least one hotel. It works out by itself.</div> : (
            <div className={'um-res' + (fresh ? '' : ' um-stale')}>
              {agency && <div className="um-agency">{agency}</div>}
              <div className="um-title">Umrah hotel</div>
              <div className="um-sum">No flight · No visa</div>
              <StayBar total={res.q.nights} parts={res.parts} />
              <div className="um-chips um-blk"><span className="um-chip">{TYPE_LABEL[res.room]} room</span><span className="um-chip">{res.q.people} {res.q.people === 1 ? 'person' : 'people'}</span></div>
              <div className="um-blk">
                <table className="um-price"><tbody><tr><td>Per person × {res.q.people}</td><td>PKR {num(each)}</td></tr></tbody></table>
                <div className="um-total"><span className="t">Total</span><span className="v"><small>PKR</small>{num(total)}</span></div>
              </div>
              {res.q.warning && <div className="info" style={{ marginTop: 12 }}>{res.q.warning}</div>}
              <div className="noprint">
                <div className="um-agent">
                  <div className="actions" style={{ flexWrap: 'wrap' }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>Your profit per person (PKR)</label>
                    <input type="number" min="0" step="100" style={{ width: 110 }} value={markup} onChange={e => saveMarkup(e.target.value)} placeholder="0" />
                  </div>
                  <div className="small" style={{ marginTop: 8 }}>You pay the agency: <b>PKR {num(res.q.total)}</b> · Your profit: <b>PKR {num(res.q.people * m)}</b> <span className="muted">(not printed or sent)</span></div>
                </div>
                <div className="actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                  <button disabled={!fresh} onClick={() => window.print()}>Print / Save as PDF</button>
                  <button className="ok" disabled={!fresh} onClick={whatsapp}>Send on WhatsApp</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="um-space noprint" />
      <div className="um-dock noprint"><div className="in">
        <div className="s">Total<b>{res ? `PKR ${num(total)}` : '—'}</b></div>
        <div className="b"><button disabled={!fresh} onClick={() => window.print()}>PDF</button><button className="ok" disabled={!fresh} onClick={whatsapp}>WhatsApp</button></div>
      </div></div>
    </div>
  );
}
