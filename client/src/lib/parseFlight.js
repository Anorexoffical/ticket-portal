// One flight line -> form values (used by "Quick fill" when adding a single flight).
// The full reader lives in ./itinerary.js
import { parseSegment } from './itinerary';

export function parseFlightLine(text, now = new Date()) {
  const s = parseSegment(text, now);
  if (s.error) return { error: s.error };
  return {
    airline: s.airline, flight_no: s.flight_no, origin: s.origin, destination: s.destination,
    departure_at: s.departure_at, arrival_at: s.arrival_at, pnr: s.pnr || '',
  };
}
