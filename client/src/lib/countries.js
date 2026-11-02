// Country list for the Nationality dropdown (names come from the browser, so spelling is standard).
const CODES = ('AF AX AL DZ AS AD AO AI AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UY UZ VU VE VN VG VI WF EH YE ZM ZW').split(' ');

const FIRST = 'Pakistan';   // shown first because most passengers are Pakistani

let cache = null;
export function countryNames() {
  if (cache) return cache;
  let names;
  try {
    const dn = new Intl.DisplayNames(['en'], { type: 'region' });
    names = CODES.map(c => dn.of(c)).filter(Boolean);
  } catch { names = [FIRST]; }
  names = [...new Set(names)].sort((a, b) => a.localeCompare(b));
  cache = [FIRST, ...names.filter(n => n !== FIRST)];
  return cache;
}

const DEMONYMS = {
  PAKISTANI: 'Pakistan', INDIAN: 'India', BANGLADESHI: 'Bangladesh', AFGHAN: 'Afghanistan', SAUDI: 'Saudi Arabia',
  EMIRATI: 'United Arab Emirates', BRITISH: 'United Kingdom', AMERICAN: 'United States', CANADIAN: 'Canada',
  AUSTRALIAN: 'Australia', TURKISH: 'Türkiye', EGYPTIAN: 'Egypt', IRANIAN: 'Iran', IRAQI: 'Iraq', OMANI: 'Oman',
  KUWAITI: 'Kuwait', QATARI: 'Qatar', BAHRAINI: 'Bahrain', MALAYSIAN: 'Malaysia', INDONESIAN: 'Indonesia',
  'SRI LANKAN': 'Sri Lanka', NEPALI: 'Nepal', CHINESE: 'China', UK: 'United Kingdom', USA: 'United States', UAE: 'United Arab Emirates',
};

// Turns pasted text ("PAKISTANI", "pakistan") into a dropdown value, or '' if not found.
export function matchCountry(text) {
  const t = (text || '').trim().toUpperCase();
  if (!t) return '';
  const hit = countryNames().find(n => n.toUpperCase() === t);
  return hit || DEMONYMS[t] || '';
}
