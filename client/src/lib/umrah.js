// Small helpers shared by the Umrah pages.
export const KINDS = ['sharing', 'double', 'triple', 'quad', 'quint'];
export const KIND_LABEL = { sharing: 'Sharing', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
// how many persons pay for one unit of each price (sharing is priced per person)
export const PERSONS = { sharing: 1, double: 2, triple: 3, quad: 4, quint: 5 };

export const stars = n => (n ? '★'.repeat(n) : '');
export const num = v => Number(v || 0).toLocaleString('en-US');
// date-only text (YYYY-MM-DD) -> 05 Nov 2026
export const fmtD = s => (s ? new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');
export const priceUnit = t => (t === 'per_person' ? 'per person per night' : 'per room per night');
export const roomText = rt => KIND_LABEL[rt.kind] + (rt.kind === 'sharing' ? ` (${rt.capacity} per room)` : ` (${rt.capacity} persons)`);
export const sortRooms = list => [...(list || [])].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
