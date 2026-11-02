import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import PassengerList from '@/components/PassengerList';
import { waNumber, dt, effectiveStatus, money, timeLeft } from '@/lib/format';
import BookingCard from '@/components/BookingCard';
import useLegs from '@/lib/useLegs';
import { SUPPORT_WHATSAPP } from '@/lib/config';

const SELECT = '*, flights(airline,flight_no,origin,destination,departure_at), passengers(*), payments(*)';
const FILTERS = ['all', 'on_hold', 'confirmed', 'issued', 'cancelled', 'expired'];
const FILTER_LABELS = { all: 'All', on_hold: 'On Hold', confirmed: 'Confirmed', issued: 'Issued', cancelled: 'Cancelled', expired: 'Expired' };

export default function Page() {
  return <Suspense fallback={<div className="wrap"><p className="muted">Loading…</p></div>}><MyBookings /></Suspense>;
}

function MyBookings() {
  const router = useRouter();
  const isNew = useSearchParams().get('new');
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState(isNew ? 'Booking placed ON HOLD. Pay before the hold ends to confirm it.' : '');
  const [loaded, setLoaded] = useState(false);
  const [, tick] = useState(0);
  const legs = useLegs(rows);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('bookings').select(SELECT).order('created_at', { ascending: false });
    if (error) setError(error.message); else setRows(data);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t); }, [load]);

  async function cancel(b) {
    if (!confirm(`Cancel booking ${b.ref}?`)) return;
    const { error } = await supabase.rpc('cancel_my_booking', { p_booking: b.id });
    if (error) setError(error.message); else { setMsg('Booking cancelled.'); setError(''); load(); }
  }

  async function download(b) {
    const { data, error } = await supabase.storage.from('tickets').createSignedUrl(b.ticket_pdf_path, 120);
    if (error) { setError(error.message); return; }
    window.location.href = data.signedUrl;
  }

  function rebook(b) {
    try { sessionStorage.setItem('rebook', JSON.stringify({ flight_id: b.flight_id, passengers: b.passengers.map(({ title, first_name, last_name, pax_type, dob, passport_number, passport_expiry, nationality }) => ({ title, first_name, last_name, pax_type, dob, passport_number, passport_expiry, nationality })) })); } catch { /* ignore */ }
    router.push(`/agent/book/${b.flight_id}`);
  }

  const shown = rows.filter(b => filter === 'all' || effectiveStatus(b) === filter);

  return (
    <Shell role="agent" title="">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}

      <div className="bk-page-bar">
        <h1 className="bk-page-title">My Bookings</h1>
      </div>

      <div className="bk-filters">
        {FILTERS.map(s => {
          const count = s === 'all' ? rows.length : rows.filter(b => effectiveStatus(b) === s).length;
          return (
            <button key={s} className={'bk-filter-btn' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>
              {FILTER_LABELS[s]}
              <span className={'bk-filter-count' + (filter === s ? ' on' : '')}>{count}</span>
            </button>
          );
        })}
      </div>

      {!loaded
        ? <p className="muted">Loading…</p>
        : shown.length === 0
          ? <div className="card"><p className="muted">No bookings here.</p></div>
          : shown.map(b => {
            const st = effectiveStatus(b);
            const bal = Number(b.total_amount) - Number(b.paid_amount);
            const paid = Number(b.paid_amount) > 0;
            const canEdit = (st === 'on_hold' && !paid) || ((st === 'on_hold' || st === 'confirmed' || st === 'issued') && b.edit_unlocked);
            return (
              <BookingCard key={b.id} b={b} st={st} legs={legs[b.flight_id]}
                actions={<>
                  <button className="ghost" onClick={() => setOpen(open === b.id ? null : b.id)}>
                    {open === b.id ? '✕ Hide' : (canEdit ? '✏ Passengers / Edit' : '👤 Passengers')}
                  </button>
                  {(st === 'on_hold' || st === 'confirmed' || st === 'issued') && (
                    <Link href={`/voucher/${b.id}`}><button type="button" className="ghost">🖨 Confirmation</button></Link>
                  )}
                  {st === 'issued' && b.ticket_pdf_path && (
                    <button className="ok" onClick={() => download(b)}>⬇ Download Ticket</button>
                  )}
                  {st === 'on_hold' && !paid && (
                    <button className="bad" onClick={() => cancel(b)}>✕ Cancel</button>
                  )}
                  {(st === 'cancelled' || st === 'expired') && (
                    <button onClick={() => rebook(b)}>↺ Rebook</button>
                  )}
                </>}>
                {st === 'on_hold' && !paid && (
                  <div className="bk-agent-notice info">
                    To confirm: pay <b>{money(bal)}</b> to the main agency before the hold ends, then they will confirm your booking.
                  </div>
                )}
                {st === 'on_hold' && paid && (
                  <div className="bk-agent-notice good">
                    Payment received — hold timer is off. Balance remaining: <b>{money(bal)}</b>. To cancel or change, contact the main agency.
                  </div>
                )}
                {open === b.id && (
                  <div className="bk-panel">
                    <div className="bk-panel-section">
                      <div className="bk-panel-section-title">Passengers</div>
                      <PassengerList passengers={b.passengers} departure={b.flights?.departure_at} canEdit={canEdit} onSaved={() => { setMsg('Passenger updated.'); load(); }} />
                      {!canEdit && (st === 'on_hold' || st === 'confirmed' || st === 'issued') && (
                        <p className="muted small" style={{ marginTop: 10 }}>
                          Editing is locked after payment or confirmation. Ask the main agency to unlock it.{' '}
                          {SUPPORT_WHATSAPP && (
                            <a target="_blank" rel="noreferrer" href={`https://wa.me/${waNumber(SUPPORT_WHATSAPP)}?text=${encodeURIComponent(`Please unlock passenger editing for booking ${b.ref}`)}`}>Ask on WhatsApp</a>
                          )}
                        </p>
                      )}
                      {canEdit && (paid || st !== 'on_hold') && <p className="muted small" style={{ marginTop: 8 }}>The main agency has unlocked editing for this booking.</p>}
                      {(st === 'cancelled' || st === 'expired') && <p className="muted small" style={{ marginTop: 8 }}>This booking can no longer be edited.</p>}
                    </div>
                  </div>
                )}
              </BookingCard>
            );
          })
      }
    </Shell>
  );
}
