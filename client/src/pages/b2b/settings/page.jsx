import { useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';

export default function Settings() {
  return <Shell role="agent" title="Settings">{p => <Form p={p} />}</Shell>;
}

function Form({ p }) {
  const [f, setF] = useState({ agency_name: p.agency_name || '', phone: p.phone || '', whatsapp: p.whatsapp || '', delivery_pref: p.delivery_pref, owner_name: p.owner_name || '', city: p.city || '', address: p.address || '', license_no: p.license_no || '', voucher_style: p.voucher_style || 'detailed' });
  const [diff, setDiff] = useState(!!p.whatsapp && p.whatsapp !== p.phone);  // WhatsApp on a different number?
  const [pw, setPw] = useState('');
  const [v, setV] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const logoPath = `agents/${p.id}.png`;
  const logoUrl = `/api/uploads/file?path=branding/${logoPath}&v=${v}`;
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault(); setMsg(''); setError('');
    const payload = { ...f, whatsapp: diff && f.whatsapp.trim() ? f.whatsapp : f.phone };
    const { error } = await supabase.from('profiles').update(payload).eq('id', p.id);
    if (error) setError(error.message); else setMsg('Saved.');
  }
  async function uploadLogo(e) {
    const file = e.target.files[0];
    e.target.value = '';
    setMsg(''); setError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Please choose a PNG, JPG or WEBP picture.'); return; }
    if (file.size > 1024 * 1024) { setError('Picture is too big (max 1 MB).'); return; }
    setBusy(true);
    const { error } = await supabase.storage.upload(`branding/${logoPath}`, file);
    setBusy(false);
    if (error) { setError(error.message); return; }
    setV(Date.now()); setMsg('Logo saved. It will show on your booking confirmation PDFs.');
  }
  async function removeLogo() {
    setMsg(''); setError(''); setBusy(true);
    const { error } = await supabase.storage.remove([`branding/${logoPath}`]);
    setBusy(false);
    if (error) { setError(error.message); return; }
    setV(Date.now()); setMsg('Logo removed.');
  }
  async function changePw(e) {
    e.preventDefault(); setMsg(''); setError('');
    if (pw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) setError(error.message); else { setMsg('Password changed.'); setPw(''); }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      <form className="card" onSubmit={save}>
        <h2>Agency details</h2>
        <div className="grid">
          <div><label>Agency name</label><input value={f.agency_name} onChange={set('agency_name')} required /></div>
          <div>
            <label>Phone / WhatsApp number</label><input value={f.phone} onChange={set('phone')} required />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={diff} onChange={e => setDiff(e.target.checked)} /> WhatsApp is on a different number
            </label>
            {diff && <input value={f.whatsapp} onChange={set('whatsapp')} placeholder="WhatsApp number" />}
          </div>
          <div><label>Send my tickets by</label>
            <select value={f.delivery_pref} onChange={set('delivery_pref')}>
              <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="both">Both</option>
            </select>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 8 }}>
          <div><label>Owner / contact person (optional)</label><input value={f.owner_name} maxLength={80} onChange={set('owner_name')} placeholder="e.g. Ali Khan" /></div>
          <div><label>City (optional)</label><input value={f.city} maxLength={80} onChange={set('city')} placeholder="e.g. Peshawar" /></div>
          <div><label>Address (optional)</label><input value={f.address} maxLength={250} onChange={set('address')} placeholder="Office address" /></div>
          <div><label>Licence / NTN number (optional)</label><input value={f.license_no} maxLength={60} onChange={set('license_no')} /></div>
          <div><label>Booking confirmation PDF style</label>
            <select value={f.voucher_style} onChange={set('voucher_style')}>
              <option value="detailed">Detailed (flight time, stops, transit)</option>
              <option value="compact">Compact (short, one page)</option>
            </select>
          </div>
        </div>
        <p className="muted small">Login email: {p.email}</p>
        <button>Save</button>
      </form>
      <div className="card">
        <h2>Your logo (shown on your booking confirmation PDF)</h2>
        <p className="muted small">Square picture, PNG, JPG or WEBP, up to 1 MB.</p>
        <div className="actions" style={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="" width="64" height="64" style={{ borderRadius: 12, background: '#f4f7fc', objectFit: 'contain', visibility: 'hidden' }} onLoad={e => { e.currentTarget.style.visibility = 'visible'; }} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
          <label className="ghost" style={{ margin: 0, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', background: '#1559d6', color: '#fff' }}>
            {busy ? 'Please wait...' : 'Choose logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={uploadLogo} disabled={busy} />
          </label>
          <button type="button" className="ghost" disabled={busy} onClick={removeLogo}>Remove logo</button>
        </div>
      </div>
      <form className="card" onSubmit={changePw}>
        <h2>Change password</h2>
        <label>New password (min 8 characters)</label>
        <input type="password" value={pw} onChange={e => setPw(e.target.value)} />
        <button style={{ marginTop: 12 }}>Change password</button>
      </form>
    </>
  );
}
