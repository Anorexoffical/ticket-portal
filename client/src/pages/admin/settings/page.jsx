import { useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';

// Main admin only: upload the agency logo. It becomes the browser tab icon.
export default function Settings() {
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [v, setV] = useState(Date.now());
  const [hr, setHr] = useState(null);
  useEffect(() => { supabase.from('hold_rules').select('*').eq('id', 1).single().then(({ data }) => { if (data) setHr({ open: data.open_time.slice(0, 5), close: data.close_time.slice(0, 5), day: String(data.day_hold_max), near: String(data.near_hold_max) }); }); }, []);
  async function saveRules(e) {
    e.preventDefault(); setError(''); setMsg('');
    const { error } = await supabase.rpc('owner_set_hold_rules', { p_open: hr.open, p_close: hr.close, p_day: parseInt(hr.day, 10), p_near: parseInt(hr.near, 10) });
    if (error) setError(error.message); else setMsg('Hold rules saved. They apply to new bookings.');
  }
  const url = `/api/uploads/file?path=branding/logo.png&v=${v}`;

  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = '';
    setError(''); setMsg('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('Please choose a PNG, JPG or WEBP picture.'); return; }
    if (file.size > 1024 * 1024) { setError('Picture is too big (max 1 MB).'); return; }
    setBusy(true);
    const { error } = await supabase.storage.upload('branding/logo.png', file);
    setBusy(false);
    if (error) { setError(error.message); return; }
    setV(Date.now());
    setMsg('Logo saved. The tab icon updates after you refresh (it can take up to an hour on other computers).');
  }

  return (
    <Shell role="owner" title="Logo / Settings">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      <div className="card">
        <h2>Agency logo (browser tab icon)</h2>
        <p className="muted small">Use a square picture (for example 256 x 256), PNG, JPG or WEBP, up to 1 MB.</p>
        <div className="actions" style={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" width="64" height="64" style={{ borderRadius: 12, background: '#f4f7fc', objectFit: 'contain' }} onError={e => { e.currentTarget.style.visibility = 'hidden'; }} onLoad={e => { e.currentTarget.style.visibility = 'visible'; }} />
          <label className="ghost" style={{ margin: 0, padding: '9px 14px', borderRadius: 8, cursor: 'pointer', background: '#1559d6', color: '#fff' }}>
            {busy ? 'Uploading...' : 'Choose logo'}
            <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={upload} disabled={busy} />
          </label>
        </div>
      </div>
      {hr && (
        <form className="card" onSubmit={saveRules}>
          <h2>Smart hold rules</h2>
          <p className="muted small">Time is Pakistan time. A booking made outside office hours starts its hold when the office opens. If the flight leaves soon, the hold is shortened so the seat is not blocked.</p>
          <div className="grid">
            <div><label>Office opens</label><input type="time" value={hr.open} onChange={e => setHr({ ...hr, open: e.target.value })} required /></div>
            <div><label>Last time to confirm (home included)</label><input type="time" value={hr.close} onChange={e => setHr({ ...hr, close: e.target.value })} required /></div>
            <div><label>Flight in 1 to 7 days: hold at most (minutes)</label><input type="number" min="1" value={hr.day} onChange={e => setHr({ ...hr, day: e.target.value })} required /></div>
            <div><label>Flight in under 24 hours: hold at most (minutes)</label><input type="number" min="1" value={hr.near} onChange={e => setHr({ ...hr, near: e.target.value })} required /></div>
          </div>
          <button type="submit" style={{ marginTop: 12 }}>Save hold rules</button>
        </form>
      )}
    </Shell>
  );
}
