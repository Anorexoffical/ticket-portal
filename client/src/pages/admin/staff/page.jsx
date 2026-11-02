import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';

// ── permission modules ───────────────────────────────────────────────────────
const MODULES = [
  { key: 'flights',   label: '✈️  Flights',   actions: ['view', 'add', 'edit', 'hide'] },
  { key: 'bookings',  label: '📋  Bookings',  actions: ['view', 'add', 'edit', 'cancel'] },
  { key: 'payments',  label: '💳  Payments',  actions: ['view', 'add', 'edit'] },
  { key: 'accounts',  label: '🏦  Accounts',  actions: ['view', 'edit'] },
  { key: 'ledger',    label: '📒  Ledger',    actions: ['view'] },
  { key: 'agents',    label: '👥  Agents',    actions: ['view', 'add', 'edit'] },
  { key: 'suppliers', label: '📦  Suppliers', actions: ['view', 'add', 'edit'] },
  { key: 'sales',     label: '📊  Sales',     actions: ['view'] },
  { key: 'umrah',     label: '🕌  Umrah',     actions: ['view', 'add', 'edit'] },
  { key: 'seeProfit', label: '💰  See Profit', actions: ['view'] },
];

function emptyPerms() {
  const p = {};
  MODULES.forEach(m => { p[m.key] = {}; m.actions.forEach(a => { p[m.key][a] = false; }); });
  return p;
}

const EMPTY_FORM = { name: '', email: '', password: '' };

// ── helpers ──────────────────────────────────────────────────────────────────
function allChecked(perms, mod) {
  return mod.actions.every(a => perms[mod.key]?.[a]);
}
function toggleAll(perms, mod, val) {
  const next = { ...perms, [mod.key]: { ...perms[mod.key] } };
  mod.actions.forEach(a => { next[mod.key][a] = val; });
  return next;
}
function toggleOne(perms, modKey, action, val) {
  return { ...perms, [modKey]: { ...perms[modKey], [action]: val } };
}
function countGranted(perms) {
  let n = 0;
  MODULES.forEach(m => m.actions.forEach(a => { if (perms[m.key]?.[a]) n++; }));
  return n;
}

// ── component ────────────────────────────────────────────────────────────────
export default function Staff() {
  const [list, setList]   = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState(EMPTY_FORM);
  const [perms, setPerms] = useState(emptyPerms);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,agency_name,permissions,umrah_access,can_see_profit')
      .eq('role', 'staff')
      .order('created_at');
    if (error) setError(error.message); else setList(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setPerms(emptyPerms());
    setError('');
    setModal({ mode: 'create' });
  }
  function openEdit(s) {
    const saved = s.permissions || {};
    const p = emptyPerms();
    MODULES.forEach(m => m.actions.forEach(a => {
      if (saved[m.key]?.[a] !== undefined) p[m.key][a] = !!saved[m.key][a];
    }));
    setForm({ name: s.agency_name || '', email: s.email, password: '' });
    setPerms(p);
    setError('');
    setModal({ mode: 'edit', staff: s });
  }
  function closeModal() { setModal(null); setError(''); }

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    const payload = { p_name: form.name, p_permissions: perms };
    let res;
    if (modal.mode === 'create') {
      res = await supabase.rpc('owner_create_staff', { ...payload, p_email: form.email, p_password: form.password });
    } else {
      res = await supabase.rpc('owner_update_staff', { ...payload, p_id: modal.staff.id, p_password: form.password });
    }
    setBusy(false);
    if (res.error) { setError(res.error.message); return; }
    setMsg(modal.mode === 'create' ? 'Staff member created.' : 'Staff member updated.');
    closeModal(); load();
  }

  async function remove(s) {
    if (!confirm(`Remove ${s.email} from staff?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('owner_remove_staff', { p_id: s.id });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setMsg('Staff member removed.'); load();
  }

  return (
    <Shell role="owner" title="Staff">
      {msg   && <div className="good">{msg}</div>}
      {!modal && error && <div className="error">{error}</div>}

      {/* ── header card ── */}
      <div className="card" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ margin:0 }}>Staff Members</h2>
          <p className="muted small" style={{ margin:'4px 0 0' }}>
            Staff can access only the modules and actions you allow below.
          </p>
        </div>
        <button style={S.btn} onClick={openCreate}>＋ Create Staff</button>
      </div>

      {/* ── staff table ── */}
      <div className="card">
        {list.length === 0 ? <p className="muted">No staff yet.</p> : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>Permissions</th><th></th>
                </tr>
              </thead>
              <tbody>
                {list.map(s => {
                  const p = s.permissions || {};
                  const granted = MODULES.flatMap(m =>
                    m.actions.filter(a => p[m.key]?.[a]).map(a => `${m.label.split('  ')[1]} ${a}`)
                  );
                  return (
                    <tr key={s.id}>
                      <td style={{ fontWeight:600 }}>{s.agency_name || '—'}</td>
                      <td style={{ color:'#555' }}>{s.email}</td>
                      <td>
                        {granted.length === 0
                          ? <span style={S.pillOff}>No access</span>
                          : <span style={S.pillOn}>{granted.length} permission{granted.length !== 1 ? 's' : ''}</span>
                        }
                      </td>
                      <td style={{ display:'flex', gap:6 }}>
                        <button style={S.editBtn} disabled={busy} onClick={() => openEdit(s)}>Edit</button>
                        <button className="bad" disabled={busy} onClick={() => remove(s)}>Remove</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── modal ── */}
      {modal && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={S.dialog}>

            {/* header */}
            <div style={S.dialogHead}>
              <div>
                <div style={S.dialogTitle}>
                  {modal.mode === 'create' ? '＋ Create Staff Member' : '✏️ Edit Staff Member'}
                </div>
                <div style={S.dialogSub}>
                  {countGranted(perms)} permission{countGranted(perms) !== 1 ? 's' : ''} granted
                </div>
              </div>
              <button onClick={closeModal} style={S.closeBtn} aria-label="Close">✕</button>
            </div>

            {error && <div className="error" style={{ margin:'0 0 14px' }}>{error}</div>}

            <form onSubmit={submit}>
              {/* ── account fields ── */}
              <div style={S.section}>
                <div style={S.sectionTitle}>👤 Account Details</div>
                <div style={S.fieldGrid}>
                  <div>
                    <label style={S.lbl}>Full Name</label>
                    <input style={S.inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Ahmed Khan" />
                  </div>
                  <div>
                    <label style={S.lbl}>Email {modal.mode === 'create' ? '(username)' : ''}</label>
                    {modal.mode === 'create'
                      ? <input style={S.inp} type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="staff@email.com" />
                      : <input style={{ ...S.inp, background:'#f4f6fa', color:'#888' }} value={form.email} disabled />
                    }
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={S.lbl}>
                      {modal.mode === 'create' ? 'Password' : 'New Password'}
                      {modal.mode === 'edit' && <span style={{ fontWeight:400, color:'#aaa', marginLeft:6 }}>(leave blank to keep current)</span>}
                    </label>
                    <input style={S.inp} type="password" required={modal.mode === 'create'} minLength={8}
                      value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder={modal.mode === 'create' ? 'Minimum 8 characters' : '••••••••'} />
                  </div>
                </div>
              </div>

              {/* ── permissions ── */}
              <div style={S.section}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={S.sectionTitle}>🔐 Module Permissions</div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="button" style={S.miniBtn} onClick={() => {
                      let p = emptyPerms();
                      MODULES.forEach(m => { p = toggleAll(p, m, true); });
                      setPerms(p);
                    }}>Grant All</button>
                    <button type="button" style={{ ...S.miniBtn, background:'#fff0f0', color:'#c0392b', borderColor:'#f5c6c6' }} onClick={() => setPerms(emptyPerms())}>Revoke All</button>
                  </div>
                </div>

                <div style={S.moduleGrid}>
                  {MODULES.map(mod => {
                    const all = allChecked(perms, mod);
                    return (
                      <div key={mod.key} style={S.moduleCard}>
                        {/* module header row */}
                        <div style={S.moduleHead}>
                          <span style={S.moduleLabel}>{mod.label}</span>
                          <label style={S.toggleWrap} title={all ? 'Revoke all' : 'Grant all'}>
                            <input type="checkbox" checked={all}
                              onChange={e => setPerms(p => toggleAll(p, mod, e.target.checked))}
                              style={{ display:'none' }} />
                            <span style={{ ...S.toggle, ...(all ? S.toggleOn : {}) }}>
                              <span style={{ ...S.toggleThumb, ...(all ? S.toggleThumbOn : {}) }} />
                            </span>
                          </label>
                        </div>
                        {/* action checkboxes */}
                        <div style={S.actionRow}>
                          {mod.actions.map(action => {
                            const checked = !!perms[mod.key]?.[action];
                            return (
                              <label key={action} style={{ ...S.actionChip, ...(checked ? S.actionChipOn : {}) }}>
                                <input type="checkbox" checked={checked}
                                  onChange={e => setPerms(p => toggleOne(p, mod.key, action, e.target.checked))}
                                  style={{ display:'none' }} />
                                {checked ? '✓ ' : ''}{action}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── footer ── */}
              <div style={S.footer}>
                <button type="button" onClick={closeModal} style={S.cancelBtn}>Cancel</button>
                <button type="submit" disabled={busy} style={S.btn}>
                  {busy ? 'Saving…' : modal.mode === 'create' ? '＋ Create Staff' : '✓ Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ── styles ───────────────────────────────────────────────────────────────────
const S = {
  btn:       { background:'#0E4655', color:'#CAB3FF', border:'none', borderRadius:9, padding:'10px 22px', fontWeight:700, fontSize:14, cursor:'pointer', whiteSpace:'nowrap' },
  editBtn:   { background:'#f0f4ff', color:'#0E4655', border:'1px solid #c8d8e8', borderRadius:7, padding:'5px 14px', fontWeight:600, fontSize:13, cursor:'pointer' },
  cancelBtn: { background:'transparent', color:'#666', border:'1px solid #ddd', borderRadius:9, padding:'10px 20px', fontWeight:600, fontSize:14, cursor:'pointer' },
  closeBtn:  { background:'rgba(23,32,39,.07)', border:'none', borderRadius:99, width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#555', fontSize:16, flexShrink:0 },
  miniBtn:   { background:'#f0f7ff', color:'#0E4655', border:'1px solid #c8d8e8', borderRadius:7, padding:'5px 12px', fontWeight:600, fontSize:12, cursor:'pointer' },
  pillOn:    { background:'#e6f9f0', color:'#0d6b38', borderRadius:99, padding:'3px 12px', fontSize:12, fontWeight:700 },
  pillOff:   { background:'#f4f4f4', color:'#aaa', borderRadius:99, padding:'3px 12px', fontSize:12, fontWeight:600 },

  overlay:   { position:'fixed', inset:0, background:'rgba(14,22,28,.6)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(3px)' },
  dialog:    { background:'#fff', borderRadius:18, width:'100%', maxWidth:720, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,.25)', display:'flex', flexDirection:'column' },

  dialogHead: { display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, padding:'24px 28px 0', marginBottom:20 },
  dialogTitle:{ fontSize:20, fontWeight:800, color:'#172027' },
  dialogSub:  { fontSize:13, color:'#CAB3FF', fontWeight:600, marginTop:2 },

  section:     { margin:'0 28px 20px', background:'#faf7f2', border:'1px solid #e8e0f5', borderRadius:12, padding:'18px 20px' },
  sectionTitle:{ fontSize:13, fontWeight:800, color:'#0E4655', letterSpacing:'.04em', textTransform:'uppercase', marginBottom:14 },

  fieldGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px 16px' },
  lbl:       { display:'block', fontWeight:600, fontSize:12, color:'#555', marginBottom:5, textTransform:'uppercase', letterSpacing:'.03em' },
  inp:       { width:'100%', boxSizing:'border-box', border:'1px solid #d0d8e8', borderRadius:8, padding:'9px 12px', fontSize:14, outline:'none' },

  moduleGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 },
  moduleCard: { background:'#fff', border:'1px solid #e6ebf3', borderRadius:10, padding:'12px 14px' },
  moduleHead: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  moduleLabel:{ fontSize:13, fontWeight:700, color:'#172027' },

  toggle:      { display:'inline-flex', width:36, height:20, borderRadius:99, background:'#dde3ee', position:'relative', cursor:'pointer', transition:'background .2s', flexShrink:0 },
  toggleOn:    { background:'#0E4655' },
  toggleThumb: { position:'absolute', top:3, left:3, width:14, height:14, borderRadius:99, background:'#fff', transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.2)' },
  toggleThumbOn:{ left:19 },
  toggleWrap:  { cursor:'pointer', display:'flex', alignItems:'center' },

  actionRow:   { display:'flex', flexWrap:'wrap', gap:6 },
  actionChip:  { padding:'4px 10px', borderRadius:99, border:'1px solid #dde3ee', fontSize:12, fontWeight:600, cursor:'pointer', color:'#888', background:'#f7f9fc', userSelect:'none', transition:'all .15s' },
  actionChipOn:{ background:'#e8f5e9', color:'#1b6b3a', borderColor:'#a8d5b5', fontWeight:700 },

  footer: { display:'flex', justifyContent:'flex-end', gap:10, padding:'16px 28px 24px', borderTop:'1px solid #f0f0f0', marginTop:4 },
};
