'use client';
import AirlineLogo from './AirlineLogo';
import { airlineInfo } from '../lib/airlines';
import { codesText } from '../lib/legs';
import { dt, dShort, tm, money, timeLeft } from '../lib/format';

const TYPES = [['adult', 'ADT'], ['child', 'CHD'], ['infant', 'INF']];

export default function BookingCard({ b, st, legs, admin, actions, children }) {
  const f = b.flights || {};
  const { name } = airlineInfo(f.flight_no, f.airline);
  const pax = b.passengers || [];
  const count = t => pax.filter(p => (p.pax_type || 'adult') === t).length;
  const lead = pax[0];
  const bal = Number(b.total_amount) - Number(b.paid_amount);
  const done = st === 'confirmed' || st === 'issued';
  const dead = st === 'cancelled' || st === 'expired';
  const path = codesText({ origin: f.origin, destination: f.destination }, legs).replaceAll(' ', ' › ');
  const paxSummary = TYPES.map(([t, l]) => count(t) ? `${count(t)}${l}` : null).filter(Boolean).join(' · ');
  return (
    <div className={'bk' + (dead ? ' dead' : '')}>
      <div className="bkhead">
        <span className="bk-bookno">#{b.booking_no || '-'}</span>
        {admin && <span className="bktag">{b.profiles?.agent_no || '-'}</span>}
        {admin && <span className="bkagency">{b.profiles?.agency_name}</span>}
        <span className={'badge ' + st}>{st.replace('_', ' ')}</span>
        {b.pnr && <span className="bk-pnr">{b.pnr}</span>}
        <span className="bk-ref">{b.ref}</span>
        <span className="muted small" style={{ marginLeft: 'auto' }}>{dt(b.created_at)}</span>
      </div>
      <div className="bkbody">
        <div className="bkflight">
          <AirlineLogo flightNo={f.flight_no} airline={f.airline} size={38} />
          <div>
            <b>{name || f.airline}</b>
            <div className="small muted">{f.flight_no}</div>
          </div>
        </div>
        <div className="bkroute">
          <div className="bkpath">{path}</div>
          <div className="small muted">{dShort(f.departure_at)} · {tm(f.departure_at)}</div>
          {st === 'on_hold' && !Number(b.paid_amount) && <div className="small bkhold">Hold: <b>{timeLeft(b.hold_expires_at)}</b></div>}
          {st === 'on_hold' && Number(b.paid_amount) > 0 && <div className="small" style={{ color: '#0d6b38' }}>Paid — hold off</div>}
        </div>
        <div className="bkpax">
          {lead && <div className="bklead">{[lead.title, lead.first_name, lead.last_name].filter(Boolean).join(' ').toUpperCase()}{pax.length > 1 ? ` +${pax.length - 1}` : ''}</div>}
          <div className="small muted" style={{ marginTop: 2 }}>{paxSummary}</div>
          {admin && done && b.confirmer?.agency_name && <div className="small muted" style={{ marginTop: 4 }}>By: <b>{b.confirmer.agency_name}</b></div>}
          {b.edit_unlocked && <div className="small" style={{ color: '#8a5a00', marginTop: 2 }}>edit unlocked</div>}
        </div>
        <div className="bkmoney">
          <div className="bkt">Total <b>{money(b.total_amount)}</b></div>
          <div className="bkp">Paid <b>{money(b.paid_amount)}</b></div>
          <div className={'bkb' + (bal > 0 && !dead ? ' due' : '')}>Bal <b>{money(bal)}</b></div>
        </div>
      </div>
      <div className="bkfoot">{actions}</div>
      {children}
    </div>
  );
}
