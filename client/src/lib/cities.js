// Airport code -> city name, for headers like "Islamabad – Dammam".
// Unknown codes are shown as written. Add more lines any time.
const C = {
  ISB: 'Islamabad', KHI: 'Karachi', LHE: 'Lahore', PEW: 'Peshawar', MUX: 'Multan', SKT: 'Sialkot', LYP: 'Faisalabad',
  UET: 'Quetta', RYK: 'Rahim Yar Khan', GIL: 'Gilgit', SKZ: 'Sukkur', TUK: 'Turbat', GWD: 'Gwadar',
  JED: 'Jeddah', MED: 'Madinah', RUH: 'Riyadh', DMM: 'Dammam', TIF: 'Taif', YNB: 'Yanbu', AHB: 'Abha', ELQ: 'Qassim', TUU: 'Tabuk',
  MCT: 'Muscat', SLL: 'Salalah', DXB: 'Dubai', SHJ: 'Sharjah', AUH: 'Abu Dhabi', DWC: 'Dubai South', RKT: 'Ras Al Khaimah',
  DOH: 'Doha', KWI: 'Kuwait', BAH: 'Bahrain', AMM: 'Amman', IST: 'Istanbul', CAI: 'Cairo', BKK: 'Bangkok', KUL: 'Kuala Lumpur',
  SIN: 'Singapore', LHR: 'London', MAN: 'Manchester', BHX: 'Birmingham', JFK: 'New York', YYZ: 'Toronto', DEL: 'Delhi',
  BOM: 'Mumbai', DAC: 'Dhaka', CMB: 'Colombo', KBL: 'Kabul', TAS: 'Tashkent', BGW: 'Baghdad', NJF: 'Najaf', DAM: 'Damascus',
};
export const cityName = code => {
  const c = String(code || '').trim().toUpperCase();
  return C[c] || c;
};
// "ISB" + "DMM" -> "Islamabad – Dammam"
export const sector = (o, d) => `${cityName(o)} – ${cityName(d)}`;
