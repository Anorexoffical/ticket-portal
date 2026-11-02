import { AIRPORTS } from './airports';
import { isReturnTrip } from './legs';

// Which filter chip a flight belongs to: "UAE One Way", "KSA One Way", ... or "Umrah" (return trips).
const NAMES = { AE: 'UAE', SA: 'KSA', OM: 'Oman', BH: 'Bahrain', QA: 'Qatar', GB: 'UK', KW: 'Kuwait', PK: 'Pakistan (domestic)', TR: 'Turkey', MY: 'Malaysia', TH: 'Thailand', AZ: 'Azerbaijan' };
const ORDER = ['AE', 'SA', 'OM', 'BH', 'UMRAH', 'QA', 'GB'];   // the order of your chips; others come after

export function categoryOf(f, legs) {
  if (isReturnTrip(legs)) return { key: 'UMRAH', label: 'Umrah' };
  const cc = AIRPORTS[f.destination]?.[1] || 'XX';
  return { key: cc, label: `${NAMES[cc] || (cc === 'XX' ? 'Other' : cc)} One Way` };
}
export const sortCats = cats =>
  [...cats].sort((a, b) => {
    const ia = ORDER.indexOf(a.key), ib = ORDER.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label);
  });
