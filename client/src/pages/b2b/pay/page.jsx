import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import BankList from '@/components/BankList';
import useBanks from '@/lib/useBanks';
import { effectiveStatus, money, waNumber } from '@/lib/format';
import { SUPPORT_WHATSAPP } from '@/lib/config';

// Agent page: what I still owe, and where to pay.
export default function Pay() {
  return <Shell role="agent" title="Pay / Bank details">{p => <Body p={p} />}</Shell>;
}

function Body({ p }) {
  const { banks, loaded } = useBanks();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    supabase.from('pending_payments').select('*').order('hold_expires_at').then(({ data }) => { if (data) setRows(data); });
  }, []);
  const due = useMemo(() => rows.filter(r => effectiveStatus(r) !== 'expired' && Number(r.balance) > 0), [rows]);
  const total = due.reduce((t, r) => t + Number(r.balance), 0);
  const proof = SUPPORT_WHATSAPP ? `https://wa.me/${waNumber(SUPPORT_WHATSAPP)}?text=${encodeURIComponent(`Payment done by ${p.agency_name}. Amount: PKR ____ . Booking(s): ${due.map(r => r.ref).join(', ')}`)}` : null;
  return (
    <>
      <div className="card">
        <h2>My pending balance: <span className={total ? 'neg' : 'pos'}>{money(total)}</span></h2>
        {due.length === 0 ? <p className="muted">You have nothing to pay. Thank you!</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Booking</th><th>Total</th><th>Paid</th><th>Balance</th></tr></thead>
            <tbody>{due.map(r => <tr key={r.booking_id}><td><b>{r.ref}</b></td><td>{money(r.total_amount)}</td><td>{money(r.paid_amount)}</td><td className="neg">{money(r.balance)}</td></tr>)}</tbody>
          </table></div>
        )}
        {proof && due.length > 0 && <div className="actions" style={{ marginTop: 12 }}><a href={proof} target="_blank" rel="noreferrer"><button type="button" className="ok">I have paid - send proof on WhatsApp</button></a></div>}
      </div>
      <div className="card">
        <h2>Where to pay</h2>
        <p className="muted small" style={{ marginTop: 0 }}>Transfer to one of these accounts, then send the payment proof so we can confirm your booking.</p>
        {!loaded ? <p className="muted">Loading...</p> : <BankList banks={banks} />}
      </div>
    </>
  );
}
