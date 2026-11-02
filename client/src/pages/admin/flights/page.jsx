import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import AirlineLogo from '@/components/AirlineLogo';
import useFlightFilter from '@/lib/useFlightFilter';
import { Chip, FilterList, LegCols, FlightHead } from '@/components/FlightParts';
import { money, toLocalInput, tm, wd, dShort, holdText, holdToMinutes, holdSplit } from '@/lib/format';
import { parseFlightLine } from '@/lib/parseFlight';
import { buildTrips, toFlight, hm } from '@/lib/itinerary';
import { airlineInfo, groupFlights } from '@/lib/airlines';
import { legsMap } from '@/lib/legs';
import { cityName } from '@/lib/cities';
import { sectorText } from '@/lib/legs';
import { buildPaxWorkbook } from '@/lib/paxSheet';

const EMPTY = {
  airline: '', flight_no: '', origin: '', destination: '', departure_at: '', arrival_at: '',
  price: '', baggage: '', meal: '', total_seats: '', hold_value: '6', hold_unit: 'hr', pnr: '', supplier: '', buy: '',
};
const BULK_EMPTY = { text: '', mode: 'auto', price: '', total_seats: '', hold_value: '6', hold_unit: 'hr', baggage: '', meal: '', pnrs: {}, supplier: '', buy: '' };

function parseEasyDate(value) {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^([0-9]{1,2})[\/\-.]([0-9]{1,2})[\/\-.]([0-9]{4})$/);
  if (!match) return '';
  const [, month, day, year] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const check = new Date(`${iso}T12:00:00`);
  return !isNaN(check) && check.getFullYear() === Number(year) && check.getMonth() + 1 === Number(month) && check.getDate() === Number(day) ? iso : '';
}
const PNR_OK = /^[A-Z0-9]{6}$/;

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
);
const BulkIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6M9 16h4"/></svg>
);

export default function AdminFlights() {
  const [flights, setFlights] = useState([]);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [pnrs, setPnrs] = useState({});
  const [line, setLine] = useState('');
  const [hasLegs, setHasLegs] = useState(false);
  const [legs, setLegs] = useState({});
  const [bulk, setBulk] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canCost, setCanCost] = useState(false);
  const [sups, setSups] = useState([]);
  const [costs, setCosts] = useState({});
  const [sel, setSel] = useState({});

  const load = useCallback(async () => {
    const [f, p, l, ow, hp] = await Promise.all([
      supabase.from('flights_with_seats').select('*').order('departure_at'),
      supabase.from('flight_private').select('*'),
      supabase.from('flight_legs').select('*'),
      supabase.rpc('is_owner'),
      supabase.rpc('has_profit'),
    ]);
    if (f.error) { setError(f.error.message); return; }
    const owner = !ow.error && ow.data === true, cost = !hp.error && hp.data === true;
    setIsOwner(owner); setCanCost(cost);
    if (cost) {
      const [su, fc] = await Promise.all([
        supabase.from('suppliers').select('id,name').eq('active', true).order('name'),
        supabase.from('flight_cost').select('flight_id,supplier,buy_price'),
      ]);
      if (!su.error) setSups(su.data);
      if (!fc.error) setCosts(Object.fromEntries(fc.data.map(x => [x.flight_id, x])));
    }
    setFlights(f.data);
    if (!l.error) setLegs(legsMap(l.data));
    if (!p.error) setPnrs(Object.fromEntries(p.data.map(x => [x.flight_id, x.pnr])));
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = k => e => setForm({ ...form, [k]: e.target.value });

  const pnrOwner = useMemo(() => {
    const m = {};
    for (const f of flights) if (pnrs[f.id]) m[pnrs[f.id].toUpperCase()] = f;
    return m;
  }, [flights, pnrs]);
  const ownerText = f => `${f.flight_no} on ${wd(f.departure_at)}`;

  function fillFromLine() {
    setError(''); setMsg('');
    const r = parseFlightLine(line);
    if (r.error) { setError(r.error); return; }
    const { airline, pnr, ...rest } = r;
    setForm({ ...form, ...rest, airline: airline || form.airline, pnr: pnr || form.pnr });
    setMsg('Filled from your line. Check the details, then enter price, seats, hold time and the PNR.');
  }

  async function exportPax(f) {
    setError(''); setMsg('');
    const { data, error } = await supabase.from('bookings')
      .select('booking_no,status,profiles:agent_id(agency_name),passengers(*)')
      .eq('flight_id', f.id).in('status', ['on_hold', 'confirmed', 'issued']);
    if (error) { setError(error.message); return; }
    const { wb, count } = await buildPaxWorkbook({ flight: f, bookings: data, pnr: pnrs[f.id], sector: sectorText(f, legs[f.id]) });
    if (!count) { setMsg('No passengers booked on this flight yet.'); return; }
    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `${(f.flight_no || 'flight').replace(/\s+/g, '')}_${String(f.departure_at).slice(0, 10)}_passengers.xlsx`;
    a.click(); URL.revokeObjectURL(a.href);
    setMsg(`Excel downloaded: ${count} passenger(s).`);
  }

  function openNew() { setHasLegs(false); setBulk(null); setEditId(null); setForm({ ...EMPTY }); setError(''); setMsg(''); }
  function openBulk() { setForm(null); setEditId(null); setBulk({ ...BULK_EMPTY, pnrs: {} }); setError(''); setMsg(''); }
  function openEdit(f) {
    setBulk(null); setHasLegs(!!legs[f.id]); setEditId(f.id); setError(''); setMsg('');
    setForm({
      airline: f.airline, flight_no: f.flight_no, origin: f.origin, destination: f.destination,
      departure_at: toLocalInput(f.departure_at), arrival_at: toLocalInput(f.arrival_at),
      price: f.price, baggage: f.baggage || '', meal: f.meal || '', total_seats: f.total_seats,
      ...holdSplit(f.hold_minutes || f.hold_hours * 60),
      pnr: pnrs[f.id] || '',
      supplier: costs[f.id]?.supplier || '',
      buy: costs[f.id]?.buy_price == null ? '' : String(Number(costs[f.id].buy_price)),
    });
  }

  const findDuplicate = (flightNo, dep) =>
    flights.find(f => f.flight_no.toUpperCase() === flightNo.toUpperCase() &&
      new Date(f.departure_at).toDateString() === new Date(dep).toDateString());

  const flightRow = (r, shared) => ({
    airline: airlineInfo(r.flight_no, r.airline).name || r.airline,
    flight_no: r.flight_no, origin: r.origin, destination: r.destination,
    departure_at: new Date(r.departure_at).toISOString(),
    arrival_at: r.arrival_at ? new Date(r.arrival_at).toISOString() : null,
    price: Number(shared.price), baggage: (shared.baggage || '').trim() || null,
    meal: (shared.meal || '').trim() || null,
    total_seats: parseInt(shared.total_seats, 10),
    hold_minutes: holdToMinutes(shared.hold_value, shared.hold_unit),
  });

  async function save(e) {
    e.preventDefault(); setError(''); setMsg('');
    const dep = new Date(form.departure_at), arr = form.arrival_at ? new Date(form.arrival_at) : null;
    if (isNaN(dep)) { setError('Enter the departure date and time.'); return; }
    if (arr && arr <= dep) { setError('Arrival must be after departure.'); return; }
    if (!(Number(form.price) >= 0) || form.price === '') { setError('Enter a valid price.'); return; }
    if (!(Number(form.total_seats) >= 0) || form.total_seats === '') { setError('Enter total seats.'); return; }
    if (!(holdToMinutes(form.hold_value, form.hold_unit) >= 1)) { setError('Hold time must be at least 1 minute.'); return; }
    const pn = form.pnr.trim().toUpperCase();
    if (!pn) { setError('The airline PNR is required for every flight.'); return; }
    if (!PNR_OK.test(pn)) { setError('PNR must be exactly 6 letters or numbers (A-Z, 0-9).'); return; }
    const used = pnrOwner[pn];
    if (used && used.id !== editId) { setError(`PNR ${pn} is already used by flight ${ownerText(used)}.`); return; }
    const flightNo = form.flight_no.trim().toUpperCase();
    if (!editId) {
      const dup = findDuplicate(flightNo, dep);
      if (dup && !confirm(`${flightNo} on ${wd(dep)} is already in your list. Add it again?`)) return;
    }
    const row = flightRow({ ...form, flight_no: flightNo, origin: form.origin.trim().toUpperCase(), destination: form.destination.trim().toUpperCase() }, form);
    setBusy(true);
    const { data: savedId, error } = await supabase.rpc('admin_save_flight', { p_id: editId, p_row: row, p_pnr: pn });
    if (error) { setBusy(false); setError(error.message); return; }
    let note = '';
    const fid = savedId || editId;
    if (isOwner && canCost && fid && (form.supplier || form.buy !== '' || costs[fid])) {
      const r = await supabase.rpc('owner_set_flight_cost', { p_flight: fid, p_supplier: form.supplier, p_buy: form.buy === '' ? null : Number(form.buy) });
      if (r.error) note = ` Flight saved but supplier/price was not: ${r.error.message}`;
    }
    setBusy(false);
    setMsg((editId ? 'Flight updated.' : 'Flight added.') + note);
    setForm(null); setEditId(null); load();
  }

  const setB = k => e => setBulk({ ...bulk, [k]: e.target.value });
  const setRowPnr = (key, v) => setBulk({ ...bulk, pnrs: { ...bulk.pnrs, [key]: v.toUpperCase().replace(/[^A-Z0-9]/g, '') } });
  const iso = v => (v ? new Date(v).toISOString() : null);

  const parsed = useMemo(() => (bulk ? buildTrips(bulk.text, bulk.mode) : { trips: [], failed: [], ignored: [] }), [bulk?.text, bulk?.mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const bulkRows = useMemo(() => {
    if (!bulk) return [];
    const rows = parsed.trips.map(t => {
      const fl = toFlight(t.journeys);
      const key = t.journeys.flat().map(x => x.line).join('|');
      const pnr = ((bulk.pnrs[key] ?? fl.pnr ?? '') + '').trim().toUpperCase();
      return { key, fl, item: t.journeys, pnr, tripProblem: t.problem || '' };
    });
    const count = {};
    rows.forEach(x => { if (x.pnr) count[x.pnr] = (count[x.pnr] || 0) + 1; });
    return rows.map(x => {
      let problem = '', skip = false;
      if (x.tripProblem) problem = x.tripProblem;
      else if (findDuplicate(x.fl.flight_no, x.fl.departure_at)) { skip = true; problem = 'Already in your list - will be skipped'; }
      else if (!x.pnr) problem = 'Enter the PNR';
      else if (!PNR_OK.test(x.pnr)) problem = 'PNR must be exactly 6 letters or numbers';
      else if (pnrOwner[x.pnr]) problem = `PNR already used by ${ownerText(pnrOwner[x.pnr])}`;
      else if (count[x.pnr] > 1) problem = 'PNR is repeated in this list';
      return { ...x, problem, skip };
    });
  }, [bulk, parsed, pnrOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  const toAdd = bulkRows.filter(x => !x.skip && !x.problem);
  const blocking = bulkRows.filter(x => x.problem && !x.skip);

  async function saveBulk() {
    setError(''); setMsg('');
    if (parsed.failed.length) { setError('Fix or remove the lines marked in red first.'); return; }
    if (blocking.length) { setError('Fix the lines marked in red first (each trip needs its own PNR).'); return; }
    if (toAdd.length === 0) { setError('Nothing to add.'); return; }
    if (!(holdToMinutes(bulk.hold_value, bulk.hold_unit) >= 1)) { setError('Hold time must be at least 1 minute.'); return; }
    for (const x of toAdd) {
      const pr = x.fl.price || bulk.price;
      if (pr === '' || !(Number(pr) >= 0)) { setError(`Enter the price (${x.fl.flight_no} has none).`); return; }
    }
    if (bulk.total_seats === '' || !(Number(bulk.total_seats) >= 0)) { setError('Enter total seats.'); return; }
    const rows = toAdd.map(x => {
      const fl = x.fl;
      const row = {
        airline: airlineInfo(fl.flight_no, fl.airline).name || fl.airline || fl.flight_no.slice(0, 2),
        flight_no: fl.flight_no, origin: fl.origin, destination: fl.destination,
        departure_at: iso(fl.departure_at), arrival_at: iso(fl.arrival_at),
        price: Number(fl.price || bulk.price),
        baggage: (bulk.baggage || fl.baggage || '').trim() || null,
        meal: (bulk.meal || fl.meal || '').trim() || null,
        total_seats: parseInt(bulk.total_seats, 10),
        hold_minutes: holdToMinutes(bulk.hold_value, bulk.hold_unit),
        pnr: x.pnr,
      };
      if (fl.legs) row.legs = fl.legs.map(l => ({ ...l, airline: l.airline || null, departure_at: iso(l.departure_at), arrival_at: iso(l.arrival_at) }));
      return row;
    });
    setBusy(true);
    const { error } = await supabase.rpc('admin_add_flights', { p_rows: rows });
    if (error) { setBusy(false); setError(error.message); return; }
    let note = '';
    if (isOwner && canCost && (bulk.supplier || bulk.buy !== '')) {
      const nos = [...new Set(rows.map(r => r.flight_no))];
      const got = await supabase.from('flights').select('id,flight_no,departure_at').in('flight_no', nos);
      let ok = 0;
      for (const r of rows) {
        const hit = (got.data || []).find(g => g.flight_no === r.flight_no && new Date(g.departure_at).getTime() === new Date(r.departure_at).getTime());
        if (!hit) continue;
        const x = await supabase.rpc('owner_set_flight_cost', { p_flight: hit.id, p_supplier: bulk.supplier, p_buy: bulk.buy === '' ? null : Number(bulk.buy) });
        if (!x.error) ok += 1;
      }
      note = ok === rows.length ? ' Supplier saved on all.' : ` Supplier saved on ${ok} of ${rows.length}.`;
    }
    setBusy(false);
    const skipped = bulkRows.filter(x => x.skip).length;
    setBulk(null); load();
    setMsg(`Added ${rows.length} flight(s).${skipped ? ` Skipped ${skipped} already in list.` : ''}${note}`);
  }

  const selIds = Object.keys(sel).filter(k => sel[k]);
  const toggleSel = id => setSel(s => ({ ...s, [id]: !s[id] }));

  async function deleteSelected() {
    setError(''); setMsg('');
    if (!selIds.length) return;
    if (!confirm(`Delete ${selIds.length} flight(s)? This cannot be undone.`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('admin_delete_flights', { p_ids: selIds });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg(`Deleted ${selIds.length} flight(s).`); setSel({}); load();
  }

  async function toggle(f) {
    setError('');
    const { error } = await supabase.from('flights').update({ active: !f.active }).eq('id', f.id);
    if (error) setError(error.message); else load();
  }

  const visible = useMemo(() => flights.filter(f => showOld || new Date(f.departure_at) > Date.now()), [flights, showOld]);
  const { type, pickType, types, airOpts, secOpts, shown, selAir, selSec, setSelAir, setSelSec, tog } = useFlightFilter(visible, legs);
  const groups = useMemo(() => groupFlights(shown, legs), [shown, legs]);
  const pnrCount = useMemo(() => { const m = {}; Object.values(pnrs).forEach(p => { if (p) m[p] = (m[p] || 0) + 1; }); return m; }, [pnrs]);

  return (
    <Shell role="admin" title="">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}

      <div className="flights-bar">
        <h1 style={{ margin: 0, fontSize: 22, flex: 'none' }}>✈ Flights</h1>
        <div className="flights-bar-chips">
          <Chip on={type === 'ALL'} onClick={() => pickType('ALL')}>All Types</Chip>
          {types.map(c => <Chip key={c.key} on={type === c.key} onClick={() => pickType(c.key)}>{c.label}</Chip>)}
        </div>
        <div className="flights-bar-end">
          <label style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center', fontWeight: 500, fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={showOld} onChange={e => setShowOld(e.target.checked)} /> Past flights
          </label>
          {selIds.length > 0 && <button className="bad" disabled={busy} onClick={deleteSelected} style={{ minHeight: 38 }}>Delete ({selIds.length})</button>}
          <button className="btn-add-bulk" onClick={openBulk}><BulkIcon /> Add many</button>
          <button className="btn-add" onClick={openNew}><PlusIcon /> Add flight</button>
        </div>
      </div>

      {form && <SingleFlightModal
        form={form} setForm={setForm} editId={editId} setEditId={setEditId}
        hasLegs={hasLegs} line={line} setLine={setLine} fillFromLine={fillFromLine}
        set={set} save={save} busy={busy} error={error} isOwner={isOwner} canCost={canCost}
        sups={sups} setSups={setSups} costs={costs}
      />}

      {bulk && <BulkModal
        bulk={bulk} setBulk={setBulk} setB={setB} parsed={parsed} bulkRows={bulkRows}
        toAdd={toAdd} blocking={blocking} setRowPnr={setRowPnr} saveBulk={saveBulk}
        busy={busy} isOwner={isOwner} canCost={canCost} sups={sups} setSups={setSups}
      />}

      <div className="flights-panel-layout">
        <aside className="flights-filter-panel">
          {airOpts.length > 0 && (
            <div className="ffp-section">
              <FilterList title="Airlines" items={airOpts.map(([k, a]) => [k, a.name])} sel={selAir} onToggle={v => tog(selAir, setSelAir, v)} onAll={all => setSelAir(all ? airOpts.map(([k]) => k) : [])} />
            </div>
          )}
          {secOpts.length > 0 && (
            <div className="ffp-section">
              <FilterList title="Sectors" items={secOpts.map(x => [x, x])} sel={selSec} onToggle={v => tog(selSec, setSelSec, v)} onAll={all => setSelSec(all ? secOpts : [])} />
            </div>
          )}
        </aside>
        <div className="fzmain">
          {groups.length > 0 && <FlightHead admin />}
          {groups.length === 0
            ? <div className="card"><p className="muted">No flights yet. Click “Add flight”.</p></div>
            : groups.map(g => (
              <div className="card fz" key={g.key}>
                <div className="fzhead">
                  <AirlineLogo flightNo={g.flightNo} airline={g.name} size={34} />
                  <span className="fzpath">{(g.path || [g.origin, g.destination]).map(cityName).join(' – ')}</span>
                </div>
                {g.items.map(f => (
                  <AdminRow key={f.id} f={f} legs={legs[f.id]} pnr={pnrs[f.id]}
                    sup={canCost ? costs[f.id]?.supplier : ''} dup={pnrs[f.id] && pnrCount[pnrs[f.id]] > 1}
                    checked={!!sel[f.id]} onSel={() => toggleSel(f.id)}
                    onEdit={() => openEdit(f)} onToggle={() => toggle(f)} onExcel={() => exportPax(f)} />
                ))}
              </div>
            ))
          }
          <p className="muted small" style={{ marginTop: 12 }}>Flights of the same airline and route are grouped. “Hide” stops agents from booking; existing bookings stay safe.</p>
        </div>
      </div>
    </Shell>
  );
}

function AdminRow({ f, legs, pnr, sup, dup, checked, onSel, onEdit, onToggle, onExcel }) {
  return (
    <div className="fzrow fzadmin" style={{ opacity: f.active ? 1 : 0.55 }}>
      <div className="fzcol"><input type="checkbox" style={{ width: 'auto' }} checked={checked} onChange={onSel} /></div>
      <LegCols f={f} legs={legs} />
      <div className="fzcol">
        {pnr ? <div className={dup ? 'neg small' : 'small'}>PNR {pnr}{dup ? ' ⚠ duplicate' : ''}</div> : <div className="neg small">No PNR</div>}
        <div className="small muted">{f.meal || '-'}</div>
        {sup && <div className="small muted">From: {sup}</div>}
      </div>
      <div className="fzcol fzprice"><span>PKR</span> <b>{Number(f.price).toLocaleString('en-US')}</b></div>
      <div className="fzcol small">
        <b>{f.seats_left}</b> / {f.total_seats} seats<br />
        hold {holdText(f.hold_minutes || f.hold_hours * 60)}<br />
        <span className={'badge ' + (f.active ? 'approved' : 'blocked')}>{f.active ? 'Active' : 'Hidden'}</span>
      </div>
      <div className="fzcol">
        <div className="actions" style={{ flexWrap: 'nowrap' }}>
          <button className="ghost" onClick={onEdit}>Edit</button>
          <button className={f.active ? 'warn' : 'ok'} onClick={onToggle}>{f.active ? 'Hide' : 'Show'}</button>
          <button className="ghost" onClick={onExcel}>Excel</button>
        </div>
      </div>
    </div>
  );
}

function SingleFlightModal({ form, setForm, editId, setEditId, hasLegs, line, setLine, fillFromLine, set, save, busy, isOwner, canCost, sups, setSups, costs }) {
  const close = () => { setForm(null); setEditId(null); };
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal modal-lg">
        <button className="modal-close" type="button" onClick={close}>✕</button>
        <form onSubmit={save}>
          <h2 style={{ marginBottom: 20 }}>{editId ? '✏️ Edit Flight' : '✈️ Add New Flight'}</h2>

          {!editId && (
            <div className="modal-section">
              <p className="modal-section-title">Quick Fill from Flight Line</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ marginTop: 0 }}>Paste a flight line</label>
                  <input value={line} onChange={e => setLine(e.target.value)}
                    placeholder="SV725 07NOV ISBMED HK 0950 1205 XC15DF" />
                </div>
                <button type="button" onClick={fillFromLine} style={{ flex: 'none', marginBottom: 1 }}>Fill form</button>
              </div>
              <p className="muted small" style={{ margin: '6px 0 0' }}>
                Format: flight no · date · route · status · dep time · arr time · PNR (optional). Times are saved as airport local time.
              </p>
            </div>
          )}

          {hasLegs && (
            <div className="info" style={{ marginBottom: 16 }}>
              This is a connecting / return trip. Route and times cannot be edited here — add the trip again and hide this one to change flights.
            </div>
          )}

          <div className="modal-section">
            <p className="modal-section-title">Flight Details</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px 14px' }}>
              <div><label>Airline</label><input value={form.airline} onChange={set('airline')} disabled={hasLegs} placeholder="e.g. Saudia" /></div>
              <div><label>Flight Number</label><input value={form.flight_no} onChange={set('flight_no')} disabled={hasLegs} required placeholder="e.g. SV727" /></div>
              <div><label>From (code)</label><input value={form.origin} onChange={set('origin')} disabled={hasLegs} required placeholder="LHE" /></div>
              <div><label>To (code)</label><input value={form.destination} onChange={set('destination')} disabled={hasLegs} required placeholder="JED" /></div>
              <div>
                <label>Departure Date</label>
                <div className="dt-row">
                  <input type="text" inputMode="numeric"
                    value={form.departure_date_text || (form.departure_at ? form.departure_at.slice(0,10) : '')}
                    onChange={e => { const t=e.target.value, iso=parseEasyDate(t); setForm({ ...form, departure_date_text:t, departure_at:iso ? iso+(form.departure_at?.slice(10)||'T00:00') : t }); }}
                    disabled={hasLegs} required placeholder="MM/DD/YYYY" />
                  <input type="date" aria-label="Pick departure date"
                    value={parseEasyDate(form.departure_date_text || form.departure_at?.slice(0,10))}
                    onChange={e => setForm({ ...form, departure_date_text:e.target.value, departure_at:e.target.value+(form.departure_at?.slice(10)||'T00:00') })}
                    disabled={hasLegs} />
                </div>
              </div>
              <div>
                <label>Departure Time</label>
                <input type="time"
                  value={form.departure_at && form.departure_at.length >= 16 ? form.departure_at.slice(11,16) : ''}
                  onChange={e => setForm({ ...form, departure_at:(parseEasyDate(form.departure_date_text||form.departure_at?.slice(0,10))||'')+'T'+e.target.value })}
                  disabled={hasLegs} required />
              </div>
              <div>
                <label>Arrival Date (optional)</label>
                <div className="dt-row">
                  <input type="text" inputMode="numeric"
                    value={form.arrival_date_text || (form.arrival_at ? form.arrival_at.slice(0,10) : '')}
                    onChange={e => { const t=e.target.value, iso=parseEasyDate(t); setForm({ ...form, arrival_date_text:t, arrival_at:iso ? iso+(form.arrival_at?.slice(10)||'T00:00') : t }); }}
                    disabled={hasLegs} placeholder="MM/DD/YYYY" />
                  <input type="date" aria-label="Pick arrival date"
                    value={parseEasyDate(form.arrival_date_text || form.arrival_at?.slice(0,10))}
                    onChange={e => setForm({ ...form, arrival_date_text:e.target.value, arrival_at:e.target.value+(form.arrival_at?.slice(10)||'T00:00') })}
                    disabled={hasLegs} />
                </div>
              </div>
              <div>
                <label>Arrival Time (optional)</label>
                <input type="time"
                  value={form.arrival_at && form.arrival_at.length >= 16 ? form.arrival_at.slice(11,16) : ''}
                  onChange={e => setForm({ ...form, arrival_at:(parseEasyDate(form.arrival_date_text||form.arrival_at?.slice(0,10))||'')+'T'+e.target.value })}
                  disabled={hasLegs} />
              </div>
            </div>
          </div>

          <div className="modal-section">
            <p className="modal-section-title">Pricing & Availability</p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 14px' }}>
              <div><label>Price per Passenger</label><input type="number" min="0" value={form.price} onChange={set('price')} required placeholder="PKR" /></div>
              <div><label>Total Seats</label><input type="number" min="0" value={form.total_seats} onChange={set('total_seats')} required /></div>
              <div>
                <label>Hold Time</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="number" min="1" step="1" value={form.hold_value} onChange={set('hold_value')} required style={{ flex: 1 }} />
                  <select value={form.hold_unit} onChange={set('hold_unit')} style={{ flex: 1 }}>
                    <option value="min">minutes</option>
                    <option value="hr">hours</option>
                  </select>
                </div>
              </div>
              <div><label>Baggage</label><input value={form.baggage} onChange={set('baggage')} placeholder="e.g. 30kg + 7kg hand" /></div>
              <div><label>Meal</label><input value={form.meal} onChange={set('meal')} placeholder="e.g. Hot meal" /></div>
              <div>
                <label>Airline PNR <span style={{ color: '#b91c1c' }}>*</span></label>
                <input value={form.pnr}
                  onChange={e => setForm({ ...form, pnr: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                  maxLength={6} required placeholder="e.g. X7K2MQ"
                  style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '.08em', fontWeight: 700 }} />
              </div>
            </div>
          </div>

          {isOwner && canCost && (
            <div className="modal-section">
              <p className="modal-section-title">Supplier & Cost (Owner only)</p>
              <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
                <div>
                  <label>Bought from (Supplier)</label>
                  <SupplierPick value={form.supplier} onChange={v => setForm({ ...form, supplier: v })}
                    sups={sups} onAdded={x => setSups([...sups, x].sort((a,b) => a.name.localeCompare(b.name)))} />
                </div>
                <div>
                  <label>Buy Price per Seat (optional)</label>
                  <input type="number" min="0" value={form.buy} onChange={set('buy')} placeholder="what you paid" />
                </div>
              </div>
            </div>
          )}

          <p className="muted small">Every flight needs its own unique PNR. It is shown to agents only on their own bookings.</p>
          <div className="modal-actions">
            <button disabled={busy}>{busy ? 'Saving...' : editId ? 'Update Flight' : 'Save Flight'}</button>
            <button type="button" className="ghost" onClick={close}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkModal({ bulk, setBulk, setB, parsed, bulkRows, toAdd, blocking, setRowPnr, saveBulk, busy, isOwner, canCost, sups, setSups }) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setBulk(null); }}>
      <div className="modal modal-lg">
        <button className="modal-close" type="button" onClick={() => setBulk(null)}>✕</button>
        <h2 style={{ marginBottom: 16 }}>📋 Add Many Flights at Once</h2>

        <div className="bulk-hint">
          <b>How to paste flights:</b>
          <ul>
            <li>Paste <b>one flight per line</b>, e.g. <code>SV725 07NOV ISBMED HK 0950 1205</code></li>
            <li>Put an <b>empty line</b> between one trip and the next</li>
            <li>A going flight followed by its return becomes <b>ONE return trip</b></li>
            <li>Connecting flights (PEW→SHJ then SHJ→DMM) are <b>joined automatically</b></li>
            <li>You can also paste a <b>table copied from an agent website</b> (date, sector, flight, time, bag, meal, fare)</li>
            <li>Price, seats, hold time, baggage and meal are <b>shared</b> across all flights below</li>
            <li><b>Each trip needs its own PNR</b> — type it in the table or put it at the end of the line</li>
          </ul>
        </div>

        <textarea rows={6} value={bulk.text} onChange={setB('text')}
          placeholder={'SV725 27OCT ISBMED HK 0955 1235 AB12CD\nG9555 25NOV PEW SHJ 0730 0930\nEK600 25NOV SHJ DMM 1400 1530'}
          style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <label style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>Mode:</label>
          <select style={{ width: 'auto', flex: 1 }} value={bulk.mode} onChange={setB('mode')}>
            <option value="auto">AUTO — blank line = new trip; connecting & return found automatically</option>
            <option value="single">SINGLE — every line is its own flight</option>
            <option value="return">RETURN — going + return pairs</option>
          </select>
        </div>

        {parsed.ignored.length > 0 && <p className="muted small" style={{ marginTop: 6 }}>Ignored {parsed.ignored.length} non-flight line(s).</p>}
        {parsed.agent && <p className="muted small" style={{ marginTop: 6 }}>Agent table detected — price, baggage and meal taken from each row.</p>}

        {(parsed.failed.length > 0 || bulkRows.length > 0) && (
          <div className="scroll" style={{ marginTop: 12 }}>
            <table>
              <thead><tr><th>Reads as</th><th style={{ minWidth: 180 }}>PNR</th></tr></thead>
              <tbody>
                {parsed.failed.map((x, i) => (
                  <tr key={'f'+i}><td><span className="small">{x.line}</span><div className="neg small">{x.error}</div></td><td /></tr>
                ))}
                {bulkRows.map((x, i) => (
                  <tr key={i}>
                    <td>
                      <b>{x.fl.flight_no}</b>
                      <span className="muted small"> · {x.item.length > 1 ? 'Return trip' : x.fl.legs ? 'Connecting' : 'Direct'}{x.fl.price ? ` · PKR ${Number(x.fl.price).toLocaleString('en-US')}` : ''}{x.fl.baggage ? ` · ${x.fl.baggage}` : ''}</span>
                      {x.item.map((j, n) => j.map((l, m) => (
                        <div className="small pos" key={n+'-'+m}>
                          {x.item.length > 1 && m === 0 ? (n === 0 ? 'Going: ' : 'Return: ') : ''}
                          {l.flight_no} {cityName(l.origin)} → {cityName(l.destination)} · {dShort(l.departure_at)} {tm(l.departure_at)}–{tm(l.arrival_at)}{l.minutes != null ? ` (${hm(l.minutes)})` : ''}
                          {l.unknown.length > 0 && <span className="neg"> unknown airport {l.unknown.join(', ')}</span>}
                        </div>
                      )))}
                    </td>
                    <td>
                      <input value={x.pnr} maxLength={6} placeholder="PNR" onChange={e => setRowPnr(x.key, e.target.value)}
                        style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700, letterSpacing: '.06em', ...(x.problem && !x.skip ? { borderColor: '#b91c1c' } : {}) }} />
                      {x.problem && <div className={x.skip ? 'muted small' : 'neg small'}>{x.problem}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-section" style={{ marginTop: 16 }}>
          <p className="modal-section-title">Shared Settings (all flights above)</p>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px 14px' }}>
            <div><label>Price per Passenger</label><input type="number" min="0" value={bulk.price} onChange={setB('price')} placeholder="PKR" /></div>
            <div><label>Total Seats (each flight)</label><input type="number" min="0" value={bulk.total_seats} onChange={setB('total_seats')} /></div>
            <div>
              <label>Hold Time</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" min="1" step="1" value={bulk.hold_value} onChange={setB('hold_value')} required style={{ flex: 1 }} />
                <select value={bulk.hold_unit} onChange={setB('hold_unit')} style={{ flex: 1 }}>
                  <option value="min">minutes</option>
                  <option value="hr">hours</option>
                </select>
              </div>
            </div>
            <div><label>Baggage</label><input value={bulk.baggage} onChange={setB('baggage')} placeholder="e.g. 23+7 KG" /></div>
            <div><label>Meal</label><input value={bulk.meal} onChange={setB('meal')} placeholder="e.g. Yes" /></div>
            {isOwner && canCost && <>
              <div>
                <label>Bought from (Supplier)</label>
                <SupplierPick value={bulk.supplier} onChange={v => setBulk({ ...bulk, supplier: v })}
                  sups={sups} onAdded={x => setSups([...sups, x].sort((a,b) => a.name.localeCompare(b.name)))} />
              </div>
              <div><label>Buy Price per Seat (optional)</label><input type="number" min="0" value={bulk.buy} onChange={setB('buy')} placeholder="same for all" /></div>
            </>}
          </div>
        </div>

        <div className="modal-actions">
          <button disabled={busy || toAdd.length === 0} onClick={saveBulk}>
            {busy ? 'Saving...' : `Add ${toAdd.length || ''} flight(s)`}
          </button>
          <button className="ghost" onClick={() => setBulk(null)}>Cancel</button>
          {(blocking.length > 0 || parsed.failed.length > 0) && (
            <span className="neg small">{blocking.length + parsed.failed.length} line(s) need fixing</span>
          )}
        </div>
      </div>
    </div>
  );
}

function SupplierPick({ value, onChange, sups, onAdded }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    function handler(e) { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = sups.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  async function addSupplier() {
    setErr(''); setBusy(true);
    const nm = newName.trim();
    const { data, error } = await supabase.rpc('owner_save_supplier', { p_id: null, p_name: nm, p_phone: '', p_note: '', p_active: true });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    onAdded({ id: data, name: nm });
    onChange(nm);
    setAdding(false); setNewName(''); setOpen(false); setQuery(nm);
  }

  return (
    <div className="sup-search-wrap" ref={wrapRef}>
      <input
        value={open ? query : value || query}
        placeholder="Search or select supplier..."
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        autoComplete="off"
      />
      {open && (
        <div className="sup-dropdown">
          {filtered.length === 0 && !adding && (
            <div className="sup-opt muted" style={{ cursor: 'default' }}>No suppliers found</div>
          )}
          {value && <div className="sup-opt" onClick={() => { onChange(''); setQuery(''); setOpen(false); }}>
            <span style={{ color: '#94a3b8' }}>✕</span> Clear selection
          </div>}
          {filtered.map(s => (
            <div key={s.id} className="sup-opt" onClick={() => { onChange(s.name); setQuery(s.name); setOpen(false); }}>
              {s.name}
            </div>
          ))}
          {!adding && (
            <div className="sup-opt add-new" onClick={() => { setAdding(true); setNewName(query); }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Add new supplier
            </div>
          )}
          {adding && (
            <div style={{ padding: '8px 10px', borderTop: '1px solid #e5eaf2' }}>
              <input value={newName} maxLength={80} placeholder="New supplier name"
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSupplier(); } }}
                autoFocus />
              {err && <div className="neg small" style={{ marginTop: 4 }}>{err}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button type="button" disabled={busy || newName.trim().length < 2} onClick={addSupplier}
                  style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}>
                  {busy ? '...' : 'Add supplier'}
                </button>
                <button type="button" className="ghost" onClick={() => { setAdding(false); setErr(''); }}
                  style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
