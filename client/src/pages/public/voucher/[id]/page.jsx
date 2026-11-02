import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/db';
import { useProfile } from '@/lib/useProfile';
import { dOnly, dt, effectiveStatus } from '@/lib/format';
import { TYPE_LABEL } from '@/lib/passenger';
import AirlineLogo from '@/components/AirlineLogo';
import Ico from '@/components/Icons';
import { cityName } from '@/lib/cities';
import { legDuration, layover } from '@/lib/itinerary';

const tm = d => (d ? new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-');

// Printable booking confirmation: click "Print / Save as PDF", then choose "Save as PDF".
// Visible only to the agent who owns the booking and to the admin (database rules).
// The agency name at the top is the agent's own agency name.
export default function Voucher() {
  const { id } = useParams();
  const { loading } = useProfile();
  const [b, setB] = useState(null);
  const [error, setError] = useState('');
  const [legs, setLegs] = useState([]);
  const [styleSel, setStyleSel] = useState('');

  useEffect(() => {
    if (loading) return;
    supabase.from('bookings')
      .select('*, flights(*), profiles:agent_id(agency_name,phone,owner_name,address,license_no,voucher_style), passengers(*)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error) { setError('Booking not found.'); return; }
        setB(data);
        supabase.from('flight_legs').select('*').eq('flight_id', data.flight_id).order('journey').order('seq').then(r => { if (r.data) setLegs(r.data); });
      });
  }, [loading, id]);

  if (loading || (!b && !error)) return <div className="wrap"><p className="muted">Loading...</p></div>;
  if (error) return <div className="wrap"><div className="error">{error}</div></div>;

  const st = effectiveStatus(b);
  const vstyle = styleSel || b.profiles?.voucher_style || 'detailed';
  if (!['on_hold', 'confirmed', 'issued'].includes(st)) {
    return <div className="wrap"><div className="info">This booking is {st}. A confirmation is not available.</div></div>;
  }
  const f0 = b.flights;
  const isRet = legs.some(l => l.journey === 1);
  const cards = legs.length
    ? legs.map((l, i) => ({ f: { ...f0, ...l, airline: l.airline || f0.airline }, key: l.id, tag: isRet ? (l.journey === 1 ? 'RETURN' : 'GOING') : legs.length > 1 ? `FLIGHT ${i + 1} OF ${legs.length}` : '' }))
    : [{ f: f0, key: 'one', tag: '' }];
  const BANNER = {
    on_hold: { bg: '#fff3d6', fg: '#8a5a00', title: 'ON HOLD - NOT CONFIRMED' },
    confirmed: { bg: '#dcf5e7', fg: '#0d6b38', title: 'CONFIRMED' },
    issued: { bg: '#d9e8ff', fg: '#0f3f94', title: 'TICKET ISSUED' },
  }[st];

  const box = { border: '1px solid #dbe3f0', borderRadius: 12, padding: '12px 16px' };
  const lbl = { fontSize: 11, color: '#5b6776', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 };

  return (
    <div className="wrap" style={{ maxWidth: 820 }}>
      <div className="actions noprint" style={{ marginBottom: 12 }}>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="ghost" onClick={() => window.history.back()}>← Back</button>
      </div>

      <div className="actions noprint" style={{ marginBottom: 12, alignItems: 'center' }}>
        <span className="muted small">Style:</span>
        <button className={vstyle === 'detailed' ? '' : 'ghost'} onClick={() => setStyleSel('detailed')}>Detailed</button>
        <button className={vstyle === 'compact' ? '' : 'ghost'} onClick={() => setStyleSel('compact')}>Compact</button>
      </div>
      {vstyle === 'compact'
        ? <Compact b={b} cards={cards} BANNER={BANNER} box={box} lbl={lbl} />
        : <Detailed b={b} legs={legs} cards={cards} st={st} BANNER={BANNER} />}
    </div>
  );
}

function Compact({ b, cards, BANNER, box, lbl }) {
  return (
    <>
      <style>{`
        .vch { background:#fff; border:1px solid #dbe3f0; border-radius:16px; overflow:hidden; color:#0f1b2d; }
        .vch-top { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; padding:20px 28px; border-bottom:4px solid #1559d6; }
        .vch-leg { display:grid; grid-template-columns: 190px 1fr 40px 1fr 150px; gap:12px; align-items:center; padding:14px 16px; border:1px solid #e5eaf2; border-radius:12px; margin-bottom:10px; break-inside:avoid; }
        .vch-code { font-size:26px; font-weight:800; line-height:1; }
        .vch-city { font-size:12px; color:#64748b; text-transform:uppercase; letter-spacing:.04em; margin-top:2px; }
        .vch-tm { font-weight:700; margin-top:4px; }
        .vch-sum { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px,1fr)); gap:10px; margin-bottom:20px; }
        .vch-bot { display:grid; grid-template-columns: 1fr 200px; gap:20px; align-items:center; margin-top:18px; break-inside:avoid; }
        .vch-h { font-size:11px; font-weight:800; color:#64748b; text-transform:uppercase; letter-spacing:.08em; margin:18px 0 8px; }
        @media (max-width: 700px) { .vch-leg { grid-template-columns: 1fr 1fr; } .vch-bot { grid-template-columns: 1fr; } }
        @media print { @page { size: A4; margin: 10mm; } body { background:#fff !important; } .wrap { padding:0 !important; max-width:none !important; } .vch { border:0; border-radius:0; } .vch-top { padding:8px 10px; } .vch-body { padding:12px 6px !important; } .vch-leg { padding:8px 12px; margin-bottom:6px; } .vch-code { font-size:21px; } .vch-sum { margin-bottom:10px; } .vch-h { margin:10px 0 5px; } th, td { padding:5px 8px !important; } .vch-bot { margin-top:10px; } }
      `}</style>
      <div className="vch voucher">
        <div className="vch-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <AgentLogo id={b.agent_id} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{b.profiles?.agency_name}</div>
              <div style={{ color: '#64748b', fontSize: 13, letterSpacing: '.08em', fontWeight: 700 }}>BOOKING CONFIRMATION</div>
            </div>
          </div>
          <span style={{ background: BANNER.bg, color: BANNER.fg, padding: '8px 18px', borderRadius: 99, fontWeight: 800, letterSpacing: '.04em', fontSize: 14 }}>{BANNER.title}</span>
        </div>

        <div className="vch-body" style={{ padding: 28 }}>
          <div className="vch-sum">
            <div style={{ ...box, borderStyle: 'dashed', borderWidth: 2, borderColor: '#1559d6' }}>
              <div style={lbl}>Airline PNR</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, fontFamily: 'ui-monospace, Consolas, monospace' }}>{b.pnr || 'PENDING'}</div>
            </div>
            <div style={box}><div style={lbl}>Booking ref</div><div style={{ fontSize: 15, fontWeight: 800, marginTop: 4 }}>{b.ref}</div></div>
            <div style={box}><div style={lbl}>Passengers</div><div style={{ fontSize: 22, fontWeight: 800 }}>{b.passengers.length}</div></div>
            <div style={box}><div style={lbl}>Booked on</div><div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{dOnly(b.created_at)}</div></div>
          </div>

          <div className="vch-h" style={{ marginTop: 0 }}>Flight details</div>
          {cards.map(({ f, key, tag }) => (
            <div key={key} className="vch-leg">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AirlineLogo flightNo={f.flight_no} airline={f.airline} size={38} />
                <div><div style={{ fontWeight: 800 }}>{f.airline}</div><div className="muted small">{f.flight_no}{tag ? ` · ${tag}` : ''}</div></div>
              </div>
              <div>
                <div className="vch-code">{f.origin}</div>
                <div className="vch-city">{cityName(f.origin)}</div>
                <div className="vch-tm">{tm(f.departure_at)} <span className="muted small" style={{ fontWeight: 500 }}>{dOnly(f.departure_at)}</span></div>
              </div>
              <div style={{ textAlign: 'center', color: '#0369a1' }}><Ico name="plane" size={20} style={{ transform: 'rotate(45deg)' }} /></div>
              <div>
                <div className="vch-code">{f.destination}</div>
                <div className="vch-city">{cityName(f.destination)}</div>
                <div className="vch-tm">{f.arrival_at ? tm(f.arrival_at) : '-'} <span className="muted small" style={{ fontWeight: 500 }}>{f.arrival_at ? dOnly(f.arrival_at) : ''}</span></div>
              </div>
              <div className="small" style={{ lineHeight: 1.7 }}><Ico name="bag" /> {f.baggage || '-'}<br /><Ico name="meal" /> {f.meal || '-'}</div>
            </div>
          ))}

          <div className="vch-h">Passengers</div>
          <table>
            <thead><tr><th>#</th><th>Name</th><th>Type</th><th>Date of birth</th><th>Passport no.</th><th>Nationality</th></tr></thead>
            <tbody>
              {b.passengers.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td><b>{p.title ? p.title + ' ' : ''}{p.first_name} {p.last_name}</b></td>
                  <td>{TYPE_LABEL[p.pax_type] || 'Adult'}</td>
                  <td>{dOnly(p.dob)}</td><td>{p.passport_number}</td><td>{p.nationality}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="vch-bot">
            <div>
              <div className="vch-h" style={{ marginTop: 0 }}>Terms &amp; conditions</div>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, lineHeight: 1.7 }}>
                <li>Passenger should report at check-in counter at least 04:00 hours prior to flight.</li>
                <li>Tickets are non-refundable and non-changeable any time.</li>
              </ol>
              <p style={{ fontSize: 12, color: '#64748b', margin: '10px 0 0' }}>This is a booking confirmation, not the airline e-ticket. Names must match the passports exactly.</p>
            </div>
            <Stamp />
          </div>
        </div>
      </div>
    </>
  );
}

// "Detailed" style: teal info box, orange flight banners, duration / stops / layover (same look as your itinerary builder)
function Detailed({ b, legs, cards, st, BANNER }) {
  const p = b.profiles || {};
  const okTxt = st === 'on_hold' ? 'ON HOLD - NOT CONFIRMED' : 'RESERVATION CONFIRMED';
  // only what the agent filled in (Settings) is shown
  const info = [
    ['Airline PNR', b.pnr || 'PENDING'],
    ['Booking ref', b.ref],
    ['Issued by', p.agency_name],
    ['Contact person', p.owner_name],
    ['Phone', p.phone],
    ['Address', p.address],
    ['Licence / NTN', p.license_no],
  ].filter(([, v]) => v && String(v).trim());
  return (
    <>
      <style>{`
        .dv { background:#fbf9f5; border:1px solid #e4dfd2; border-radius:10px; padding:24px 34px 22px; color:#1b2430; }
        .dv-info { background:linear-gradient(155deg,#1e7a96,#155a70); color:#fff; border-radius:8px; padding:14px 22px; margin-bottom:16px; display:grid; grid-template-columns:1fr; gap:4px; font-size:13.5px; }
        .dv-info div { display:grid; grid-template-columns:200px 1fr; gap:8px; } .dv-info span { color:#cfe9ef;  } .dv-info b { word-break:break-word; } .dv-info b { letter-spacing:.01em; }
        .dv-ban { background:linear-gradient(120deg,#f5a623,#e28e0c); color:#fff; font-weight:700; font-size:13px; padding:7px 14px; border-radius:6px 6px 0 0; display:flex; justify-content:space-between; gap:10px; align-items:center; }
        .dv-ban i { background:#fff; color:#2f6b3f; font-style:normal; font-size:9px; letter-spacing:.04em; padding:2px 8px; border-radius:10px; white-space:nowrap; }
        .dv-card { border:1px solid #e4dfd2; border-top:0; border-radius:0 0 6px 6px; padding:9px 16px; display:grid; grid-template-columns:1.3fr 1fr 1.4fr 24px 1.4fr 1fr; gap:8px; align-items:center; background:#fff; break-inside:avoid; }
        .dv-l { font-size:9.5px; letter-spacing:.06em; color:#8a8272; font-weight:700; text-transform:uppercase; margin-bottom:1px; }
        .dv-v { font-size:13px; font-weight:700; } .dv-t { font:700 16px ui-monospace,Consolas,monospace; color:#1a6e8c; } .dv-s { font-size:11px; color:#5a5347; line-height:1.35; }
        .dv-tr { margin:8px 0; padding:5px 12px; background:#fff6e5; border:1px dashed #e8c27a; border-radius:5px; font-size:11px; color:#7a5a12; text-align:center; }
        .dv-h { font-size:11px; font-weight:800; color:#8a8272; text-transform:uppercase; letter-spacing:.08em; margin:16px 0 6px; }
        .dv-px { width:100%; border-collapse:collapse; font-size:13px; } .dv-px th { background:#1e7a96; color:#fff; text-align:left; padding:7px 10px; font-size:11px; letter-spacing:.05em; } .dv-px td { padding:7px 10px; border-bottom:1px solid #e4dfd2; background:#fff; }
        .dv-bot { display:grid; grid-template-columns:1fr 190px; gap:18px; align-items:center; margin-top:14px; break-inside:avoid; }
        .dv-tc { font-size:12px; line-height:1.6; text-transform:uppercase; } .dv-tc h4 { margin:0 0 4px; color:#1a6e8c; font-size:12px; letter-spacing:.06em; }
        .dv.roomy { padding:30px 40px 28px; } .dv.roomy .dv-info { padding:20px 26px; font-size:14.5px; gap:8px; margin-bottom:24px; } .dv.roomy .dv-ban { padding:10px 18px; font-size:14.5px; } .dv.roomy .dv-card { padding:20px 20px; gap:12px; } .dv.roomy .dv-t { font-size:20px; } .dv.roomy .dv-v { font-size:14.5px; } .dv.roomy .dv-s { font-size:12.5px; } .dv.roomy .dv-tr { margin:14px 0; padding:8px 14px; font-size:12.5px; } .dv.roomy .dv-h { margin:28px 0 10px; } .dv.roomy .dv-px th, .dv.roomy .dv-px td { padding:11px 12px; } .dv.roomy .dv-bot { margin-top:30px; }
        .dv.cozy { padding:26px 36px 24px; } .dv.cozy .dv-info { padding:16px 24px; font-size:14px; gap:6px; margin-bottom:18px; } .dv.cozy .dv-ban { padding:8px 16px; } .dv.cozy .dv-card { padding:14px 18px; } .dv.cozy .dv-t { font-size:18px; } .dv.cozy .dv-tr { margin:10px 0; } .dv.cozy .dv-h { margin:20px 0 8px; } .dv.cozy .dv-px th, .dv.cozy .dv-px td { padding:8px 12px; } .dv.cozy .dv-bot { margin-top:20px; }
        .dv.mid .dv-info { padding:12px 20px; gap:4px; } .dv.mid .dv-card { padding:11px 16px; } .dv.mid .dv-ban { padding:7px 14px; } .dv.mid .dv-h { margin:16px 0 6px; } .dv.mid .dv-px th, .dv.mid .dv-px td { padding:6px 10px; } .dv.mid .dv-bot { margin-top:18px; }
        @media (max-width:700px) { .dv { padding:14px; } .dv-info { grid-template-columns:1fr; } .dv-card { grid-template-columns:1fr 1fr; } .dv-bot { grid-template-columns:1fr; } }
        @media print { @page { size:A4; margin:9mm; } body { background:#fff !important; } .wrap { padding:0 !important; max-width:none !important; } .dv { border:0; padding:4px 8px; } .dv-info { padding:8px 14px; margin-bottom:8px; font-size:12px; gap:2px; } .dv-card { padding:6px 12px; } .dv-ban { padding:5px 12px; font-size:12px; } .dv-tr { margin:5px 0; padding:3px 10px; } .dv-h { margin:10px 0 4px; } .dv-px th, .dv-px td { padding:4px 8px; } .dv-bot { margin-top:8px; } .dv-t { font-size:15px; }
          .dv.mid .dv-card { padding:9px 14px; } .dv.mid .dv-ban { padding:6px 12px; } .dv.mid .dv-h { margin:14px 0 6px; } .dv.mid .dv-px th, .dv.mid .dv-px td { padding:6px 8px; } .dv.mid .dv-info { padding:11px 16px; }
          .dv.roomy .dv-info { padding:16px 20px; margin-bottom:16px; font-size:13.5px; gap:5px; } .dv.roomy .dv-card { padding:16px 18px; } .dv.roomy .dv-ban { padding:9px 14px; font-size:13.5px; } .dv.roomy .dv-tr { margin:12px 0; padding:7px 12px; } .dv.roomy .dv-h { margin:24px 0 8px; } .dv.roomy .dv-px th, .dv.roomy .dv-px td { padding:9px 10px; } .dv.roomy .dv-bot { margin-top:26px; } .dv.roomy .dv-t { font-size:18px; } .dv.roomy .dv-v { font-size:14px; } }
      `}</style>
      <div className={'dv voucher' + (cards.length <= 1 ? ' roomy' : cards.length === 2 ? ' cozy' : cards.length === 3 ? ' mid' : '')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <AgentLogo id={b.agent_id} />
          <div style={{ fontSize: 19, fontWeight: 700, color: '#1a6e8c' }}>Booking confirmation</div>
          <span style={{ marginLeft: 'auto', background: BANNER.bg, color: BANNER.fg, padding: '5px 14px', borderRadius: 99, fontWeight: 800, fontSize: 12 }}>{BANNER.title}</span>
        </div>
        <div className="dv-info">{info.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        {cards.map(({ f, key, tag }, i) => {
          const prev = cards[i - 1];
          const sameJourney = prev && legs.length && legs[i] && legs[i - 1] && legs[i].journey === legs[i - 1].journey;
          const lay = sameJourney ? layover(prev.f, f) : '';
          const dur = legDuration(f);
          return (
            <div key={key} style={{ marginBottom: 10, breakInside: 'avoid' }}>
              {sameJourney && <div className="dv-tr">Transit at {cityName(f.origin).toUpperCase()} ({f.origin}){lay ? ` · ${lay}` : ''}</div>}
              <div className="dv-ban">
                <span>Flight {i + 1} - {cityName(f.origin).toUpperCase()} ({f.origin}) to {cityName(f.destination).toUpperCase()} ({f.destination}){tag && tag.indexOf('FLIGHT') !== 0 ? ` · ${tag}` : ''}</span>
                <i>{okTxt}</i>
              </div>
              <div className="dv-card">
                <div><div className="dv-l">Airline</div><div className="dv-v">{f.airline}</div></div>
                <div><div className="dv-l">Flight #</div><div className="dv-v">{String(f.flight_no || '').replace(/^([A-Z0-9]{2})(\d)/, '$1 $2')}</div></div>
                <div><div className="dv-l">Departure</div><div className="dv-t">{tm(f.departure_at)}</div><div className="dv-s">{cityName(f.origin)} ({f.origin})<br />{wdLong(f.departure_at)}</div></div>
                <div style={{ textAlign: 'center', color: '#8a8272' }}><Ico name="plane" size={18} style={{ transform: 'rotate(45deg)' }} /></div>
                <div><div className="dv-l">Arrival</div><div className="dv-t">{f.arrival_at ? tm(f.arrival_at) : '-'}</div><div className="dv-s">{cityName(f.destination)} ({f.destination})<br />{f.arrival_at ? wdLong(f.arrival_at) : ''}</div></div>
                <div className="dv-s" style={{ whiteSpace: "nowrap" }}><div className="dv-l">Duration / Stops</div><b style={{ fontSize: 13, color: '#1b2430' }}>{dur || '-'}</b> · Non stop<div className="dv-l" style={{ marginTop: 3 }}>Baggage</div><b style={{ fontSize: 13, color: '#1b2430' }}>{f.baggage || '-'}</b></div>
              </div>
            </div>
          );
        })}
        <div className="dv-h">Passenger(s)</div>
        <table className="dv-px">
          <thead><tr><th>SR #</th><th>PASSENGER NAME</th><th>TYPE</th><th>PASSPORT #</th><th style={{ textAlign: 'right' }}>MEAL</th></tr></thead>
          <tbody>
            {b.passengers.map((x, i) => (
              <tr key={x.id}><td>{i + 1}</td><td><b>{[x.first_name, x.last_name, x.title].filter(Boolean).join(' ').toUpperCase()}</b></td><td>{TYPE_LABEL[x.pax_type] || 'Adult'}</td><td>{x.passport_number}</td><td style={{ textAlign: 'right' }}>{b.flights?.meal || '—'}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="dv-bot">
          <div className="dv-tc">
            <h4>Terms &amp; conditions</h4>
            <div>1. Passenger should report at check-in counter at least 04:00 hours prior to flight.</div>
            <div>2. Tickets are non-refundable and non-changeable any time.</div>
          </div>
          <Stamp />
        </div>
      </div>
    </>
  );
}

const wdLong = d => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : '');

// the agent's own logo (uploaded in their Settings); nothing is shown if they have none
function AgentLogo({ id }) {
  const [ok, setOk] = useState(true);
  if (!ok || !id) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/uploads/file?path=branding/agents/${id}.png`} alt="" height="48" style={{ maxWidth: 120, height: 48, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 3 }} onError={() => setOk(false)} />;
}

// Sharp vector stamp (stays crisp on screen and when printed at any size)
function Stamp() {
  return (
    <svg viewBox="0 0 600 280" width="190" role="img" aria-label="No refunds or exchange" style={{ display: 'block', margin: '0 auto' }}>
      <path d="M44 8H556Q592 8 592 44V104A36 36 0 0 0 592 176V236Q592 272 556 272H44Q8 272 8 236V176A36 36 0 0 0 8 104V44Q8 8 44 8Z" fill="#c8102e" />
      <rect x="30" y="28" width="540" height="224" rx="14" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="14 9" />
      <text x="300" y="134" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="80" fill="#fff" textLength="470" lengthAdjust="spacingAndGlyphs">NO REFUNDS</text>
      <text x="300" y="220" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontSize="80" fill="#fff" textLength="470" lengthAdjust="spacingAndGlyphs">OR EXCHANGE</text>
    </svg>
  );
}
