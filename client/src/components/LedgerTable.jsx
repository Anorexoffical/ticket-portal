'use client';
import { dt, money } from '../lib/format';

// Statement with running balance. rows come from the agent_ledger view.
// Balance = what the agent still owes (debit - credit).
export default function LedgerTable({ rows }) {
  const sorted = [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  let bal = 0;
  const lines = sorted.map(r => { bal += Number(r.debit) - Number(r.credit); return { ...r, bal }; });
  const debit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const credit = rows.reduce((s, r) => s + Number(r.credit), 0);

  return (
    <div>
      <div className="stats">
        <div className="stat"><span className="muted small">Total booked</span><b>{money(debit)}</b></div>
        <div className="stat"><span className="muted small">Total paid</span><b className="pos">{money(credit)}</b></div>
        <div className="stat"><span className="muted small">Balance due</span><b className={debit - credit > 0 ? 'neg' : 'pos'}>{money(debit - credit)}</b></div>
      </div>
      <div className="scroll">
        <table className="ledger-table">
          <thead><tr><th>Date</th><th>Booking / PNR</th><th>Description / Sector</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th></tr></thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan="6" className="muted">No entries yet.</td></tr>}
            {lines.map((l, i) => (
              <tr key={i} className={l.type === 'payment' ? 'ledger-payment' : ''}>
                <td className="ledger-date">{dt(l.created_at)}</td>
                <td><div className="ledger-reference">{l.ref || l.booking_no || l.id}</div>{l.pnr && <div className="ledger-pnr">PNR {l.pnr}</div>}</td>
                <td className="ledger-description">{l.description}</td>
                <td className="ledger-dr">{Number(l.debit) ? money(l.debit) : '—'}</td>
                <td className="ledger-cr">{Number(l.credit) ? money(l.credit) : '—'}</td>
                <td className="ledger-balance">{money(l.bal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
