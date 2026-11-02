'use client';
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { legsMap } from './legs';

// loads the legs (stops) of the flights used by the given rows -> { flightId: [legs] }
export default function useLegs(rows) {
  const [map, setMap] = useState({});
  const key = [...new Set((rows || []).map(r => r.flight_id).filter(Boolean))].sort().join(',');
  useEffect(() => {
    if (!key) { setMap({}); return; }
    let live = true;
    supabase.from('flight_legs').select('*').in('flight_id', key.split(',')).then(({ data }) => { if (live) setMap(legsMap(data)); });
    return () => { live = false; };
  }, [key]);
  return map;
}
