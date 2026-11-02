// One place that knows airlines. Same airline = same name + same logo + same table,
// even if the flight was typed as "SV", "Saudi", "SAUDIA" or with an odd flight number.
// To add an airline: add a line below (code, official name, other spellings).
const LIST = [
  ['SV', 'Saudia', ['saudi', 'saudi airlines', 'saudi arabian airlines']],
  ['PK', 'PIA', ['pakistan international airlines', 'pakistan international']],
  ['OV', 'SalamAir', ['salam air', 'salam']],
  ['F3', 'flyadeal', ['fly adeal']],
  ['XY', 'flynas', ['fly nas']],
  ['EK', 'Emirates', []],
  ['QR', 'Qatar Airways', ['qatar']],
  ['EY', 'Etihad', ['etihad airways']],
  ['TK', 'Turkish Airlines', ['turkish']],
  ['GF', 'Gulf Air', []],
  ['WY', 'Oman Air', []],
  ['KU', 'Kuwait Airways', ['kuwait']],
  ['FZ', 'flydubai', ['fly dubai']],
  ['G9', 'Air Arabia', []],
  ['PA', 'Airblue', ['air blue']],
  ['ER', 'SereneAir', ['serene air', 'serene']],
  ['9P', 'Fly Jinnah', ['jinnah']],
  ['AI', 'Air India', []],
  ['BA', 'British Airways', []],
  ['MH', 'Malaysia Airlines', ['malaysian airlines']],
  ['SQ', 'Singapore Airlines', []],
  ['TG', 'Thai Airways', ['thai']],
  ['UL', 'SriLankan Airlines', ['srilankan']],
  ['RJ', 'Royal Jordanian', []],
  ['MS', 'EgyptAir', ['egypt air']],
  ['CX', 'Cathay Pacific', []],
  ['WB', 'RwandAir', []],
  ['J2', 'Azerbaijan Airlines', ['azal']],
  ['PF', "Air Sial", []],
  ['3L', "Air Arabia Abu Dhabi", []],
  ['J9', "Jazeera Airways", []],
  ['PC', "Pegasus Airlines", []],
  ['KC', "Air Astana", []],
  ['HY', "Uzbekistan Airways", []],
  ['CZ', "China Southern Airlines", []],
  ['MU', "China Eastern Airlines", []],
  ['CA', "Air China", []],
  ['HU', "Hainan Airlines", []],
  ['3U', "Sichuan Airlines", []],
  ['KE', "Korean Air", []],
  ['OZ', "Asiana Airlines", []],
  ['NH', "All Nippon Airways", []],
  ['JL', "Japan Airlines", []],
  ['AK', "AirAsia", []],
  ['D7', "AirAsia X", []],
  ['TR', "Scoot", []],
  ['GA', "Garuda Indonesia", []],
  ['PR', "Philippine Airlines", []],
  ['VN', "Vietnam Airlines", []],
  ['6E', "IndiGo", []],
  ['IX', "Air India Express", []],
  ['SG', "SpiceJet", []],
  ['BG', "Biman Bangladesh Airlines", []],
  ['BS', "US-Bangla Airlines", []],
  ['ME', "Middle East Airlines", []],
  ['IA', "Iraqi Airways", []],
  ['IR', "Iran Air", []],
  ['W5', "Mahan Air", []],
  ['ET', "Ethiopian Airlines", []],
  ['KQ', "Kenya Airways", []],
  ['SA', "South African Airways", []],
  ['AT', "Royal Air Maroc", []],
  ['AH', "Air Algerie", []],
  ['TU', "Tunisair", []],
  ['MK', "Air Mauritius", []],
  ['VS', "Virgin Atlantic", []],
  ['LH', "Lufthansa", []],
  ['AF', "Air France", []],
  ['KL', "KLM Royal Dutch Airlines", []],
  ['LX', "SWISS", []],
  ['OS', "Austrian Airlines", []],
  ['SN', "Brussels Airlines", []],
  ['AZ', "ITA Airways", []],
  ['IB', "Iberia", []],
  ['TP', "TAP Air Portugal", []],
  ['SK', "SAS Scandinavian Airlines", []],
  ['AY', "Finnair", []],
  ['EI', "Aer Lingus", []],
  ['LO', "LOT Polish Airlines", []],
  ['A3', "Aegean Airlines", []],
  ['SU', "Aeroflot", []],
  ['FR', "Ryanair", []],
  ['U2', "easyJet", []],
  ['W6', "Wizz Air", []],
  ['EW', "Eurowings", []],
  ['AA', "American Airlines", []],
  ['DL', "Delta Air Lines", []],
  ['UA', "United Airlines", []],
  ['AC', "Air Canada", []],
  ['QF', "Qantas", []],
  ['NZ', "Air New Zealand", []],
];

export const AIRLINES = Object.fromEntries(LIST.map(([c, n]) => [c, { name: n }]));
const NAME_TO_CODE = {};
LIST.forEach(([c, n, aliases]) => [c, n, ...aliases].forEach(x => { NAME_TO_CODE[x.toLowerCase()] = c; }));

// An airline code has 2 characters and at least one letter (SV, G9, 9P). "79" is not a code.
const validCode = c => /^[A-Z0-9]{2}$/.test(c) && /[A-Z]/.test(c);

// -> { code, name }  (name is the official one when we know the airline)
export function airlineInfo(flightNo, airlineName) {
  const fn = (flightNo || '').trim().toUpperCase();
  const nm = (airlineName || '').trim();
  let code = '';
  if (validCode(fn.slice(0, 2)) && /^\d/.test(fn.slice(2))) code = fn.slice(0, 2);        // SV725
  if (!code || !AIRLINES[code]) code = NAME_TO_CODE[nm.toLowerCase()] || code;             // "Saudi", "SV"
  const known = AIRLINES[code];
  return { code, name: known ? known.name : nm || code };
}

// Groups flights by airline + route, like: [logo] Saudia  ISB-MED  -> rows of dates
import { pathCodes } from './legs';

export function groupFlights(flights, legs = {}) {
  const map = new Map();
  for (const f of flights) {
    const { code, name } = airlineInfo(f.flight_no, f.airline);
    const path = pathCodes(f, legs[f.id]);
    const key = `${code || name.toLowerCase()}|${path.join('-')}`;
    if (!map.has(key)) map.set(key, { key, code, name, flightNo: f.flight_no, origin: f.origin, destination: f.destination, path, items: [] });
    map.get(key).items.push(f);
  }
  const groups = [...map.values()];
  groups.forEach(g => g.items.sort((a, b) => new Date(a.departure_at) - new Date(b.departure_at)));
  groups.sort((a, b) => a.name.localeCompare(b.name) || a.origin.localeCompare(b.origin) || a.destination.localeCompare(b.destination));
  return groups;
}
