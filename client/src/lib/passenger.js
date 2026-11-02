// Helpers for passenger details: titles, types, dates, age and passport checks.
export const TITLES = [['MR', 'Mr'], ['MRS', 'Mrs'], ['MS', 'Ms'], ['MISS', 'Miss'], ['MSTR', 'Mstr (boy)']];
export const TYPES = [['adult', 'Adult (12+ years)'], ['child', 'Child (2-11 years)'], ['infant', 'Infant (under 2)']];
export const TYPE_LABEL = { adult: 'Adult', child: 'Child', infant: 'Infant' };

const p2 = n => String(n).padStart(2, '0');
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

function iso(y, m, d) {
  const x = new Date(y, m - 1, d);
  if (x.getFullYear() !== y || x.getMonth() !== m - 1 || x.getDate() !== d) return '';
  return `${y}-${p2(m)}-${p2(d)}`;
}

// "1990-05-21", "21/05/1990", "21-05-1990", "21MAY1990", "21 May 1990" -> "1990-05-21" (or '')
export function toISODate(s) {
  s = (s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[ -]?([A-Za-z]{3})[A-Za-z]*[ -]?(\d{4})$/);
  if (m && MON[m[2].toUpperCase()]) return iso(+m[3], MON[m[2].toUpperCase()], +m[1]);
  return '';
}

export function ageOn(dobIso, on) {
  const d = new Date(dobIso), t = new Date(on);
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a--;
  return a;
}

// Does the passenger type match the age on the day of the flight? '' = fine
export function typeProblem(type, dobIso, departure) {
  if (!dobIso || !departure || isNaN(new Date(dobIso))) return '';
  const a = ageOn(dobIso, departure);
  if (type === 'infant' && a >= 2) return `is ${a} years old on the flight date, so cannot travel as an infant`;
  if (type === 'child' && (a < 2 || a >= 12)) return `is ${a} years old on the flight date, which does not match "Child" (2-11 years)`;
  if (type === 'adult' && a < 12) return `is ${a} years old on the flight date, which does not match "Adult" (12+ years)`;
  return '';
}

// Most countries and airlines need the passport valid for 6 months after the travel date.
export function passportShort(expiryIso, departure) {
  if (!expiryIso || !departure) return false;
  const lim = new Date(departure);
  lim.setMonth(lim.getMonth() + 6);
  return new Date(expiryIso) < lim;
}

export const blankPassenger = () => ({ title: '', first_name: '', last_name: '', pax_type: 'adult', dob: '', passport_number: '', passport_expiry: '', nationality: '' });
