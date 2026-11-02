import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import AirlineLogo from '@/components/AirlineLogo';
import { groupFlights } from '@/lib/airlines';
import { legsMap } from '@/lib/legs';
import useFlightFilter from '@/lib/useFlightFilter';
import { Chip, FilterList, LegCols, FlightHead } from '@/components/FlightParts';
import { cityName } from '@/lib/cities';
import useDiscount, { priceFor } from '@/lib/useDiscount';

// Flights grouped by airline and route. Top rows: type, destination and airline buttons that show only what is available.
export default function AgentFlights() {
  const [flights, setFlights] = useState([]);
  const [legs, setLegs] = useState({});
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const disc = useDiscount();

  useEffect(() => {
    supabase.from('flights_with_seats').select('*').eq('active', true)
      .gt('departure_at', new Date().toISOString()).order('departure_at')
      .then(({ data, error }) => { if (error) setError(error.message); else setFlights(data); setLoaded(true); });
    supabase.from('flight_legs').select('*').then(({ data }) => { if (data) setLegs(legsMap(data)); });
  }, []);

  const { type, pickType, types, airOpts, secOpts, shown, selAir, selSec, setSelAir, setSelSec, tog } = useFlightFilter(flights, legs);
  const groups = useMemo(() => groupFlights(shown, legs), [shown, legs]);

  return (
    <Shell role="agent" title="Available Flights">
      {error && <div className="error">{error}</div>}
      {loaded && flights.length > 0 && (
        <div className="card chips">
          <div className="chiprow">
            <Chip on={type === 'ALL'} onClick={() => pickType('ALL')}>All Types</Chip>
            {types.map(c => <Chip key={c.key} on={type === c.key} onClick={() => pickType(c.key)}>{c.label}</Chip>)}
          </div>
        </div>
      )}

      <div className="fzlayout">
      {loaded && flights.length > 0 && (
        <aside className="card fzside">
          <h3 style={{ margin: '0 0 10px' }}>Filters</h3>
          <FilterList title="Select Airlines (Multiple)" items={airOpts.map(([k, a]) => [k, a.name])} sel={selAir} onToggle={v => tog(selAir, setSelAir, v)} onAll={all => setSelAir(all ? airOpts.map(([k]) => k) : [])} />
          <FilterList title="Select Sectors (Multiple)" items={secOpts.map(x => [x, x])} sel={selSec} onToggle={v => tog(selSec, setSelSec, v)} onAll={all => setSelSec(all ? secOpts : [])} />
        </aside>
      )}
      <div className="fzmain">
      {!loaded ? <p className="muted">Loading...</p> : groups.length === 0 ? (
        <div className="card"><p className="muted">No flights available right now. Please check again later.</p></div>
      ) : <>
      <FlightHead />
      {groups.map(g => (
        <div className="card fz" key={g.key}>
          <div className="fzhead">
            <AirlineLogo flightNo={g.flightNo} airline={g.name} size={34} />
            <span className="fzpath">{(g.path || [g.origin, g.destination]).map(cityName).join(' – ')}</span>
          </div>
          {g.items.map(f => <FlightRow key={f.id} f={f} legs={legs[f.id]} disc={disc} />)}
        </div>
      ))}
      </>}
      </div>
      </div>
    </Shell>
  );
}

// one flight = one row. A connecting or return trip shows its flights as stacked lines (one per leg).
function FlightRow({ f, legs, disc }) {
  return (
    <div className="fzrow">
      <LegCols f={f} legs={legs} />
      <div className="fzcol fzmid">{f.meal || '-'}</div>
      <div className="fzcol fzmid fzprice"><span>PKR</span> <b>{priceFor(f.price, disc).toLocaleString('en-US')}</b>{disc > 0 && <div className="small muted"><s>{Number(f.price).toLocaleString('en-US')}</s></div>}</div>
      <div className="fzcol fzmid fzbtn">
        {f.seats_left > 0
          ? <><Link href={`/agent/book/${f.id}`}><button className="book">Book now</button></Link>{f.seats_left <= 9 && <div className="small neg">{f.seats_left} seat(s) left</div>}</>
          : <button className="book" disabled>Sold out</button>}
      </div>
    </div>
  );
}
