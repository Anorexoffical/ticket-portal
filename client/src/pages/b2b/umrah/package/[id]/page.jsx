import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { UmrahStyle, Stepper, StayBar } from '@/components/UmrahBits';
import { num } from '@/lib/umrah';
import { TYPE_LABEL, agentUnit, totals, typesOf } from '@/lib/umrahPackages';
import { dShort, tm } from '@/lib/format';

// The page the agent shows or sends to the client. Prices are PKR totals only: no riyal, no cost, no agent profit split.
export default function ClientCard() {
  return <Shell role="agent" title="Client card">{p => <Card agency={p?.agency_name || ''} disc={Number(p?.discount_per_ticket) || 0} />}</Shell>;
}

function Card({ agency, disc }) {
  const { id } = useParams();
  const [k, setK] = useState(null);
  const [hotels, setHotels] = useState({});
  const [flights, setFlights] = useState({});
  const [markup, setMarkup] = useState(0);
  const [showFl, setShowFl] = useState(false);
  const [q, setQ] = useState({ type: '', adults: 2, cb: 0, cn: 0, inf: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const p = await supabase.from('umrah_packages').select('*').eq('id', id).maybeSingle();
      if (p.error || !p.data) { setError(p.error ? p.error.message : 'Package not found.'); return; }
      setK(p.data);
      const t = typesOf(p.data);
      setQ(x => ({ ...x, type: t[t.length > 1 ? 1 : 0] || '' }));
      const [h, m] = await Promise.all([
        supabase.from('umrah_hotels').select('id,name,city,distance_m,area'),
        supabase.from('umrah_agent_markup').select('amount').eq('package_id', id).maybeSingle(),
      ]);
      if (!h.error) setHotels(Object.fromEntries(h.data.map(x => [x.id, x])));
      if (m.data) setMarkup(Number(m.data.amount) || 0);
      const ids = [p.data.flight_out, p.data.flight_in].filter(Boolean);
      if (ids.length) {
        const f = await supabase.from('flights_with_seats').select('id,airline,flight_no,origin,destination,departure_at,arrival_at,baggage,meal').in('id', ids);
        if (!f.error) setFlights(Object.fromEntries(f.data.map(x => [x.id, x])));
      }
    })();
  }, [id]);

  const t = useMemo(() => (k && q.type ? totals(k, disc, markup, q) : null), [k, q, disc, markup]);
  if (error) return <div className="error">{error}</div>;
  if (!k) return <p className="muted">Loading...</p>;

  const sale = Number(k.old_extra) > 0;
  const mkh = hotels[k.makkah_hotel], mdh = hotels[k.madinah_hotel];
  const types = typesOf(k);
  const per = ty => agentUnit(k['p_' + ty], k, disc) + markup;   // client price per adult
  const out = flights[k.flight_out], inn = flights[k.flight_in];
  const fLine = (label, f) => f && <div>{label}: <b>{f.origin} → {f.destination}</b> · {dShort(f.departure_at)}</div>;
  const setV = key => v => setQ({ ...q, [key]: v });
  const parts = [
    mkh && { city: 'Makkah', name: mkh.name, nights: Number(k.makkah_nights) || 0, distance_m: mkh.distance_m, area: mkh.area },
    mdh && { city: 'Madinah', name: mdh.name, nights: Number(k.madinah_nights) || 0, distance_m: mdh.distance_m, area: mdh.area },
  ].filter(Boolean);
  const totalNights = parts.reduce((s, x) => s + x.nights, 0);
  const childPrice = key => (k[key] != null ? num(agentUnit(k[key], k, disc) + markup) : null);

  function whatsapp() {
    const lines = [
      `*${k.name}*${k.days ? ` (${k.days} days)` : ''}`,
      mkh ? `Makkah: ${mkh.name}${k.makkah_nights != null ? ` - ${k.makkah_nights} nights` : ''}${mkh.distance_m != null ? ` (${mkh.distance_m} m)` : ''}` : '',
      mdh ? `Madinah: ${mdh.name}${k.madinah_nights != null ? ` - ${k.madinah_nights} nights` : ''}${mdh.distance_m != null ? ` (${mdh.distance_m} m)` : ''}` : '',
      out ? `Outbound: ${out.origin}-${out.destination} ${dShort(out.departure_at)}` : '',
      inn ? `Return: ${inn.origin}-${inn.destination} ${dShort(inn.departure_at)}` : '',
      t ? `Room: ${TYPE_LABEL[q.type]} | Adults ${q.adults}${q.cb ? `, child with bed ${q.cb}` : ''}${q.cn ? `, child without bed ${q.cn}` : ''}${q.inf ? `, infant ${q.inf}` : ''}` : '',
      t ? `*Total: PKR ${num(t.client)}*` : '',
      agency,
    ].filter(Boolean);
    window.open('https://wa.me/?text=' + encodeURIComponent(lines.join('\n')), '_blank');
  }

  return (
    <div className="um um-main">
      <UmrahStyle />
      <style>{'@media print{.topbar,.paystrip,.noprint,.topmain>h1{display:none!important}.topmain{padding:0!important}}'}</style>
      <div className="actions noprint" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        <Link href="/agent/umrah"><button className="ghost">← Back</button></Link>
        <button onClick={() => window.print()}>Print / Save as PDF</button>
        <button className="ok" onClick={whatsapp}>Send on WhatsApp</button>
      </div>

      <div className="um-res">
        {agency && <div className="um-agency">{agency}</div>}
        <div className="um-title">{k.name} {sale && <span className="badge approved">SALE</span>}</div>
        {k.days && <div className="um-sum">{k.days} days</div>}

        <StayBar parts={parts} total={totalNights} />

        {(out || inn) && (
          <div className="small" style={{ marginTop: 12 }}>
            {fLine('Outbound', out)}{fLine('Return', inn)}
            <button className="ghost noprint" style={{ marginTop: 6 }} onClick={() => setShowFl(!showFl)}>{showFl ? 'Hide' : 'Show'} full flight details</button>
            {showFl && [out, inn].filter(Boolean).map(f => (
              <div className="panel" key={f.id} style={{ marginTop: 6 }}>
                <b>{f.airline} {f.flight_no}</b> · {f.origin} → {f.destination}<br />
                Departs {dShort(f.departure_at)} {tm(f.departure_at)}{f.arrival_at ? ` · Arrives ${tm(f.arrival_at)}` : ''}<br />
                {f.baggage ? `Baggage: ${f.baggage}` : ''}{f.baggage && f.meal ? ' · ' : ''}{f.meal ? `Meal: ${f.meal}` : ''}
              </div>
            ))}
          </div>
        )}

        <div className="small" style={{ marginTop: 12 }}>
          Included: {['inc_visa', 'inc_transport', 'inc_ziyarat'].filter(x => k[x]).map(x => ({ inc_visa: 'Visa', inc_transport: 'Transport', inc_ziyarat: 'Ziyarat' }[x])).join(' · ') || 'see note'}
          {k.note && <div className="muted">{k.note}</div>}
        </div>

        <div className="scroll" style={{ marginTop: 12 }}><table>
          <thead><tr><th>Room (per person)</th><th>Price</th></tr></thead>
          <tbody>
            {types.map(ty => <tr key={ty}><td>{TYPE_LABEL[ty]}</td><td><b>PKR {num(per(ty))}</b>{sale && <span className="muted small"> <s>{num(per(ty) + Number(k.old_extra))}</s></span>}</td></tr>)}
            {childPrice('p_child_bed') && <tr><td>Child with bed</td><td><b>PKR {childPrice('p_child_bed')}</b></td></tr>}
            {childPrice('p_child_nobed') && <tr><td>Child without bed</td><td><b>PKR {childPrice('p_child_nobed')}</b></td></tr>}
            {k.p_infant != null && <tr><td>Infant</td><td><b>PKR {num(k.p_infant)}</b></td></tr>}
          </tbody>
        </table></div>

        <div className="noprint um-blk">
          <div className="um-lab">Work out the total</div>
          <div className="um-chips" role="radiogroup" aria-label="Room type" style={{ marginBottom: 10 }}>
            {types.map(ty => <button key={ty} type="button" role="radio" aria-checked={q.type === ty} className={q.type === ty ? '' : 'ghost'} style={{ minHeight: 44 }} onClick={() => setQ({ ...q, type: ty })}>{TYPE_LABEL[ty]}</button>)}
          </div>
          <div className="um-steps">
            <Stepper label="Adults" value={q.adults} onChange={setV('adults')} />
            <Stepper label="Child with bed" value={q.cb} onChange={setV('cb')} />
            <Stepper label="Child without bed" value={q.cn} onChange={setV('cn')} />
            <Stepper label="Infants" value={q.inf} onChange={setV('inf')} />
          </div>
        </div>
        {t && (
          <div style={{ marginTop: 12 }}>
            <div className="muted small">{TYPE_LABEL[q.type]} · {q.adults} adult(s){q.cb ? ` · ${q.cb} child with bed` : ''}{q.cn ? ` · ${q.cn} child without bed` : ''}{q.inf ? ` · ${q.inf} infant(s)` : ''}</div>
            <div className="um-total"><span className="t">Total</span><span className="v"><small>PKR</small>{num(t.client)}</span></div>
            <div className="small noprint um-agent">You pay the agency: <b>PKR {num(t.mine)}</b> · Your profit: <b>PKR {num(t.profit)}</b> <span className="muted">(this line is not printed or sent)</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
