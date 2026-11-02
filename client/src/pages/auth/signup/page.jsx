import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import { AGENCY_NAME, SUPPORT_WHATSAPP } from '@/lib/config';

export default function Signup() {
  const [f, setF] = useState({ agency_name: '', phone: '', whatsapp: '', email: '', password: '', confirm: '' });
  const [diff, setDiff] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setError('');
    if (f.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (f.password !== f.confirm) { setError('Passwords do not match.'); return; }
    if (!f.agency_name.trim() || !f.phone.trim()) { setError('Agency name and phone are required.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: f.email, password: f.password,
      options: { data: { agency_name: f.agency_name.trim(), phone: f.phone.trim(), whatsapp: diff && f.whatsapp.trim() ? f.whatsapp.trim() : f.phone.trim() } },
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setDone(true);
  }

  if (done) return (
    <div className="al-root">
      <div className="al-left">
        <div className="al-left-bg" />
        <div className="al-orb al-orb1" /><div className="al-orb al-orb2" /><div className="al-orb al-orb3" />
        <div className="al-left-inner">
          <div className="al-brand">
            <div className="al-brand-icon">{(AGENCY_NAME || 'H').slice(0, 1)}</div>
            <div><div className="al-brand-name">{AGENCY_NAME}</div><div className="al-brand-tag">B2B Travel Portal</div></div>
          </div>
          <div className="al-hero">
            <h1 className="al-hero-title">You're almost<br /><span className="al-hero-accent">ready to fly</span></h1>
            <p className="al-hero-sub">Your registration is submitted. Hang tight while we review your agency.</p>
          </div>
        </div>
      </div>
      <div className="al-right">
        <div className="al-form-wrap">
          <div className="al-success-ring">
            <svg viewBox="0 0 52 52" width="52" height="52"><circle cx="26" cy="26" r="25" fill="none" stroke="#0E4655" strokeWidth="2"/><path fill="none" stroke="#0E4655" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" d="M14 27l8 8 16-16"/></svg>
          </div>
          <h2 className="al-form-title" style={{ textAlign: 'center' }}>Registration submitted!</h2>
          <p className="al-form-sub" style={{ textAlign: 'center', marginBottom: 28 }}>
            Your agency <b>{f.agency_name}</b> has been registered. An admin will review and approve your account.
          </p>

          <div className="al-steps">
            <div className="al-step al-step-done"><div className="al-step-dot">✓</div><div><b>Account created</b><span>Registration complete</span></div></div>
            <div className="al-step al-step-active"><div className="al-step-dot">2</div><div><b>Pending approval</b><span>Usually within 1–24 hours</span></div></div>
            <div className="al-step al-step-dim"><div className="al-step-dot">3</div><div><b>Start booking</b><span>Full portal access granted</span></div></div>
          </div>

          <div className="al-contact-box">
            <p className="al-contact-label">Want to speed things up?</p>
            <div className="al-contact-row">
              {SUPPORT_WHATSAPP
                ? <a href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hi, I just registered "${f.agency_name}" on the portal. Please approve my account.`)}`} target="_blank" rel="noreferrer" className="al-btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.52-5.16-1.427l-.37-.22-3.76.895.952-3.668-.242-.378A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                    Contact on WhatsApp
                  </a>
                : <a href="mailto:support@example.com" className="al-btn-primary" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>✉ Send an email</a>
              }
            </div>
          </div>

          <Link href="/login" className="al-btn-ghost">Back to login</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="al-root">
      <div className="al-left">
        <div className="al-left-bg" />
        <div className="al-orb al-orb1" /><div className="al-orb al-orb2" /><div className="al-orb al-orb3" />
        <div className="al-left-inner">
          <div className="al-brand">
            <div className="al-brand-icon">{(AGENCY_NAME || 'H').slice(0, 1)}</div>
            <div><div className="al-brand-name">{AGENCY_NAME}</div><div className="al-brand-tag">B2B Travel Portal</div></div>
          </div>
          <div className="al-hero">
            <h1 className="al-hero-title">Join the<br /><span className="al-hero-accent">network</span></h1>
            <p className="al-hero-sub">Register your travel agency and start booking group flights in minutes.</p>
          </div>
          <div className="al-cards">
            <div className="al-card"><div className="al-card-icon">✈</div><div><b>Group Flights</b><p>Book &amp; manage group tickets instantly</p></div></div>
            <div className="al-card"><div className="al-card-icon">📊</div><div><b>Live Ledger</b><p>Real-time payment &amp; balance tracking</p></div></div>
            <div className="al-card"><div className="al-card-icon">🎫</div><div><b>E-Tickets</b><p>Instant PDF delivery to agents</p></div></div>
          </div>
        </div>
      </div>

      <div className="al-right al-right-scroll">
        <div className="al-form-wrap">
          <div className="auth-card-brand"><span className="auth-card-mark">H</span><span><b>{AGENCY_NAME}</b><small>PORTAL</small></span></div>
          <img className="auth-travel-image" src="/travel-auth.svg" alt="Travel airplane illustration" />
          <div className="al-pill b2b-pill">New Agency</div>
          <h2 className="al-form-title">Create your account</h2>
          <p className="al-form-sub">Register your travel agency to get started</p>

          <form onSubmit={submit} autoComplete="on" className="al-form">
            <div className="al-field">
              <label htmlFor="sg-agency">Agency / Company name</label>
              <input id="sg-agency" name="organization" autoComplete="organization"
                value={f.agency_name} onChange={set('agency_name')}
                placeholder="e.g. Al-Noor Travels" required />
            </div>

            <div className="al-row2">
              <div className="al-field">
                <label htmlFor="sg-phone">Phone number</label>
                <input id="sg-phone" type="tel" name="tel" autoComplete="tel"
                  value={f.phone} onChange={set('phone')} placeholder="03001234567" required />
              </div>
              <div className="al-field">
                <label htmlFor="sg-email">Email address</label>
                <input id="sg-email" type="email" name="email" autoComplete="email"
                  value={f.email} onChange={set('email')} placeholder="agency@example.com" required />
              </div>
            </div>

            <label className="al-check-label">
              <input type="checkbox" checked={diff} onChange={e => setDiff(e.target.checked)} />
              WhatsApp is on a different number
            </label>
            {diff && (
              <div className="al-field">
                <label htmlFor="sg-wa">WhatsApp number</label>
                <input id="sg-wa" type="tel" value={f.whatsapp} onChange={set('whatsapp')} placeholder="WhatsApp number" />
              </div>
            )}

            <div className="al-row2">
              <div className="al-field">
                <label htmlFor="sg-pw">Password</label>
                <div className="al-pw-wrap">
                  <input id="sg-pw" type={show ? 'text' : 'password'} name="new-password"
                    autoComplete="new-password" value={f.password} onChange={set('password')}
                    placeholder="Min 8 characters" required />
                  <button type="button" className="al-eye" onClick={() => setShow(s => !s)} tabIndex={-1}>
                    {show
                      ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>
              <div className="al-field">
                <label htmlFor="sg-cpw">Confirm password</label>
                <input id="sg-cpw" type={show ? 'text' : 'password'} name="confirm-password"
                  autoComplete="new-password" value={f.confirm} onChange={set('confirm')}
                  placeholder="Repeat password" required />
              </div>
            </div>

            {error && <div className="al-error">{error}</div>}

            <button type="submit" className="al-btn-primary" disabled={busy}>
              {busy ? <span className="al-spin" /> : null}
              {busy ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="al-divider"><span>Already registered?</span></div>
          <Link href="/login" className="al-btn-ghost">Sign in to your account</Link>
        </div>
      </div>
    </div>
  );
}
