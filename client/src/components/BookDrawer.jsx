'use client';
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/db';
import AirlineLogo from '@/components/AirlineLogo';
import CountrySelect from '@/components/CountrySelect';
import { dShort } from '@/lib/format';
import { TITLES, blankPassenger, passportShort, toISODate, typeProblem } from '@/lib/passenger';
import { matchCountry } from '@/lib/countries';
import useDiscount, { priceFor } from '@/lib/useDiscount';

const TIMER_SECS = 600;
const REQUIRED = ['title', 'first_name', 'last_name', 'dob', 'passport_number', 'passport_expiry', 'nationality'];

function fmtTimer(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function getPaxType(i, adults, children) {
  if (i < adults) return 'adult';
  if (i < adults + children) return 'child';
  return 'infant';
}

// ── Smart date input: accepts d/m/yyyy, d-m-yyyy, ddmmyyyy, auto-formats ──────
function SmartDateInput({ value, onChange, placeholder = 'DD/MM/YYYY' }) {
  const [raw, setRaw] = useState('');

  // sync raw display when value changes externally
  useEffect(() => {
    if (!value) { setRaw(''); return; }
    // value is yyyy-mm-dd, display as dd/mm/yyyy
    const [y, m, d] = value.split('-');
    if (y && m && d) setRaw(`${d}/${m}/${y}`);
  }, [value]);

  function parse(str) {
    str = str.trim();
    // try d/m/yyyy or d-m-yyyy or d.m.yyyy
    let m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (m) {
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return toISODate(`${m[1]}/${m[2]}/${y}`);
    }
    // try ddmmyyyy (8 digits)
    m = str.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (m) return toISODate(`${m[1]}/${m[2]}/${m[3]}`);
    // try d/m (auto-add current year)
    m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
    if (m) return toISODate(`${m[1]}/${m[2]}/${new Date().getFullYear()}`);
    return toISODate(str);
  }

  function handleChange(e) {
    let v = e.target.value;
    // auto-insert slashes: after 2 digits for day, after 2 more for month
    v = v.replace(/[^\d\/]/g, '');
    if (/^\d{2}$/.test(v) && raw.length < v.length) v = v + '/';
    if (/^\d{2}\/\d{2}$/.test(v) && raw.length < v.length) v = v + '/';
    setRaw(v);
    const iso = parse(v);
    if (iso) onChange(iso);
  }

  function handleBlur() {
    const iso = parse(raw);
    if (iso) {
      const [y, mo, d] = iso.split('-');
      setRaw(`${d}/${mo}/${y}`);
      onChange(iso);
    } else if (raw) {
      setRaw('');
      onChange('');
    }
  }

  function openPicker(e) {
    // trigger the hidden date input
    e.currentTarget.previousSibling?.showPicker?.();
  }

  return (
    <div className="bsm-date-wrap">
      <input
        type="date"
        className="bsm-date-hidden"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        tabIndex={-1}
      />
      <input
        className="bsm-cell-input bsm-date-text"
        placeholder={placeholder}
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={10}
      />
      <button
        type="button"
        className="bsm-date-icon"
        tabIndex={-1}
        onClick={() => {
          const wrap = document.activeElement?.closest('.bsm-date-wrap');
          wrap?.querySelector('.bsm-date-hidden')?.showPicker?.();
        }}
        aria-label="Pick date"
      >
        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="16" height="15" rx="2"/>
          <path d="M6 1v4M14 1v4M2 8h16"/>
        </svg>
      </button>
    </div>
  );
}

export default function BookSeatsModal({ flightId, onClose, onBooked }) {
  const [flight, setFlight] = useState(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [pax, setPax] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(TIMER_SECS);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef(null);
  const bodyRef = useRef(null);
  const disc = useDiscount();

  useEffect(() => {
    supabase.from('flights_with_seats').select('*').eq('id', flightId).single()
      .then(({ data }) => { if (data) setFlight(data); });
  }, [flightId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setSecs(s => { if (s <= 1) { clearInterval(timerRef.current); setExpired(true); return 0; } return s - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // rebuild pax when counts change
  useEffect(() => {
    const total = adults + children + infants;
    setPax(prev => Array.from({ length: total }, (_, i) => {
      const type = getPaxType(i, adults, children);
      return prev[i] ? { ...prev[i], pax_type: type } : { ...blankPassenger(), pax_type: type };
    }));
  }, [adults, children, infants]);

  const max = flight?.seats_left ?? 99;
  const total = adults + children + infants;
  const rawPrice = flight ? priceFor(flight.price, disc) : 0;
  const price = (!rawPrice || isNaN(rawPrice)) ? (Number(flight?.price) || 0) : rawPrice;
  const infantPrice = Math.round(price * 0.1);
  const grandTotal = price * (adults + children) + infantPrice * infants;

  // G-class rule: 1 child per 9 adults
  const maxChildren = Math.floor(adults / 9);
  const adultsNeededForNextChild = 9 - (adults % 9 === 0 ? 9 : adults % 9);
  const [showGClass, setShowGClass] = useState(false);

  const upd = (i, k, v) => setPax(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r));

  function tryAddChild() {
    if (children < maxChildren && total < max) {
      setChildren(c => c + 1);
      setShowGClass(false);
    } else {
      setShowGClass(true);
    }
  }

  function check() {
    if (!flight) return 'Flight not loaded.';
    if (total > flight.seats_left) return `Only ${flight.seats_left} seats available.`;
    if (total === 0) return 'Add at least 1 passenger.';
    const dep = new Date(flight.departure_at);
    for (let i = 0; i < pax.length; i++) {
      const p = pax[i], who = `Passenger ${i + 1}`;
      if (!p.title) return `${who}: choose a title.`;
      if (REQUIRED.some(k => !String(p[k]).trim())) return `${who}: fill all fields.`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.dob) || isNaN(new Date(p.dob))) return `${who}: invalid date of birth.`;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(p.passport_expiry) || isNaN(new Date(p.passport_expiry))) return `${who}: invalid passport expiry.`;
      if (new Date(p.dob) >= new Date()) return `${who}: date of birth must be in the past.`;
      if (new Date(p.passport_expiry) <= dep) return `${who}: passport expires before the flight.`;
    }
    return '';
  }

  async function submit() {
    const err = check();
    if (err) { setError(err); bodyRef.current?.scrollTo(0, 0); return; }
    const soft = pax.flatMap((p, i) => {
      const dep = flight.departure_at; const w = [];
      if (passportShort(p.passport_expiry, dep)) w.push(`Pax ${i + 1} (${p.first_name}): passport valid < 6 months after flight`);
      const tp = typeProblem(p.pax_type, p.dob, dep);
      if (tp) w.push(`Pax ${i + 1} (${p.first_name}) ${tp}`);
      return w;
    });
    if (soft.length && !confirm(`Check before booking:\n\n• ${soft.join('\n• ')}\n\nBook anyway?`)) return;
    setBusy(true); setError('');
    const { error: rpcErr } = await supabase.rpc('create_booking', { p_flight_id: flightId, p_passengers: pax });
    setBusy(false);
    if (rpcErr) { setError(rpcErr.message); bodyRef.current?.scrollTo(0, 0); return; }
    onBooked();
  }

  const timerCls = expired ? 'bsm-timer expired' : secs < 120 ? 'bsm-timer warn' : 'bsm-timer';
  const TYPE_COLOR = { adult: 'bsm-badge-adult', child: 'bsm-badge-child', infant: 'bsm-badge-infant' };
  const TYPE_LABEL = { adult: 'Adult', child: 'Child', infant: 'Infant' };
  const adultPaxOptions = pax.filter((_, i) => i < adults);

  return (
    <div className="bsm-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bsm-modal" role="dialog" aria-modal="true">

        {/* HEADER */}
        <div className="bsm-head">
          <div className="bsm-head-left">
            <div className="bsm-head-title">Book Seats</div>
            <div className="bsm-head-meta">
              {flight && <>
                <span className="bsm-meta-item"><b>Group:</b> {flight.airline} – {flight.origin}/{flight.destination}</span>
                <span className="bsm-meta-item bsm-meta-green"><b>Seats:</b> {flight.seats_left}</span>
                <span className="bsm-meta-item"><b>Dep:</b> {dShort(flight.departure_at)}</span>
              </>}
            </div>
          </div>
          <div className="bsm-head-right">
            <div className={timerCls}>{expired ? '⏰ Expired' : <>⏱ <b>{fmtTimer(secs)}</b></>}</div>
            <button type="button" className="bsm-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        </div>

        {/* BODY */}
        <div className="bsm-body" ref={bodyRef}>
          {error && <div className="error" style={{ marginBottom: 14 }}>{error}</div>}

          {/* airline row */}
          {flight && (
            <div className="bsm-airline-row">
              <AirlineLogo flightNo={flight.flight_no} airline={flight.airline} size={26} />
              <span className="bsm-airline-name">{flight.airline?.toUpperCase()}</span>
            </div>
          )}

          {/* passengers + price + total */}
          <div className="bsm-row3">
            {/* counters */}
            <div className="bsm-box">
              <div className="bsm-section-title">Passengers ({total})</div>

              {/* Adults */}
              <div className="bsm-counter">
                <span className="bsm-counter-label">Adults</span>
                <div className="bsm-counter-ctrl">
                  <button type="button" className="bsm-step" onClick={() => setAdults(v => Math.max(1, v - 1))} disabled={adults <= 1}>−</button>
                  <span className="bsm-counter-val">{adults}</span>
                  <button type="button" className="bsm-step" onClick={() => { if (total < max) setAdults(v => v + 1); }} disabled={total >= max}>+</button>
                </div>
              </div>

              {/* Children with G-class rule */}
              <div className="bsm-counter">
                <span className="bsm-counter-label">Children</span>
                <div className="bsm-counter-ctrl">
                  <button type="button" className="bsm-step" onClick={() => { setChildren(v => Math.max(0, v - 1)); setShowGClass(false); }} disabled={children <= 0}>−</button>
                  <span className="bsm-counter-val">{children}</span>
                  <button type="button" className="bsm-step" onClick={tryAddChild} disabled={total >= max}>+</button>
                </div>
              </div>
              {showGClass && (
                <div className="bsm-gclass-info">
                  <div className="bsm-gclass-title">G Class Requirement</div>
                  <div className="bsm-gclass-body">
                    For every 9 adults, you can add 1 child.<br />
                    You have <b>{adults}</b> adult(s) → allows <b>{maxChildren}</b> child(ren).<br />
                    To add another child, add <b>{adultsNeededForNextChild}</b> more adult(s) first.
                  </div>
                </div>
              )}

              {/* Infants */}
              <div className="bsm-counter" style={{ marginTop: 6 }}>
                <span className="bsm-counter-label muted">Infants</span>
                <div className="bsm-counter-ctrl">
                  <button type="button" className="bsm-step" onClick={() => setInfants(v => Math.max(0, v - 1))} disabled={infants <= 0}>−</button>
                  <span className="bsm-counter-val">{infants}</span>
                  <button type="button" className="bsm-step" onClick={() => { if (total < max) setInfants(v => v + 1); }} disabled={total >= max}>+</button>
                </div>
              </div>
            </div>

            {/* price/seat */}
            <div className="bsm-box">
              <div className="bsm-section-title">Price / Seat</div>
              <div className="bsm-price-list">
                <div className="bsm-price-row"><span>Adult</span><span>{price.toLocaleString('en-US')}</span></div>
                <div className="bsm-price-row"><span>Child</span><span>{price.toLocaleString('en-US')}</span></div>
                <div className="bsm-price-row muted"><span>Infant</span><span>{infantPrice.toLocaleString('en-US')}</span></div>
              </div>
            </div>

            {/* total */}
            <div className="bsm-box bsm-box-total">
              <div className="bsm-total-rows">
                <div className="bsm-total-row highlight"><span>Adults</span><span>{adults} × {price.toLocaleString('en-US')}</span></div>
                <div className={`bsm-total-row${children === 0 ? ' muted' : ''}`}><span>Children</span><span>{children > 0 ? `${children} × ${price.toLocaleString('en-US')}` : '—'}</span></div>
                <div className={`bsm-total-row${infants === 0 ? ' muted' : ''}`}><span>Infants</span><span>{infants > 0 ? `${infants} × ${infantPrice.toLocaleString('en-US')}` : '—'}</span></div>
              </div>
              <div className="bsm-grand-total">
                <span>Total PKR</span>
                <span className="bsm-grand-val">{grandTotal.toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          {/* passenger table */}
          {total > 0 && (
            <div className="bsm-pax-section">
              <div className="bsm-section-title" style={{ marginBottom: 8 }}>Passenger Details ({total} passengers)</div>
              <div className="bsm-table-wrap">
                <table className="bsm-table">
                  <thead>
                    <tr>
                      <th>SR#</th><th>TYPE</th><th>TITLE</th><th>GIVEN NAME</th><th>SURNAME</th>
                      <th>PASSPORT #</th><th>DOB</th><th>EXPIRY</th><th>NATIONALITY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pax.map((p, i) => {
                      const dep = flight?.departure_at;
                      const short = dep && passportShort(p.passport_expiry, dep);
                      const tp = dep && typeProblem(p.pax_type, p.dob, dep);
                      const isChild = p.pax_type === 'child';
                      return (
                        <React.Fragment key={i}>
                          <tr className={short || tp ? 'bsm-row-warn' : ''}>
                            <td className="bsm-td-sr">{i + 1}</td>
                            <td><span className={`bsm-badge ${TYPE_COLOR[p.pax_type]}`}>{TYPE_LABEL[p.pax_type]}</span></td>
                            <td>
                              <select className="bsm-cell-input" value={p.title} onChange={e => upd(i, 'title', e.target.value)}>
                                <option value="">—</option>
                                {TITLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                              </select>
                            </td>
                            <td><input className="bsm-cell-input" placeholder="First" value={p.first_name} onChange={e => upd(i, 'first_name', e.target.value)} /></td>
                            <td><input className="bsm-cell-input" placeholder="Last" value={p.last_name} onChange={e => upd(i, 'last_name', e.target.value)} /></td>
                            <td><input className="bsm-cell-input" placeholder="AB1234567" value={p.passport_number} onChange={e => upd(i, 'passport_number', e.target.value.toUpperCase())} /></td>
                            <td><SmartDateInput value={p.dob} onChange={v => upd(i, 'dob', v)} placeholder="DD/MM/YYYY" /></td>
                            <td><SmartDateInput value={p.passport_expiry} onChange={v => upd(i, 'passport_expiry', v)} placeholder="DD/MM/YYYY" /></td>
                            <td><CountrySelect value={p.nationality} onChange={v => upd(i, 'nationality', v)} /></td>
                          </tr>
                          {/* Mother selector for child rows */}
                          {isChild && (
                            <tr className="bsm-mother-row">
                              <td colSpan={9}>
                                <div className="bsm-mother-wrap">
                                  <label className="bsm-mother-label">Select Mother (Accompanying Adult) *</label>
                                  <select
                                    className="bsm-cell-input bsm-mother-select"
                                    value={p.mother_idx ?? ''}
                                    onChange={e => upd(i, 'mother_idx', e.target.value)}
                                  >
                                    <option value="">— Select accompanying adult —</option>
                                    {adultPaxOptions.map((a, ai) => (
                                      <option key={ai} value={ai}>
                                        {ai + 1}. {a.first_name || a.last_name ? `${a.first_name} ${a.last_name}`.trim() : `Adult ${ai + 1}`}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          )}
                          {(short || tp) && (
                            <tr className="bsm-warn-row">
                              <td colSpan={9}>
                                {short && <span className="bsm-warn-text">⚠ Passport valid &lt;6 months after flight</span>}
                                {tp && <span className="bsm-warn-text">⚠ {tp}</span>}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="bsm-foot">
          <button type="button" className="bsm-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="bsm-btn-book" disabled={busy || expired || total === 0} onClick={submit}>
            {busy ? 'Booking…' : 'Book Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
