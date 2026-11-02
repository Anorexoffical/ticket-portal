import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import DueReminders from '@/components/DueReminders';
import BankList from '@/components/BankList';
import useBanks from '@/lib/useBanks';
import { bankText, waShare } from '@/lib/pay';
import { effectiveStatus, money } from '@/lib/format';
import { AGENCY_NAME } from '@/lib/config';

const BLANK = { bank_name: '', account_title: '', account_no: '', iban: '', branch: '', note: '' };

// Accounts: what is owed, who to remind, money received, and the bank accounts agents should pay to.
export default function Accounts() {
  return <Shell role="admin" title="Accounts">{p => <Body owner={p.role === 'admin'} />}</Shell>;
}

function Body({ owner }) {
  const [pay, setPay] = useState([]);
  const [due, setDue] = useState([]);
  const { banks, reload } = useBanks(true);
  const [form, setForm] = useState(null);   // null = hidden, else values (id when editing)
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const since = new Date(); since.setDate(1); since.setHours(0, 0, 0, 0);
    const [a, b] = await Promise.all([
      supabase.from('payments').select('amount,created_at').gte('created_at', since.toISOString()),
      supabase.from('pending_payments').select('agent_id,balance,status,hold_expires_at,paid_amount'),
    ]);
    if (!a.error) setPay(a.data);
    if (!b.error) setDue(b.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  const k = useMemo(() => {
    const today = new Date().toDateString();
    const rows = due.filter(r => effectiveStatus(r) !== 'expired' && Number(r.balance) > 0);
    return {
      owed: rows.reduce((t, r) => t + Number(r.balance), 0),
      agents: new Set(rows.map(r => r.agent_id)).size,
      month: pay.reduce((t, p) => t + Number(p.amount), 0),
      today: pay.filter(p => new Date(p.created_at).toDateString() === today).reduce((t, p) => t + Number(p.amount), 0),
    };
  }, [pay, due]);

  const set = key => e => setForm({ ...form, [key]: e.target.value });

  async function save(e) {
    e.preventDefault(); setError(''); setMsg('');
    const row = { bank_name: form.bank_name.trim(), account_title: form.account_title.trim(), account_no: form.account_no.trim(), iban: form.iban.trim() || null, branch: form.branch.trim() || null, note: form.note.trim() || null };
    const { error } = form.id ? await supabase.from('bank_accounts').update(row).eq('id', form.id) : await supabase.from('bank_accounts').insert(row);
    if (error) { setError(error.message); return; }
    setMsg('Bank account saved.'); setForm(null); reload();
  }
  async function toggle(b) {
    const { error } = await supabase.from('bank_accounts').update({ active: !b.active }).eq('id', b.id);
    if (error) setError(error.message); else reload();
  }
  async function remove(b) {
    if (!confirm(`Delete the ${b.bank_name} account from the list?`)) return;
    const { error } = await supabase.from('bank_accounts').delete().eq('id', b.id);
    if (error) setError(error.message); else { setMsg('Deleted.'); reload(); }
  }
  async function copyAll() {
    const t = `${AGENCY_NAME} - bank details\n\n${bankText(banks.filter(b => b.active))}`;
    try { await navigator.clipboard.writeText(t); setMsg('All active bank details copied.'); } catch { window.prompt('Copy this text:', t); }
  }

  return (
    <>
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}
      <div className="stats">
        <div className="stat"><span className="muted small">Total to receive</span><b className={k.owed ? 'neg' : ''}>{money(k.owed)}</b></div>
        <div className="stat"><span className="muted small">Agents who owe</span><b>{k.agents}</b></div>
        <div className="stat"><span className="muted small">Received today</span><b className="pos">{money(k.today)}</b></div>
        <div className="stat"><span className="muted small">Received this month</span><b className="pos">{money(k.month)}</b></div>
      </div>

      <DueReminders />
      <div className="actions" style={{ marginBottom: 16 }}>
        <Link href="/admin/payments"><button type="button">Record a payment</button></Link>
        <Link href="/admin/ledger"><button type="button" className="ghost">Agent ledgers</button></Link>
      </div>

      <div className="card">
        <h2>Bank accounts (shown to your agents)</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Agents see the active accounts on their <b>Pay / Bank details</b> page, and the reminder messages include them. {owner ? '' : 'Only the main admin can change this list.'}</p>
        <div className="actions" style={{ marginBottom: 12 }}>
          {owner && <button onClick={() => setForm({ ...BLANK })}>+ Add bank account</button>}
          {banks.some(b => b.active) && <button className="ghost" onClick={copyAll}>Copy all details</button>}
          {banks.some(b => b.active) && <a href={waShare(`${AGENCY_NAME} - bank details\n\n${bankText(banks.filter(b => b.active))}`)} target="_blank" rel="noreferrer"><button type="button" className="ok">Send to a customer on WhatsApp</button></a>}
        </div>
        {form && owner && (
          <form className="panel" onSubmit={save}>
            <div className="grid">
              <div><label>Bank name</label><input value={form.bank_name} onChange={set('bank_name')} required maxLength={80} placeholder="e.g. HBL" /></div>
              <div><label>Account title</label><input value={form.account_title} onChange={set('account_title')} required maxLength={120} placeholder="e.g. HARMAIN TRAVEL" /></div>
              <div><label>Account number</label><input value={form.account_no} onChange={set('account_no')} required maxLength={40} /></div>
              <div><label>IBAN (optional)</label><input value={form.iban || ''} onChange={set('iban')} maxLength={40} /></div>
              <div><label>Branch (optional)</label><input value={form.branch || ''} onChange={set('branch')} maxLength={120} /></div>
              <div><label>Note (optional)</label><input value={form.note || ''} onChange={set('note')} maxLength={200} placeholder="e.g. Easypaisa / JazzCash number" /></div>
            </div>
            <div className="actions" style={{ marginTop: 12 }}><button>Save</button><button type="button" className="ghost" onClick={() => setForm(null)}>Cancel</button></div>
          </form>
        )}
        {banks.length === 0 ? <p className="muted">No bank account added yet.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Bank</th><th>Title</th><th>Account / IBAN</th><th>Shown to agents</th>{owner && <th></th>}</tr></thead>
            <tbody>
              {banks.map(b => (
                <tr key={b.id} style={{ opacity: b.active ? 1 : .55 }}>
                  <td><b>{b.bank_name}</b></td><td>{b.account_title}</td>
                  <td>{b.account_no}{b.iban && <div className="muted small">{b.iban}</div>}</td>
                  <td><span className={'badge ' + (b.active ? 'approved' : 'blocked')}>{b.active ? 'Yes' : 'Hidden'}</span></td>
                  {owner && <td><div className="actions">
                    <button className="ghost" onClick={() => setForm({ ...b, iban: b.iban || '', branch: b.branch || '', note: b.note || '' })}>Edit</button>
                    <button className="warn" onClick={() => toggle(b)}>{b.active ? 'Hide' : 'Show'}</button>
                    <button className="bad" onClick={() => remove(b)}>Delete</button>
                  </div></td>}
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {banks.some(b => b.active) && <><h3>What agents see</h3><BankList banks={banks.filter(b => b.active)} /></>}
      </div>
    </>
  );
}
