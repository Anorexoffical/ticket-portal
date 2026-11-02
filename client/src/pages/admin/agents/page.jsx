import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { dOnly, money } from '@/lib/format';
import { MODULES } from '@/lib/config';

export default function AdminAgents() {
  const [agents, setAgents] = useState([]);
  const [tab, setTab] = useState('pending');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState(null);
  const emptyAgent = { id: null, email: '', agency_name: '', owner_name: '', phone: '', whatsapp: '', password: '', status: 'approved' };

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'agent').order('created_at', { ascending: false });
    if (error) setError(error.message); else setAgents(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id, status) {
    if (status === 'blocked' && !confirm('Block this agent? They will not be able to book.')) return;
    setBusyId(id); setError('');
    const { error } = await supabase.rpc('admin_set_agent_status', { p_agent: id, p_status: status });
    if (error) setError(error.message);
    await load(); setBusyId(null);
  }

  async function saveAgent(e) {
    e.preventDefault(); setError(''); setBusyId('form');
    const { error } = await supabase.rpc('admin_save_agent', {
      p_id: form.id, p_email: form.email, p_agency_name: form.agency_name, p_owner_name: form.owner_name,
      p_phone: form.phone, p_whatsapp: form.whatsapp, p_password: form.password,
    });
    setBusyId(null);
    if (error) { setError(error.message); return; }
    setForm(null); await load();
  }

  async function deleteAgent(a) {
    if (!confirm(`Delete agent "${a.agency_name || a.email}"?`)) return;
    setBusyId(a.id); setError('');
    const { error } = await supabase.rpc('admin_delete_agent', { p_agent: a.id });
    setBusyId(null);
    if (error) setError(error.message); else await load();
  }

  const shown = agents.filter(a => a.status === tab);
  const count = s => agents.filter(a => a.status === s).length;

  return (
    <Shell role="admin" title="Agents">{p => { const owner = ['admin', 'superadmin'].includes(p?.role); return (
      <div className="card">
        <div className="tabs">
          {['pending', 'approved', 'blocked'].map(s => (
            <button key={s} className={tab === s ? '' : 'ghost'} onClick={() => setTab(s)}>{s[0].toUpperCase() + s.slice(1)} ({count(s)})</button>
          ))}
          <button className="ok" type="button" onClick={() => setForm({ ...emptyAgent })}>+ Add agent</button>
        </div>
        {error && <div className="error">{error}</div>}
        {form && (
          <form className="panel" onSubmit={saveAgent}>
            <h2>{form.id ? 'Edit agent' : 'Add agent'}</h2>
            <div className="grid">
              <div><label>Email *</label><input type="email" value={form.email} disabled={!!form.id} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
              <div><label>Agency name *</label><input value={form.agency_name} onChange={e => setForm({ ...form, agency_name: e.target.value })} required /></div>
              <div><label>Owner name</label><input value={form.owner_name} onChange={e => setForm({ ...form, owner_name: e.target.value })} /></div>
              <div><label>Phone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label>WhatsApp</label><input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} /></div>
              <div><label>{form.id ? 'New password (optional)' : 'Password (optional)'}</label><input type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            </div>
            <div className="actions"><button disabled={busyId === 'form'}>{busyId === 'form' ? 'Saving...' : 'Save agent'}</button><button type="button" className="ghost" onClick={() => setForm(null)}>Cancel</button></div>
          </form>
        )}
        {shown.length === 0 ? <p className="muted">No {tab} agents.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Agency</th><th>Phone</th><th>WhatsApp</th><th>Email</th><th>Joined</th><th>Discount / ticket</th><th></th></tr></thead>
            <tbody>
              {shown.map(a => (
                <tr key={a.id}>
                  <td><b>{a.agency_name}</b>{a.owner_name && <div className="small">Owner: {a.owner_name}</div>}</td><td>{a.phone}</td><td>{a.whatsapp}</td><td>{a.email}</td><td>{dOnly(a.created_at)}</td>
                  <td>{a.status === 'approved' ? <Disc a={a} owner={owner} onSaved={load} setError={setError} /> : '-'}</td>
                  <td><div className="actions">
                    <button className="ghost" onClick={() => setForm({ id: a.id, email: a.email, agency_name: a.agency_name || '', owner_name: a.owner_name || '', phone: a.phone || '', whatsapp: a.whatsapp || '', password: '' })}>Edit</button>
                    {a.status !== 'approved' && <button className="ok" disabled={busyId === a.id} onClick={() => setStatus(a.id, 'approved')}>Approve</button>}
                    {a.status !== 'blocked' && <button className="bad" disabled={busyId === a.id} onClick={() => setStatus(a.id, 'blocked')}>Block</button>}
                    <button className="bad" disabled={busyId === a.id} onClick={() => deleteAgent(a)}>Delete</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    ); }}</Shell>
  );
}

// owner types the PKR discount that agent gets on every passenger ticket
function Disc({ a, owner, onSaved, setError }) {
  const [v, setV] = useState(String(Number(a.discount_per_ticket) || 0));
  const [busy, setBusy] = useState(false);
  if (!owner) return <span>{money(a.discount_per_ticket || 0)}</span>;
  async function save() {
    setBusy(true); setError('');
    const { error } = await supabase.rpc('owner_set_agent_discount', { p_agent: a.id, p_amount: Number(v) || 0 });
    if (error) setError(error.message); else await onSaved();
    setBusy(false);
  }
  const changed = Number(v) !== Number(a.discount_per_ticket || 0);
  return (
    <div className="actions" style={{ flexWrap: 'nowrap' }}>
      <input type="number" min="0" step="100" style={{ width: 90 }} value={v} onChange={e => setV(e.target.value)} />
      <button className={changed ? 'ok' : 'ghost'} disabled={busy || !changed} onClick={save}>Save</button>
    </div>
  );
}
