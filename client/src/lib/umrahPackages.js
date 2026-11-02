// Package price helpers shared by the admin and agent Umrah pages. All amounts are PKR.
export const TYPES = ['sharing', 'double', 'triple', 'quad', 'quint'];   // adult price per person for each room type
export const TYPE_LABEL = { sharing: 'Sharing', double: 'Double', triple: 'Triple', quad: 'Quad', quint: 'Quint' };
export const PERSONS = { sharing: 1, double: 2, triple: 3, quad: 4, quint: 5 };   // hotel rate: sharing per person, the rest per room

// price after the agent's normal discount. A SALE package (old price shown) never gets the agent discount.
export function agentUnit(price, pkg, disc) {
  const p = Number(price) || 0;
  const allowed = !(Number(pkg.old_extra) > 0) && pkg.allow_agent_discount;
  return p - (allowed ? Math.min(p, Number(disc) || 0) : 0);
}

// totals for one booking request. markup = the agent's own profit per paying person (adults and children, not infants)
export function totals(pkg, disc, markup, q) {
  const a = agentUnit(pkg['p_' + q.type], pkg, disc);
  const cb = agentUnit(pkg.p_child_bed, pkg, disc);
  const cn = agentUnit(pkg.p_child_nobed, pkg, disc);
  const inf = Number(pkg.p_infant) || 0;
  const mine = q.adults * a + q.cb * cb + q.cn * cn + q.inf * inf;       // what the agent pays you
  const paying = q.adults + q.cb + q.cn;
  const profit = paying * (Number(markup) || 0);
  return { mine, profit, client: mine + profit };
}

export const hasType = (pkg, t) => pkg['p_' + t] != null;
export const typesOf = pkg => TYPES.filter(t => hasType(pkg, t));
