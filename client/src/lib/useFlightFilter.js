'use client';
import { useMemo, useState } from 'react';
import { airlineInfo } from './airlines';
import { pathCodes } from './legs';
import { categoryOf, sortCats } from './categories';

// Top type buttons + left airline / sector lists that show only what exists. Shared by the agent and admin flight pages.
export default function useFlightFilter(flights, legs) {
  const [type, setType] = useState('ALL');
  const [selAir, setSelAir] = useState([]);
  const [selSec, setSelSec] = useState([]);

  const info = useMemo(() => flights.map(f => ({
    f, cat: categoryOf(f, legs[f.id]), air: airlineInfo(f.flight_no, f.airline),
    sec: pathCodes(f, legs[f.id]).join('-'),
  })), [flights, legs]);
  const akey = x => x.air.code || x.air.name;

  const types = useMemo(() => { const m = new Map(); info.forEach(x => m.set(x.cat.key, x.cat)); return sortCats(m.values()); }, [info]);
  const inType = useMemo(() => info.filter(x => type === 'ALL' || x.cat.key === type), [info, type]);
  const airOpts = useMemo(() => {
    const m = new Map(); inType.filter(x => !selSec.length || selSec.includes(x.sec)).forEach(x => m.set(akey(x), x.air));
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [inType, selSec]);
  const secOpts = useMemo(() => [...new Set(inType.filter(x => !selAir.length || selAir.includes(akey(x))).map(x => x.sec))].sort(), [inType, selAir]);
  const shown = useMemo(() => inType.filter(x => (!selAir.length || selAir.includes(akey(x))) && (!selSec.length || selSec.includes(x.sec))).map(x => x.f), [inType, selAir, selSec]);

  const pickType = k => { setType(k); setSelAir([]); setSelSec([]); };
  const tog = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
  return { type, pickType, types, airOpts, secOpts, shown, selAir, selSec, setSelAir, setSelSec, tog };
}
