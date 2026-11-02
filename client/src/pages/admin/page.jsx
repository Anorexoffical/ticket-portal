import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import DueReminders from '@/components/DueReminders';
import SalesPanel from '@/components/SalesPanel';
import { dt, effectiveStatus, money, timeLeft } from '@/lib/format';

export default function AdminHome() {
  const [s, setS] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [ag, holds, owed, fl] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'agent').eq('status', 'pending'),
        supabase.from('bookings').select('id,ref,hold_expires_at,total_amount,paid_amount,profiles:agent_id(agency_name)').eq('status', 'on_hold').order('hold_expires_at'),
        supabase.from('pending_payments').select('balance,status,hold_expires_at'),
        supabase.from('flights').select('id', { count: 'exact', head: true }).eq('active', true).gt('departure_at', new Date().toISOString()),
      ]);
      const err = ag.error || holds.error || owed.error || fl.error;
      if (err) { setError(err.message); return; }
      const liveHolds = holds.data.filter(b => effectiveStatus({ status: 'on_hold', hold_expires_at: b.hold_expires_at, paid_amount: b.paid_amount }) === 'on_hold' && !Number(b.paid_amount));
      const outstanding = owed.data.filter(b => effectiveStatus(b) !== 'expired').reduce((t, b) => t + Number(b.balance), 0);
      setS({ pendingAgents: ag.count, liveHolds, outstanding, flights: fl.count });
    })();
  }, []);

  return (
    <Shell role="admin" title="Dashboard">
      {error && <div className="error">{error}</div>}
      {!s ? <p className="muted">Loading...</p> : (
        <>
          <div className="stats">
            <Link href="/admin/agents" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">Agents waiting for approval</span><b className={s.pendingAgents ? 'neg' : ''}>{s.pendingAgents}</b>
            </Link>
            <Link href="/admin/bookings" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">Bookings on hold</span><b>{s.liveHolds.length}</b>
            </Link>
            <Link href="/admin/payments" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">Payments pending</span><b className={s.outstanding ? 'neg' : ''}>{money(s.outstanding)}</b>
            </Link>
            <Link href="/admin/flights" className="stat" style={{ textDecoration: 'none', color: 'inherit' }}>
              <span className="muted small">Active flights</span><b>{s.flights}</b>
            </Link>
          </div>
          <SalesPanel />
          <DueReminders />
          <div className="card">
            <h2>Holds ending soonest</h2>
            {s.liveHolds.length === 0 ? <p className="muted">No bookings on hold.</p> : (
              <div className="scroll"><table>
                <thead><tr><th>Ref</th><th>Agency</th><th>Amount</th><th>Paid</th><th>Hold ends</th><th>Time left</th></tr></thead>
                <tbody>
                  {s.liveHolds.slice(0, 8).map(b => (
                    <tr key={b.id}><td>{b.ref}</td><td>{b.profiles?.agency_name}</td><td>{money(b.total_amount)}</td><td>{money(b.paid_amount)}</td><td>{dt(b.hold_expires_at)}</td><td><b>{timeLeft(b.hold_expires_at)}</b></td></tr>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>
        </>
      )}
    </Shell>
  );
}
