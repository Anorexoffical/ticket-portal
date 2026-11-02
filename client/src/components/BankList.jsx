'use client';
import { useState } from 'react';
import { bankText } from '../lib/pay';

// bank accounts with a Copy button (one account, or all)
export default function BankList({ banks }) {
  const [done, setDone] = useState('');
  async function copy(text, key) {
    try { await navigator.clipboard.writeText(text); setDone(key); setTimeout(() => setDone(''), 1800); } catch { window.prompt('Copy this text:', text); }
  }
  if (!banks.length) return <p className="muted">No bank account has been added yet.</p>;
  return (
    <div>
      <div className="bankgrid">
        {banks.map(b => (
          <div className="bankcard" key={b.id}>
            <div className="bankname">{b.bank_name}</div>
            <div className="small muted">Account title</div><div><b>{b.account_title}</b></div>
            <div className="small muted" style={{ marginTop: 6 }}>Account number</div><div className="bankno">{b.account_no}</div>
            {b.iban && <><div className="small muted" style={{ marginTop: 6 }}>IBAN</div><div className="bankno">{b.iban}</div></>}
            {b.branch && <div className="small muted" style={{ marginTop: 6 }}>Branch: {b.branch}</div>}
            {b.note && <div className="small" style={{ marginTop: 6 }}>{b.note}</div>}
            <button type="button" className="ghost" style={{ marginTop: 10 }} onClick={() => copy(bankText([b]), b.id)}>{done === b.id ? 'Copied ✓' : 'Copy details'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}
