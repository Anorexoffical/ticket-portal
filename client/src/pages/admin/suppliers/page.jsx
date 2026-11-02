import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { money } from '@/lib/format';
import Link from 'next/link';

export default function Suppliers() {
  return <Shell role="admin" title="Suppliers">{p => <S owner={p?.role === 'admin' || p?.role === 'superadmin'} />}</Shell>;
}

const EMPTY = { id: null, name: '', phone: '', note: '', active: true };

function S({ owner }) {
  const [list, setList]   = useState(null);
  const [costs, setCosts] = useState([]);
  const [flights, setFlights] = useState({});
  const [form, setForm]   = useState(null);   // null = list view, object = form view
  const [error, setError] = useState('');
  const [msg, setMsg]     = useState('');
  const [busy, setBusy]   = useState(false);

  const load = useCallback(async () => {
    const [s, c, f] = await Promise.all([
      supabase.from('suppliers').select('*'),
      supabase.from('flight_cost').select('flight_id,supplier,buy_price'),
      supabase.from('flights').select('id,total_seats'),
    ]);
    if (s.error) { setError(s.error.message); setList([]); return; }
    const sorted = [...(s.data || [])].sort((a, b) => a.name.localeCompare(b.name));
    setList(sorted);
    setCosts(c.data || []);
    setFlights(Object.fromEntries((f.data || []).map(x => [x.id, x])));
  }, []);

  useEffect(() => { load(); }, [load]);

  // per-supplier stats from flight costs
  const stats = {};
  costs.forEach(c => {
    const k = (c.supplier || '').trim().toLowerCase();
    if (!k) return;
    const seats = Number(flights[c.flight_id]?.total_seats) || 0;
    const o = (stats[k] = stats[k] || { flights: 0, seats: 0, value: 0 });
    o.flights += 1; o.seats += seats; o.value += seats * (Number(c.buy_price) || 0);
  });

  function openAdd() { setForm({ ...EMPTY }); setError(''); setMsg(''); }
  function openEdit(x) { setForm({ id: x.id, name: x.name, phone: x.phone || '', note: x.note || '', active: x.active }); setError(''); setMsg(''); window.scrollTo(0, 0); }
  function cancel() { setForm(null); setError(''); }

  async function save(e) {
    e.preventDefault(); setError(''); setMsg(''); setBusy(true);
    const { error } = await supabase.rpc('owner_save_supplier', {
      p_id: form.id || null,
      p_name: form.name.trim(),
      p_phone: form.phone.trim(),
      p_note: form.note.trim(),
      p_active: form.active,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg(form.id ? 'Supplier updated.' : 'Supplier added.');
    setForm(null);
    load();
  }

  async function remove(x) {
    if (!confirm(`Delete supplier "${x.name}"? This cannot be undone.`)) return;
    setError(''); setMsg('');
    const { error } = await supabase.from('suppliers').delete().eq('id', x.id);
    if (error) setError(error.message);
    else { setMsg(`"${x.name}" deleted.`); load(); }
  }

  async function toggleActive(x) {
    const { error } = await supabase.from('suppliers').update({ active: !x.active }).eq('id', x.id);
    if (error) setError(error.message); else load();
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg   && <div className="good">{msg}</div>}

      {/* ── ADD / EDIT FORM ── */}
      {form && (
        <form className="card" onSubmit={save}>
          <h2 style={{ marginTop: 0 }}>{form.id ? 'Edit supplier' : 'Add supplier'}</h2>
          <div className="grid">
            <div>
              <label>Name *</label>
              <input value={form.name} required maxLength={80} autoFocus
                placeholder="e.g. Al Safa Travels"
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Phone / WhatsApp (optional)</label>
              <input value={form.phone} maxLength={40}
                placeholder="+92 300 0000000"
                onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label>Note (optional)</label>
              <input value={form.note} maxLength={300}
                placeholder="e.g. pays within 7 days"
                onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })} />
            Show in supplier dropdown when adding flights
          </label>
          {form.id && <p className="muted small" style={{ marginTop: 8 }}>Flights saved earlier keep the name they were saved with, even if you change it here.</p>}
          <div className="actions" style={{ marginTop: 14 }}>
            <button disabled={busy}>{busy ? 'Saving...' : 'Save'}</button>
            <button type="button" className="ghost" onClick={cancel}>Cancel</button>
          </div>
        </form>
      )}

      {/* ── LIST ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Suppliers</h2>
          {owner && !form && <Link href="/admin/suppliers/new" className="button">+ Add supplier</Link>}
        </div>

        {!list ? (
          <p className="muted">Loading...</p>
        ) : list.length === 0 ? (
          <p className="muted">No suppliers yet.{owner ? ' Click "+ Add supplier" to create one.' : ''}</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Note</th>
                  <th>Flights</th>
                  <th>Seats</th>
                  <th>Total value</th>
                  <th>Status</th>
                  {owner && <th></th>}
                </tr>
              </thead>
              <tbody>
                {list.map(x => {
                  const st = stats[x.name.trim().toLowerCase()] || { flights: 0, seats: 0, value: 0 };
                  return (
                    <tr key={x.id} style={{ opacity: x.active ? 1 : 0.55 }}>
                      <td><b>{x.name}</b></td>
                      <td>{x.phone || <span className="muted">—</span>}</td>
                      <td>{x.note  || <span className="muted">—</span>}</td>
                      <td>{st.flights}</td>
                      <td>{st.seats}</td>
                      <td>{st.value ? money(st.value) : <span className="muted">—</span>}</td>
                      <td>
                        <span className={'badge ' + (x.active ? 'approved' : 'blocked')}>
                          {x.active ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      {owner && (
                        <td>
                          <div className="actions">
                            <button className="ghost" onClick={() => openEdit(x)}>Edit</button>
                            <button className="warn"  onClick={() => toggleActive(x)}>{x.active ? 'Hide' : 'Show'}</button>
                            <button className="bad"   onClick={() => remove(x)}>Delete</button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted small" style={{ margin: '10px 0 0' }}>
          Totals are calculated from the buy prices entered on flights.
        </p>
      </div>
    </>
  );
}
