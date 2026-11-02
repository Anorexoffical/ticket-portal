import { CURRENCY } from './config';

export const money = n => `${CURRENCY} ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export const dt = d => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
export const dOnly = d => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

// <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm" in local time
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const p = n => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`;
}

// time left until a hold ends, e.g. "2h 15m" or "Expired"
export function timeLeft(iso) {
  const ms = new Date(iso) - Date.now();
  if (!(ms > 0)) return 'Expired';
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d ? `${d}d ${h}h` : h ? `${h}h ${mm}m` : `${mm}m`;
}

// A booking still "on_hold" in the database but past its time is really expired.
export const effectiveStatus = b =>
  b.status === 'on_hold' && b.hold_expires_at && !Number(b.paid_amount) && new Date(b.hold_expires_at) <= Date.now() ? 'expired' : b.status;

export const digits = s => (s || '').replace(/\D/g, '');

// Number for a WhatsApp link (wa.me needs the country code, no 0 at the start).
// "0315 9293161" -> "923159293161". Change CC if your agents are in another country.
const CC = '92';
export function waNumber(s) {
  let d = digits(s);
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = CC + d.slice(1);
  return d;
}

// "09:50" and "Sat, 07 Nov 2026"
export const tm = d => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-');
export const wd = d => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '-');

// "07 Nov 2026" (no day name)
export const dShort = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

// hold time helpers: stored in minutes
export const holdText = m => { m = Number(m) || 0; return m % 60 === 0 && m >= 60 ? `${m / 60} hour${m === 60 ? '' : 's'}` : m < 60 ? `${m} minutes` : `${Math.floor(m / 60)}h ${m % 60}m`; };
export const holdToMinutes = (v, unit) => Math.round(Number(v) * (unit === 'hr' ? 60 : 1));
export const holdSplit = m => (m % 60 === 0 ? { hold_value: String(m / 60), hold_unit: 'hr' } : { hold_value: String(m), hold_unit: 'min' });
