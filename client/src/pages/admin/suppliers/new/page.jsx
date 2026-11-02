import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';

export default function AddSupplier() {
  return <Shell role="admin" title="Add Supplier">{() => <Form />}</Shell>;
}

const EMPTY = { name: '', phone: '', note: '', active: true };

function Form() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const { error } = await supabase.rpc('owner_save_supplier', {
      p_id: null,
      p_name: form.name.trim(),
      p_phone: form.phone.trim(),
      p_note: form.note.trim(),
      p_active: form.active,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    navigate('/admin/suppliers');
  }

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Add new supplier</h2>
      {error && <div className="error">{error}</div>}
      <form onSubmit={save}>
        <div className="grid">
          <div>
            <label>Name *</label>
            <input value={form.name} onChange={set('name')} required maxLength={80} placeholder="e.g. Al Safa Travels" autoFocus />
          </div>
          <div>
            <label>Phone / WhatsApp (optional)</label>
            <input value={form.phone} onChange={set('phone')} maxLength={40} placeholder="+92 300 0000000" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label>Note (optional)</label>
            <input value={form.note} onChange={set('note')} maxLength={300} placeholder="e.g. pays within 7 days" />
          </div>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400, marginTop: 12 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
          Show in supplier dropdown when adding flights
        </label>
        <div className="actions" style={{ marginTop: 16 }}>
          <button disabled={busy}>{busy ? 'Saving...' : 'Save supplier'}</button>
          <button type="button" className="ghost" onClick={() => navigate('/admin/suppliers')}>Cancel</button>
        </div>
      </form>
    </div>
  );
}
