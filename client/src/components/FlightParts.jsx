'use client';
import { useEffect, useState } from 'react';
import { dShort, tm } from '../lib/format';

export const fmtNo = n => (/^[A-Z0-9]*[A-Z]/.test(String(n || '').slice(0, 2)) ? String(n).replace(/^([A-Z0-9]{2})(\d)/, '$1 $2') : String(n || ''));

export const Plane = ({ landing }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" style={{ transform: landing ? 'rotate(45deg)' : 'rotate(-45deg)', flex: 'none' }} aria-hidden="true">
    <path fill="#0E4655" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
  </svg>
);

export const Chip = ({ on, onClick, children }) => (
  <button type="button" className={'chip' + (on ? ' on' : '')} onClick={onClick}>{children}</button>
);

export function FilterList({ title, items, sel, onToggle, onAll }) {
  const all = items.length > 0 && sel.length === items.length;
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="small" style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div className="fzbox">
        <label className="fzchk"><input type="checkbox" checked={all} onChange={() => onAll(!all)} /> <b>Select All</b></label>
        {items.map(([k, label]) => (
          <label key={k} className="fzchk"><input type="checkbox" checked={sel.includes(k)} onChange={() => onToggle(k)} /> {label}</label>
        ))}
      </div>
    </div>
  );
}

// the stacked leg columns (flight no, date, sector, time, baggage) shared by agent and admin rows
export function LegCols({ f, legs }) {
  const rows = legs && legs.length ? legs : [{ ...f, journey: 0 }];
  const bags = (f.baggage || '').split('/').map(x => x.trim()).filter(Boolean);
  const bag = i => (bags.length ? (bags[i] || bags[bags.length - 1]) : '-');
  const next = l => l.arrival_at && new Date(l.arrival_at).toDateString() !== new Date(l.departure_at).toDateString();
  return (
    <>
      <div className="fzcol">{rows.map((l, i) => <div key={i} className="fzline">{fmtNo(l.flight_no)}</div>)}</div>
      <div className="fzcol fzdate">{rows.map((l, i) => <div key={i} className="fzline"><Plane landing={l.journey === 1} />{dShort(l.departure_at)}</div>)}</div>
      <div className="fzcol">{rows.map((l, i) => <div key={i} className="fzline">{l.origin}-{l.destination}</div>)}</div>
      <div className="fzcol">{rows.map((l, i) => <div key={i} className="fzline">{tm(l.departure_at)}-{l.arrival_at ? tm(l.arrival_at) : ''}{next(l) ? <sup>+1</sup> : null}</div>)}</div>
      <div className="fzcol">{rows.map((l, i) => <div key={i} className="fzline">{bag(i)}</div>)}</div>
    </>
  );
}

// Column titles bar. It stays under the top bar while you scroll, so every column is always labelled.
// The widths below match the flight rows (flight no is now the first column, then the date).
const HEAD_CSS = `
.fzrow{grid-template-columns:1fr 1.5fr 1.1fr 1.5fr 1.1fr .6fr 1.1fr 1.2fr}
.fzrow.fzadmin{grid-template-columns:28px .9fr 1.3fr 1fr 1.4fr 1fr 1.1fr 1fr 1.1fr 1.2fr}
.fzcolhead{display:grid;grid-template-columns:1fr 1.5fr 1.1fr 1.5fr 1.1fr .6fr 1.1fr 1.2fr;gap:8px;align-items:center;position:sticky;z-index:15;margin:0 1px 12px;padding:13px 22px;background:#0E4655;color:#fff;border-radius:12px;font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase;box-shadow:0 4px 18px rgba(14,70,85,.22)}
.fzcolhead.fzadmin{grid-template-columns:28px .9fr 1.3fr 1fr 1.4fr 1fr 1.1fr 1fr 1.1fr 1.2fr}
.fzcolhead>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fzcolhead>div:last-child{text-align:right}
@media (max-width:1180px){.fzcolhead.fzadmin{display:none}}
@media (max-width:900px){.fzcolhead{display:none}}
@media (max-width:700px){.fzrow:not(.fzadmin){grid-template-columns:1fr 1fr!important;min-width:0!important}}
@media print{.fzcolhead{display:none}}
`;

export function FlightHead({ admin }) {
  const [top, setTop] = useState(64);
  useEffect(() => {
    const fit = () => {
      const bar = document.querySelector('.admin-topbar') || document.querySelector('.topbar');
      setTop(bar ? bar.offsetHeight + 6 : 70);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  const cols = admin
    ? ['', 'Flight#', 'Date', 'Origin-Destination', 'Time', 'Baggage', 'PNR / Meal', 'Price', 'Seats', 'Action']
    : ['Flight#', 'Date', 'Origin-Destination', 'Time', 'Baggage', 'Meal', 'Price', 'Action'];
  return (
    <>
      <style>{HEAD_CSS}</style>
      <div className={'fzcolhead' + (admin ? ' fzadmin' : '')} style={{ top }} role="row">
        {cols.map((c, i) => <div key={i} role="columnheader">{c}</div>)}
      </div>
    </>
  );
}
