import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import PassengerList from '@/components/PassengerList';
import PayForm from '@/components/PayForm';
import { dt, waNumber, effectiveStatus, money, timeLeft } from '@/lib/format';
import BookingCard from '@/components/BookingCard';
import useLegs from '@/lib/useLegs';
import { AGENCY_NAME } from '@/lib/config';

const SELECT = '*, flights(airline,flight_no,origin,destination,departure_at), profiles:agent_id(agency_name,agent_no,whatsapp,email,delivery_pref), confirmer:confirmed_by(agency_name), passengers(*), payments(*)';
const FILTERS = ['all', 'on_hold', 'confirmed', 'issued', 'cancelled', 'expired'];
const FILTER_LABELS = { all: 'All', on_hold: 'On Hold', confirmed: 'Confirmed', issued: 'Issued', cancelled: 'Cancelled', expired: 'Expired' };

export default function AdminBookings() {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loaded, setLoaded] = useState(false);
  const legs = useLegs(rows);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('bookings').select(SELECT).order('created_at', { ascending: false }).limit(500);
    if (error) setError(error.message); else setRows(data);
    setLoaded(true);
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter(b => {
    if (filter !== 'all' && effectiveStatus(b) !== filter) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return b.ref.toLowerCase().includes(t) || String(b.booking_no || '').includes(t) || (b.pnr || '').toLowerCase().includes(t) || (b.profiles?.agency_name || '').toLowerCase().includes(t)
      || b.passengers.some(p => `${p.first_name} ${p.last_name} ${p.passport_number}`.toLowerCase().includes(t));
  }), [rows, filter, q]);

  return (
    <Shell role="admin" title="">
      {error && <div className="error">{error}</div>}
      {msg && <div className="good">{msg}</div>}

      {/* ── unified control panel ── */}
      <div className="bk-control-panel">
        <div className="bk-control-top">
          <h1 className="bk-page-title">Bookings</h1>
          <div className="bk-search-wrap">
            <svg className="bk-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input className="bk-search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search ref, agency, passenger, PNR…" />
          </div>
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
      </div>

      {!loaded
        ? <p className="muted">Loading…</p>
        : shown.length === 0
          ? <div className="card"><p className="muted">No bookings found.</p></div>
          : shown.map(b => {
            const st = effectiveStatus(b);
            const bal = Number(b.total_amount) - Number(b.paid_amount);
            return (
              <BookingCard key={b.id} b={b} st={st} legs={legs[b.flight_id]} admin
                actions={<>
                  <SendTicket b={b} onError={setError} />
                  <Link href={`/voucher/${b.id}`}><button type="button" className="ghost">🖨 Print</button></Link>
                  <button className={open === b.id ? 'bk-btn-manage open' : 'bk-btn-manage'} onClick={() => setOpen(v => v === b.id ? null : b.id)}>
                    {open === b.id ? '✕ Close' : '⚙ Manage'}
                  </button>
                </>}>
                {open === b.id && <BookingPanel key={b.id + st} b={b} st={st} bal={bal} onChange={async m => { setMsg(m || ''); setError(''); setOpen(null); await load(); }} onError={setError} />}
              </BookingCard>
            );
          })
      }
    </Shell>
  );
}

function SendTicket({ b, onError }) {
  const [links, setLinks] = useState(null);
  if (!b.ticket_pdf_path) return <button className="ghost" disabled title="Upload the ticket PDF first (Manage)">Send E-Ticket</button>;
  async function prepare() {
    const { data, error } = await supabase.storage.from('tickets').createSignedUrl(b.ticket_pdf_path, 60 * 60 * 24 * 7);
    if (error) { onError(error.message); return; }
    const p = b.profiles || {};
    const text = `${AGENCY_NAME}\nTicket for booking ${b.ref} (${b.flights?.flight_no}, ${b.flights?.origin}-${b.flights?.destination}).\nDownload (link valid 7 days): ${data.signedUrl}`;
    setLinks({
      wa: p.whatsapp ? `https://wa.me/${waNumber(p.whatsapp)}?text=${encodeURIComponent(text)}` : null,
      mail: p.email ? `mailto:${p.email}?subject=${encodeURIComponent('Your ticket ' + b.ref)}&body=${encodeURIComponent(text)}` : null,
    });
  }
  if (!links) return <button className="ok" onClick={prepare}>📤 Send E-Ticket</button>;
  return (
    <>
      {links.wa ? <a href={links.wa} target="_blank" rel="noreferrer"><button className="ok" type="button">💬 WhatsApp</button></a> : <span className="muted small">No WhatsApp</span>}
      {links.mail ? <a href={links.mail}><button type="button">✉ Email</button></a> : <span className="muted small">No email</span>}
    </>
  );
}

function BookingPanel({ b, st, bal, onChange, onError }) {
  const [hours, setHours] = useState('24');
  const [pnr, setPnr] = useState(b.pnr || '');
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState(null);

  async function run(fn, okMsg) {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { onError(error.message); return; }
    onChange(okMsg);
  }
  const rpc = (name, args, okMsg) => run(() => supabase.rpc(name, args), okMsg);

  async function upload(e) {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') { onError('Please choose a PDF file.'); return; }
    if (file.size > 10 * 1024 * 1024) { onError('PDF is too big (max 10 MB).'); return; }
    setBusy(true);
    const path = `${b.agent_id}/${b.id}.pdf`;
    const up = await supabase.storage.from('tickets').upload(path, file, { upsert: true, contentType: 'application/pdf' });
    if (up.error) { setBusy(false); onError(up.error.message); return; }
    const { error } = await supabase.rpc('admin_attach_ticket', { p_booking: b.id, p_path: path });
    setBusy(false);
    if (error) { onError(error.message); return; }
    onChange('Ticket uploaded and booking marked as ISSUED.');
  }

  async function prepareLinks() {
    const { data, error } = await supabase.storage.from('tickets').createSignedUrl(b.ticket_pdf_path, 60 * 60 * 24 * 7);
    if (error) { onError(error.message); return; }
    const p = b.profiles || {};
    const text = `${AGENCY_NAME}\nTicket for booking ${b.ref} (${b.flights?.flight_no}, ${b.flights?.origin}-${b.flights?.destination}).\nDownload (link valid 7 days): ${data.signedUrl}`;
    setLinks({
      wa: p.whatsapp ? `https://wa.me/${waNumber(p.whatsapp)}?text=${encodeURIComponent(text)}` : null,
      mail: p.email ? `mailto:${p.email}?subject=${encodeURIComponent('Your ticket ' + b.ref)}&body=${encodeURIComponent(text)}` : null,
      pref: p.delivery_pref,
    });
  }

  function cancel() {
    const warn = b.paid_amount > 0
      ? `This booking has ${money(b.paid_amount)} already paid. Cancelling frees the seats but does NOT refund. Cancel anyway?`
      : 'Cancel this booking and free the seats?';
    if (confirm(warn)) rpc('admin_set_booking_status', { p_booking: b.id, p_status: 'cancelled' }, 'Booking cancelled.');
  }

  const editable = st === 'on_hold' || st === 'confirmed' || st === 'expired' || st === 'issued';

  return (
    <div className="bk-panel">
      <div className="bk-panel-section">
        <div className="bk-panel-section-title">Passengers</div>
        <PassengerList passengers={b.passengers} departure={b.flights?.departure_at} canEdit={st !== 'cancelled'} onSaved={() => onChange('Passenger updated.')} />
      </div>

      <div className="bk-panel-section">
        <div className="bk-panel-section-title">Actions</div>
        <div className="bk-action-grid">
          {st === 'on_hold' && (
            <button className="bk-action-btn ok" disabled={busy} onClick={() => rpc('admin_set_booking_status', { p_booking: b.id, p_status: 'confirmed' }, 'Booking confirmed.')}>
              ✓ Confirm booking
            </button>
          )}
          {(st === 'on_hold' || st === 'expired') && (
            <div className="bk-hold-row">
              <input type="number" min="1" value={hours} onChange={e => setHours(e.target.value)} style={{ width: 80 }} />
              <button className="warn" disabled={busy} onClick={() => rpc('admin_extend_hold', { p_booking: b.id, p_hours: parseInt(hours, 10) || 0 }, 'Hold extended.')}>
                {st === 'expired' ? '↺ Re-open hold' : '⏱ Extend hold'}
              </button>
            </div>
          )}
          {(st === 'confirmed' || st === 'issued') && (
            <label className="bk-upload-btn">
              {busy ? 'Uploading…' : st === 'issued' ? '↑ Replace ticket PDF' : '↑ Upload ticket PDF (issue)'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={upload} disabled={busy} />
            </label>
          )}
          {st === 'on_hold' && (
            <Link href={`/voucher/${b.id}`}><button type="button" className="ghost">🖨 View confirmation</button></Link>
          )}
          {(st === 'confirmed' || st === 'issued' || (st === 'on_hold' && Number(b.paid_amount) > 0)) && (
            <button className={b.edit_unlocked ? 'warn' : 'ghost'} disabled={busy}
              onClick={() => rpc('admin_set_edit_unlock', { p_booking: b.id, p_unlock: !b.edit_unlocked }, b.edit_unlocked ? 'Agent editing locked.' : 'Agent can now edit passengers.')}>
              {b.edit_unlocked ? '🔒 Lock agent editing' : '🔓 Allow agent to edit'}
            </button>
          )}
          {editable && st !== 'cancelled' && (
            <button className="bad" disabled={busy} onClick={cancel}>✕ Cancel booking</button>
          )}
        </div>
      </div>

      {(st === 'confirmed' || st === 'issued') && (
        <div className="bk-panel-section">
          <div className="bk-panel-section-title">Airline PNR</div>
          <div className="bk-pnr-row">
            <input value={pnr} onChange={e => setPnr(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. X7K2MQ" maxLength={6} style={{ fontFamily: 'ui-monospace,monospace', letterSpacing: '.1em', fontWeight: 700, maxWidth: 160 }} />
            <button disabled={busy} onClick={() => rpc('admin_set_pnr', { p_booking: b.id, p_pnr: pnr }, 'PNR saved.')}>Save PNR</button>
            <Link href={`/voucher/${b.id}`}><button type="button" className="ghost">🖨 View confirmation</button></Link>
          </div>
        </div>
      )}

      {bal > 0 && (st === 'on_hold' || st === 'confirmed' || st === 'issued') && st !== 'expired' && (
        <div className="bk-panel-section">
          <div className="bk-panel-section-title">Record Payment — balance {money(bal)}</div>
          {st === 'on_hold' && !Number(b.paid_amount) && new Date(b.hold_expires_at) <= Date.now()
            ? <div className="info">Hold time is over. Extend the hold first.</div>
            : <PayForm bookingId={b.id} balance={bal} onDone={() => onChange('Payment recorded.')} />}
        </div>
      )}

      {b.payments.length > 0 && (
        <div className="bk-panel-section">
          <div className="bk-panel-section-title">Payments Received</div>
          <div className="scroll"><table><tbody>
            {b.payments.map(p => <tr key={p.id}><td>{dt(p.created_at)}</td><td><b>{money(p.amount)}</b></td><td>{p.method}</td><td className="muted">{p.note}</td></tr>)}
          </tbody></table></div>
        </div>
      )}

      {b.ticket_pdf_path && (
        <div className="bk-panel-section">
          <div className="bk-panel-section-title">Send Ticket to Agent</div>
          <p className="muted small" style={{ margin: '0 0 10px' }}>Agent preference: <b>{b.profiles?.delivery_pref || 'email'}</b>. The agent can also download it in their portal.</p>
          {!links
            ? <button className="ghost" onClick={prepareLinks}>Prepare send links</button>
            : <div className="bk-action-grid">
                {links.wa ? <a href={links.wa} target="_blank" rel="noreferrer"><button className="ok" type="button">💬 Send on WhatsApp</button></a> : <span className="muted small">No WhatsApp number</span>}
                {links.mail ? <a href={links.mail}><button type="button">✉ Send by Email</button></a> : <span className="muted small">No email</span>}
              </div>
          }
        </div>
      )}
    </div>
  );
}
