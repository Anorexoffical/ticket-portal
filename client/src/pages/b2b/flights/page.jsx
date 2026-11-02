import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import AirlineLogo from '@/components/AirlineLogo';
import { groupFlights } from '@/lib/airlines';
import { legsMap } from '@/lib/legs';
import useFlightFilter from '@/lib/useFlightFilter';
import { Chip, FilterList, LegCols, FlightHead } from '@/components/FlightParts';
import { cityName } from '@/lib/cities';
import useDiscount, { priceFor } from '@/lib/useDiscount';
import BookSeatsModal from '@/components/BookDrawer';

export default function B2BFlights() {
  const [flights, setFlights] = useState([]);
  const [legs, setLegs] = useState({});
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [bookingId, setBookingId] = useState(null);
  const [booked, setBooked] = useState(false);
  const disc = useDiscount();

  useEffect(() => {
    supabase.from('flights_with_seats').select('*').eq('active', true)
      .gt('departure_at', new Date().toISOString()).order('departure_at')
      .then(({ data, error }) => { if (error) setError(error.message); else setFlights(data || []); setLoaded(true); });
    supabase.from('flight_legs').select('*').then(({ data }) => { if (data) setLegs(legsMap(data)); });
  }, []);

  const { type, pickType, types, airOpts, secOpts, shown, selAir, selSec, setSelAir, setSelSec, tog } = useFlightFilter(flights, legs);
  const groups = useMemo(() => groupFlights(shown, legs), [shown, legs]);

  function onBooked() { setBookingId(null); setBooked(true); window.scrollTo(0, 0); }

  return (
    <Shell role="agent" title="">
      {error && <div className="error">{error}</div>}
      {booked && (
        <div className="good" style={{ marginBottom: 16 }}>
          ✅ Booking placed on hold! Check <a href="/agent/bookings">My Bookings</a> for details and payment instructions.
        </div>
      )}

      <div className="b2b-flights-banner">
        <div className="b2b-flights-top">
          <h1 className="b2b-flights-title">✈ Available Flights</h1>
        </div>
        {loaded && flights.length > 0 && (
          <div className="b2b-flights-chips">
            <Chip on={type === 'ALL'} onClick={() => pickType('ALL')}>All Types</Chip>
            {types.map(c => <Chip key={c.key} on={type === c.key} onClick={() => pickType(c.key)}>{c.label}</Chip>)}
          </div>
        )}
      </div>

      <div className="b2b-flights-layout">
        {loaded && flights.length > 0 && (airOpts.length > 0 || secOpts.length > 0) && (
          <aside className="b2b-flights-filter">
            {airOpts.length > 0 && (
              <div className="b2b-ffp-section">
                <FilterList title="Airlines" items={airOpts.map(([k, a]) => [k, a.name])} sel={selAir}
                  onToggle={v => tog(selAir, setSelAir, v)} onAll={all => setSelAir(all ? airOpts.map(([k]) => k) : [])} />
              </div>
            )}
            {secOpts.length > 0 && (
              <div className="b2b-ffp-section">
                <FilterList title="Sectors" items={secOpts.map(x => [x, x])} sel={selSec}
                  onToggle={v => tog(selSec, setSelSec, v)} onAll={all => setSelSec(all ? secOpts : [])} />
              </div>
            )}
          </aside>
        )}

        <div className="fzmain">
          {!loaded ? (
            <div className="card"><p className="muted">Loading flights…</p></div>
          ) : groups.length === 0 ? (
            <div className="card"><p className="muted">No flights available right now.</p></div>
          ) : (
            <>
              <FlightHead />
              {groups.map(g => (
                <div className="card fz" key={g.key}>
                  <div className="fzhead">
                    <AirlineLogo flightNo={g.flightNo} airline={g.name} size={34} />
                    <span className="fzpath">{(g.path || [g.origin, g.destination]).map(cityName).join(' – ')}</span>
                  </div>
                  {g.items.map(f => (
                    <FlightRow key={f.id} f={f} legs={legs[f.id]} disc={disc}
                      onBook={() => { setBooked(false); setBookingId(f.id); }} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {bookingId && (
        <BookSeatsModal
          flightId={bookingId}
          onClose={() => setBookingId(null)}
          onBooked={onBooked}
        />
      )}
    </Shell>
  );
}

function FlightRow({ f, legs, disc, onBook }) {
  const discPrice = priceFor(f.price, disc);
  return (
    <div className="fzrow">
      <LegCols f={f} legs={legs} />
      <div className="fzcol fzmid">{f.meal || '-'}</div>
      <div className="fzcol fzmid fzprice">
        <span>PKR</span> <b>{discPrice.toLocaleString('en-US')}</b>
        {disc > 0 && <div className="small muted"><s>{Number(f.price).toLocaleString('en-US')}</s></div>}
      </div>
      <div className="fzcol fzmid fzbtn">
        {f.seats_left > 0 ? (
          <>
            <button className="book" onClick={onBook}>Book now</button>
            {f.seats_left <= 9 && <div className="small neg">{f.seats_left} seat(s) left</div>}
          </>
        ) : (
          <button className="book" disabled>Sold out</button>
        )}
      </div>
    </div>
  );
}
