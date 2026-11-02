// Reads flight lines (same style as your itinerary project), works out the REAL arrival date and
// flight time using airport time zones, and joins connecting flights into one journey.
//
// Lines it understands (one flight leg per line):
//   SV723 07OCT ISBJED HK05 1035 1340        G9555 23SEP PEW SHJ 0730 0930
//   TK 710 07OCT ISBIST 0310 0715            SV725 G 01JUN ISBRUH 0950 1235
//   times with a colon (10:35), next-day arrival 0215+1 or -1, and an optional PNR at the end.
import { AIRPORTS } from './airports';
import { AIRLINES } from './airlines';

const MONTHS = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
export const STATUS_CODES = {
  HK: 'Confirmed', KK: 'Confirmed', HN: 'Awaiting confirmation', HL: 'Waitlisted', UN: 'Unable - not confirmed', HX: 'Cancelled',
};
const p2 = n => String(n).padStart(2, '0');

// ----- time zone helpers (handle daylight saving) -----
const cache = {};
function tzOffsetMinutes(utcMs, tz) {
  const dtf = cache[tz] || (cache[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }));
  const p = {};
  dtf.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; });
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - utcMs) / 60000);
}
export function localToUTC(dateStr, hhmm, tz) {
  const [y, mo, d] = dateStr.split('-').map(Number), [h, mi] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const o1 = tzOffsetMinutes(guess, tz);
  let utc = guess - o1 * 60000;
  const o2 = tzOffsetMinutes(utc, tz);
  if (o2 !== o1) utc = guess - o2 * 60000;
  return utc;
}
const addDays = (dateStr, n) => {
  const [y, mo, d] = dateStr.split('-').map(Number), t = new Date(Date.UTC(y, mo - 1, d + n));
  return `${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}`;
};
const tzOf = code => AIRPORTS[code]?.[2];
export const hm = mins => (mins == null ? '' : `${Math.floor(mins / 60)}h ${p2(mins % 60)}m`);

// real arrival date + flight time from the two airports' time zones (hint = +1 / -1 days written on the line)
function arrivalInfo(from, to, depDate, depTime, arrTime, hint) {
  const tzA = tzOf(from), tzB = tzOf(to);
  if (tzA && tzB) {
    const depU = localToUTC(depDate, depTime, tzA);
    for (const k of hint != null ? [hint] : [0, 1, 2, 3]) {
      const u = localToUTC(addDays(depDate, k), arrTime, tzB);
      if (u > depU) return { arrDate: addDays(depDate, k), minutes: Math.round((u - depU) / 60000) };
    }
  }
  return { arrDate: addDays(depDate, hint != null ? hint : (arrTime <= depTime ? 1 : 0)), minutes: null };
}

// ----- one line -> one leg -----
export function parseSegment(text, now = new Date()) {
  const bad = { error: 'Could not read this line. Example: SV725 07NOV ISBMED HK 0950 1205' };
  const norm = (text || '').trim().toUpperCase().replace(/(\d{1,2}):(\d{2})/g, '$1$2').replace(/\s+/g, ' ');
  let t = norm.split(' ');
  if (t.length >= 2 && /^[A-Z0-9]{2}$/.test(t[0]) && /^\d{1,4}[A-Z]?$/.test(t[1])) t = [t[0] + t[1], ...t.slice(2)];
  const fm = (t[0] || '').match(/^([A-Z0-9]{2})(\d{1,4})[A-Z]?$/);
  if (!fm || !/[A-Z]/.test(fm[1])) return bad;
  let i = 1;
  if (/^[A-Z]$/.test(t[i] || '')) i++;                 // booking class letter before the date, e.g. "SV725 G 01JUN"
  const dm = (t[i] || '').match(/^(\d{1,2})([A-Z]{3})$/);
  if (!dm) return bad;
  const day = parseInt(dm[1], 10), mon = dm[2];
  if (!(mon in MONTHS)) return { error: `Unknown month "${mon}".` };

  const rest = t.slice(i + 1);
  let j = -1;
  for (let k = 0; k < rest.length - 1; k++) if (/^\d{4}$/.test(rest[k]) && /^\d{4}([+-]\d)?$/.test(rest[k + 1])) { j = k; break; }
  if (j < 1) return bad;
  const mid = rest.slice(0, j), tail = rest.slice(j + 2);
  let from, to, extra = [];
  if (/^[A-Z]{6}$/.test(mid[0])) { from = mid[0].slice(0, 3); to = mid[0].slice(3); extra = mid.slice(1); }
  else if (/^[A-Z]{3}$/.test(mid[0]) && /^[A-Z]{3}$/.test(mid[1] || '')) { from = mid[0]; to = mid[1]; extra = mid.slice(2); }
  else return bad;
  const statusTok = extra.find(x => /^[A-Z]{2}\d{0,2}$/.test(x)) || '';
  const pnr = tail.find(x => /^[A-Z0-9]{6}$/.test(x)) || '';

  const dep = rest[j], arrTok = rest[j + 1], hint = (arrTok.match(/([+-]\d)$/) || [])[1];
  const arr = arrTok.slice(0, 4);
  const dh = +dep.slice(0, 2), dmin = +dep.slice(2), ah = +arr.slice(0, 2), amin = +arr.slice(2);
  if (dh > 23 || dmin > 59 || ah > 23 || amin > 59) return { error: 'The times look wrong (use 24-hour, like 0950).' };

  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let year = now.getFullYear();
  let d = new Date(year, MONTHS[mon], day);
  if (d < startToday) d = new Date(++year, MONTHS[mon], day);
  if (d.getMonth() !== MONTHS[mon]) return { error: `${dm[1]}${mon} is not a real date.` };
  const depDate = `${year}-${p2(MONTHS[mon] + 1)}-${p2(day)}`, depTime = `${p2(dh)}:${p2(dmin)}`, arrTime = `${p2(ah)}:${p2(amin)}`;

  const { arrDate, minutes } = arrivalInfo(from, to, depDate, depTime, arrTime, hint != null ? parseInt(hint, 10) : null);

  const code = fm[1];
  return {
    code, flight_no: code + fm[2], airline: AIRLINES[code]?.name || '',
    origin: from, destination: to,
    departure_at: `${depDate}T${depTime}`, arrival_at: `${arrDate}T${arrTime}`,
    minutes, status: statusTok, statusText: STATUS_CODES[statusTok.slice(0, 2)] || '', pnr,
    unknown: [AIRPORTS[from] ? '' : from, AIRPORTS[to] ? '' : to].filter(Boolean),
  };
}

// ----- many lines -> journeys -----
const utcOf = (iso, code, end) => {   // iso 'YYYY-MM-DDTHH:mm'
  const tz = tzOf(code);
  const [d, t] = iso.split('T');
  return tz ? localToUTC(d, t, tz) : Date.parse(iso + ':00Z');
};
export function parseLines(text, now = new Date()) {
  const segs = [], failed = [];
  (text || '').split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const s = parseSegment(line, now);
    if (s.error) failed.push({ line, error: s.error }); else segs.push({ ...s, line });
  });
  segs.sort((a, b) => utcOf(a.departure_at, a.origin) - utcOf(b.departure_at, b.origin));
  return { segs, failed };
}

// A flight that leaves from the airport the previous one landed at (within 48 hours, and not
// going back to where the trip started) is a CONNECTION and joins the same journey.
export function groupJourneys(segs) {
  const journeys = [];
  let origin = '';
  segs.forEach((s, i) => {
    let joins = false;
    if (i > 0) {
      const p = segs[i - 1];
      if (p.destination === s.origin && s.destination !== origin) {
        const lay = (utcOf(s.departure_at, s.origin) - utcOf(p.arrival_at, p.destination)) / 60000;
        joins = lay >= 0 && lay <= 48 * 60;
      }
    }
    if (joins) journeys[journeys.length - 1].push(s); else { journeys.push([s]); origin = s.origin; }
  });
  return journeys;
}

// Is this list of journeys a return trip (A..B then B..A)?
export function isReturn(journeys) {
  if (journeys.length !== 2) return false;
  const [a, b] = journeys;
  return a[0].origin === b[b.length - 1].destination && a[a.length - 1].destination === b[0].origin;
}

// -> the data for one portal flight (legs carry journey 0 = outbound, 1 = return)
export function toFlight(journeys) {
  const legs = [];
  journeys.forEach((j, n) => j.forEach(s => legs.push({ ...s, journey: n })));
  const out = journeys[0];
  const first = legs[0], lastOut = out[out.length - 1];
  const last = legs[legs.length - 1];
  const multi = legs.length > 1;
  return {
    airline: first.airline, flight_no: legs.map(l => l.flight_no).join(journeys.length > 1 ? ' / ' : ' + '),
    origin: first.origin, destination: lastOut.destination,
    departure_at: first.departure_at, arrival_at: (journeys.length > 1 ? lastOut : last).arrival_at,
    pnr: legs.find(l => l.pnr)?.pnr || '',
    price: legs.find(l => l.price)?.price || '', baggage: legs.find(l => l.baggage)?.baggage || '', meal: legs.find(l => l.meal)?.meal || '',
    legs: multi ? legs.map(l => ({ journey: l.journey, flight_no: l.flight_no, airline: l.airline, origin: l.origin, destination: l.destination, departure_at: l.departure_at, arrival_at: l.arrival_at })) : null,
    minutes: legs.map(l => l.minutes),
  };
}

// ----- a table copied from an agent / group-fares website -----
// Date | Sector | Flight | Time | Bag | Meal | Fare   e.g.  "27 - Oct - 2026  ISB-RUH  RX 662  04:45 - 07:35  7 + 40 KG  YES  PKR 90,000"
export function parseAgentTable(txt) {
  const T = String(txt || '').replace(/\u00a0/g, ' ');
  const re = /(\d{1,2})\s*[-\/ ]\s*([A-Za-z]{3})[A-Za-z]*\s*[-\/ ]\s*(\d{4})/g;
  const marks = []; let m;
  while ((m = re.exec(T))) if (m[2].toUpperCase() in MONTHS) marks.push({ i: m.index, end: re.lastIndex, d: +m[1], mo: MONTHS[m[2].toUpperCase()] + 1, y: m[3] });
  const out = [];
  marks.forEach((mk, k) => {
    const chunk = T.slice(mk.end, k + 1 < marks.length ? marks[k + 1].i : T.length).toUpperCase();
    const sec = chunk.match(/\b([A-Z]{3})\s*[-–>→]+\s*([A-Z]{3})\b/);
    const fl = chunk.match(/\b([A-Z][A-Z0-9]|[0-9][A-Z])\s*(\d{2,4})\b/);
    const tm = chunk.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (!sec || !fl || !tm) return;
    const bag = chunk.match(/(\d+(?:\s*\+\s*\d+)?)\s*KG/);
    const meal = chunk.match(/\b(YES|NO)\b/);
    const fare = chunk.match(/(?:PKR|RS\.?)\s*([\d,]+)/);
    const depDate = `${mk.y}-${p2(mk.mo)}-${p2(mk.d)}`, depTime = `${p2(tm[1])}:${tm[2]}`, arrTime = `${p2(tm[3])}:${tm[4]}`;
    const { arrDate, minutes } = arrivalInfo(sec[1], sec[2], depDate, depTime, arrTime, null);
    out.push({
      code: fl[1], flight_no: fl[1] + fl[2], airline: AIRLINES[fl[1]]?.name || '', origin: sec[1], destination: sec[2],
      departure_at: `${depDate}T${depTime}`, arrival_at: `${arrDate}T${arrTime}`, minutes, status: '', statusText: '', pnr: '',
      unknown: [AIRPORTS[sec[1]] ? '' : sec[1], AIRPORTS[sec[2]] ? '' : sec[2]].filter(Boolean),
      baggage: bag ? bag[1].replace(/\s+/g, '') + ' KG' : '', meal: meal ? (meal[1] === 'YES' ? 'YES' : 'NO') : '',
      price: fare ? fare[1].replace(/,/g, '') : '', line: `${fl[1]}${fl[2]} ${depDate} ${sec[1]}${sec[2]}`,
    });
  });
  return out;
}

// ----- the whole paste -> trips -----
// A blank line between lines = a new trip (so a going flight + its return flight are written together).
// mode: 'auto' (connections joined, a going + coming-back pair = return trip) | 'single' (every line alone) | 'return' (pairs must be returns)
export function buildTrips(text, mode = 'auto', now = new Date()) {
  const clean = (text || '').replace(/[`"“”]/g, '');
  const agent = parseAgentTable(clean);
  if (agent.length) return { trips: agent.map(s => ({ journeys: [[s]] })), failed: [], ignored: [], agent: true };
  const blocks = [[]], failed = [], ignored = [];
  clean.split('\n').forEach(raw => {
    const line = raw.trim();
    if (!line) { if (blocks[blocks.length - 1].length) blocks.push([]); return; }
    const s = parseSegment(line, now);
    if (s.error) { (/^[A-Z0-9]{2}\s?\d{1,4}\b/i.test(line) ? failed : ignored).push({ line, error: s.error }); return; }
    blocks[blocks.length - 1].push({ ...s, line });
  });
  const bl = blocks.filter(b => b.length);
  const trips = [];
  const NOT_RET = 'This is not a return trip. Write the going flight first, then the flight(s) coming back (for example ISB-JED, then JED-ISB).';
  if (mode === 'single') bl.flat().forEach(s => trips.push({ journeys: [[s]] }));
  else if (bl.length > 1) {
    bl.forEach(b => {
      const js = groupJourneys(b);
      if (js.length === 1) trips.push({ journeys: js });
      else if (js.length === 2 && isReturn(js)) trips.push({ journeys: js });
      else if (mode === 'return') trips.push({ journeys: js, problem: NOT_RET });
      else js.forEach(j => trips.push({ journeys: [j] }));
    });
  } else if (bl.length === 1) {
    const J = groupJourneys(bl[0]);
    for (let k = 0; k < J.length; k++) {
      const pair = J[k + 1] ? [J[k], J[k + 1]] : null;
      if (pair && isReturn(pair)) { trips.push({ journeys: pair }); k++; }
      else if (mode === 'return') { trips.push({ journeys: [J[k]], problem: NOT_RET }); }
      else trips.push({ journeys: [J[k]] });
    }
  }
  return { trips, failed, ignored, agent: false };
}

// ----- for the booking confirmation: real times of a saved leg (stored "as written" local time) -----
const lp = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const lt = d => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
// { dep, arr } in real UTC milliseconds, or null when an airport time zone is unknown
export function legUTC(l) {
  const tzA = tzOf(l.origin), tzB = tzOf(l.destination);
  if (!tzA || !tzB || !l.departure_at || !l.arrival_at) return null;
  const d = new Date(l.departure_at), a = new Date(l.arrival_at);
  return { dep: localToUTC(lp(d), lt(d), tzA), arr: localToUTC(lp(a), lt(a), tzB) };
}
// "02:50"
export function legDuration(l) {
  const u = legUTC(l);
  if (!u || u.arr <= u.dep) return '';
  const m = Math.round((u.arr - u.dep) / 60000);
  return `${p2(Math.floor(m / 60))}:${p2(m % 60)}`;
}
// layover between two legs: "4h 50m" (empty when unknown)
export function layover(prev, next) {
  const a = legUTC(prev), b = legUTC(next);
  if (!a || !b || b.dep <= a.arr) return '';
  const m = Math.round((b.dep - a.arr) / 60000);
  return `${Math.floor(m / 60)}h ${p2(m % 60)}m`;
}
