import { cityName } from './cities';

// flight_legs rows -> { flightId: [legs in order] }
export function legsMap(rows) {
  const m = {};
  (rows || []).forEach(l => { (m[l.flight_id] = m[l.flight_id] || []).push(l); });
  Object.values(m).forEach(a => a.sort((x, y) => x.journey - y.journey || x.seq - y.seq));
  return m;
}
// airport codes in order: ISB, SHJ, DMM  (a return trip gives ISB, JED, ISB)
export function pathCodes(f, legs) {
  const codes = legs && legs.length ? [legs[0].origin, ...legs.map(l => l.destination)] : [f.origin, f.destination];
  return codes.filter((c, i) => i === 0 || c !== codes[i - 1]);
}
export const isReturnTrip = legs => !!legs && legs.some(l => l.journey === 1);
export const sectorText = (f, legs) => pathCodes(f, legs).map(cityName).join(' – ');

// "ISB DMM" / "PEW SHJ DMM" / "ISB JED ISB" (airport codes only, for tables)
export const codesText = (f, legs) => pathCodes(f, legs).join(' ');
