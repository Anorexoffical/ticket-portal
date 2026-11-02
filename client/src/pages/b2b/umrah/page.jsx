import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { UmrahStyle } from '@/components/UmrahBits';
import { num } from '@/lib/umrah';
import { TYPE_LABEL, agentUnit, typesOf } from '@/lib/umrahPackages';
import { dShort } from '@/lib/format';

// Agent Umrah home: the packages. The agent sees what he pays you, adds his OWN profit, and gets the client price.
// The database only returns packages to agents the owner gave Umrah access.
export default function AgentUmrah() {
  return <Shell role="agent" title="Umrah Packages">{p => <Packages disc={Number(p?.discount_per_ticket) || 0} />}</Shell>;
}

function Packages({ disc }) {
  const [pkgs, setPkgs] = useState([]);
  const [hotels, setHotels] = useState({});
  const [flights, setFlights] = useState({});
  const [mk, setMk] = useState({});   // package id -> markup text
  const [saved, setSaved] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [p, h, m] = await Promise.all([
      supabase.from('umrah_packages').select('*').eq('active', true).order('created_at', { ascending: false }),
      supabase.from('umrah_hotels').select('id,name,city,distance_m,area'),
      supabase.from('umrah_agent_markup').select('*'),
    ]);
    if (p.error) { setError(p.error.message); setLoaded(true); return; }
    setPkgs(p.data);
    if (!h.error) setHotels(Object.fromEntries(h.data.map(x => [x.id, x])));
    const mm = Object.fromEntries((m.data || []).map(x => [x.package_id, String(x.amount)]));
    setMk(mm); setSaved(mm);
    const ids = [...new Set(p.data.flatMap(x => [x.flight_out, x.flight_in]).filter(Boolean))];
    if (ids.length) {
      const f = await supabase.from('flights_with_seats').select('id,flight_no,origin,destination,departure_at').in('id', ids);
      if (!f.error) setFlights(Object.fromEntries(f.data.map(x => [x.id, x])));
    }
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveMarkup(id) {
    setError(''); setMsg('');
    const { error } = await supabase.rpc('agent_set_umrah_markup', { p_package: id, p_amount: Number(mk[id]) || 0 });
    if (error) setError(error.message); else { setMsg('Your profit was saved.'); setSaved({ ...saved, [id]: String(Number(mk[id]) || 0) }); }
  }

  const fText = f => (f ? `${f.origin}-${f.destination} ${dShort(f.departure_at)}` : null);

  return (
    <div className="um">
      <UmrahStyle />
      <div className="um-hero">
        <div>
          <h2>Build your own package</h2>
          <p>Choose the people, flight, hotels and room. The price shows by itself.</p>
        </div>
        <Link href="/agent/umrah/build"><button className="um-hero-btn">Build a package</button></Link>
      </div>
      <div className="stats" style={{ marginBottom: 8 }}>
        <Link href="/agent/umrah/visa" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}><span className="muted small">15, 28 or 80 days</span><b>Visa only</b></Link>
        <Link href="/agent/umrah/hotel" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}><span className="muted small">No flight, no visa</span><b>Hotel only</b></Link>
      </div>
      <h3 style={{ margin: '16px 0 8px' }}>Ready packages</h3>
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      {!loaded ? <p className="muted">Loading...</p> : pkgs.length === 0 ? (
        <div className="card"><p className="muted">No packages to show yet. If you expected to see packages, please ask the main agency to turn on Umrah for your account.</p></div>
      ) : pkgs.map(k => {
        const m = Number(mk[k.id]) || 0;
        const sale = Number(k.old_extra) > 0;
        const mkh = hotels[k.makkah_hotel], mdh = hotels[k.madinah_hotel];
        return (
          <div className="card" key={k.id}>
            <h2 style={{ margin: 0 }}>{k.name} <span className="muted small">{k.days ? `${k.days} days` : ''}</span> {sale && <span className="badge approved">SALE</span>}</h2>
            <div className="small" style={{ marginTop: 6 }}>
              {mkh && <div>Makkah: <b>{mkh.name}</b>{k.makkah_nights != null ? ` · ${k.makkah_nights} nights` : ''}{mkh.distance_m != null ? ` · ${mkh.distance_m} m` : ''}{mkh.area ? ` · ${mkh.area}` : ''}</div>}
              {mdh && <div>Madinah: <b>{mdh.name}</b>{k.madinah_nights != null ? ` · ${k.madinah_nights} nights` : ''}{mdh.distance_m != null ? ` · ${mdh.distance_m} m` : ''}{mdh.area ? ` · ${mdh.area}` : ''}</div>}
              {(flights[k.flight_out] || flights[k.flight_in]) && <div>Flights: {fText(flights[k.flight_out]) || '-'} / {fText(flights[k.flight_in]) || '-'}</div>}
            </div>

            <div className="scroll" style={{ marginTop: 10 }}><table>
              <thead><tr><th>Room</th><th>You pay</th><th>Client price</th></tr></thead>
              <tbody>
                {typesOf(k).map(t => {
                  const mine = agentUnit(k['p_' + t], k, disc);
                  return (
                    <tr key={t}>
                      <td>{TYPE_LABEL[t]}</td>
                      <td><b>{num(mine)}</b>{mine < Number(k['p_' + t]) && <span className="muted small"> <s>{num(k['p_' + t])}</s></span>}</td>
                      <td><b>{num(mine + m)}</b>{sale && <span className="muted small"> <s>{num(mine + m + Number(k.old_extra))}</s></span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>Per adult. Child and infant prices are on the client card. {sale ? 'Sale package: no agent discount.' : disc > 0 && k.allow_agent_discount ? 'Your agent discount is already taken off.' : ''}</p>

            <div className="actions" style={{ marginTop: 10, flexWrap: 'wrap' }}>
              <label style={{ margin: 0, fontWeight: 400 }}>Your own profit per person (PKR)</label>
              <input type="number" min="0" step="100" style={{ width: 110 }} value={mk[k.id] ?? ''} onChange={e => setMk({ ...mk, [k.id]: e.target.value })} placeholder="0" />
              <button className={(mk[k.id] ?? '') !== (saved[k.id] ?? '') ? 'ok' : 'ghost'} onClick={() => saveMarkup(k.id)}>Save</button>
              <Link href={`/agent/umrah/package/${k.id}`}><button>Client card</button></Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
