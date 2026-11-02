import { dShort, tm } from '../lib/format';

// One flight in one table cell, always on ONE line. A connecting or return trip shows its flights side by side:
//   9P159 / 9P156      30 OCT / 19 NOV      06:05-10:05 / 11:50-18:40
// what = 'flight' | 'date' | 'time'
export default function LegLines({ f, legs, what }) {
  const rows = legs && legs.length ? legs : [{ ...f, journey: 0 }];
  const arrNext = l => l.arrival_at && new Date(l.arrival_at).toDateString() !== new Date(l.departure_at).toDateString();
  const sameYear = rows.every(l => new Date(l.departure_at).getFullYear() === new Date(rows[0].departure_at).getFullYear());
  const dateText = (l, i) => (rows.length > 1 && sameYear && i < rows.length - 1
    ? new Date(l.departure_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : dShort(l.departure_at));   // 01 NOV / 13 NOV 2026
  let parts = rows.map((l, i) => {
    if (what === 'flight') return <b>{l.flight_no}</b>;
    if (what === 'date') return dateText(l, i);
    return <>{tm(l.departure_at)}{l.arrival_at ? `–${tm(l.arrival_at)}` : ''}{arrNext(l) ? <sup>+1</sup> : null}</>;
  });
  if (what === 'date') {   // same date twice (a connection on the same day) is shown once
    const seen = rows.map(l => new Date(l.departure_at).toDateString());
    parts = parts.filter((_, i) => i === 0 || seen[i] !== seen[i - 1]);
  }
  return <div style={{ whiteSpace: 'nowrap' }}>{parts.map((p, i) => <span key={i}>{i > 0 ? ' / ' : ''}{p}</span>)}</div>;
}
