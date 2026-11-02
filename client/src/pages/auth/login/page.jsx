import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import { AGENCY_NAME, SUPPORT_WHATSAPP } from '@/lib/config';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { user } = await authService.login(email, password);
      localStorage.setItem('portal_role', user.role);
      if (['admin', 'staff', 'superadmin'].includes(user.role)) router.replace('/admin');
      else if (user.status === 'pending') router.replace('/pending');
      else router.replace('/agent');
    } catch (err) {
      setError(err.message || 'Wrong email or password.');
    } finally { setBusy(false); }
  }

  return (
    <div className="al-root">
      {/* ── LEFT PANEL ── */}
      <div className="al-left">
        <div className="al-left-bg" />
        <div className="al-orb al-orb1" />
        <div className="al-orb al-orb2" />
        <div className="al-orb al-orb3" />

        <div className="al-left-inner">
          <div className="al-brand">
            <div className="al-brand-icon">{(AGENCY_NAME || 'H').slice(0, 1)}</div>
            <div>
              <div className="al-brand-name">{AGENCY_NAME}</div>
              <div className="al-brand-tag">B2B Travel Portal</div>
            </div>
          </div>

          <div className="al-hero">
            <h1 className="al-hero-title">Your gateway to<br /><span className="al-hero-accent">group travel</span></h1>
            <p className="al-hero-sub">Book flights, manage agents, track payments — all in one place.</p>
          </div>

          <div className="al-cards">
            <div className="al-card"><div className="al-card-icon">✈</div><div><b>Group Flights</b><p>Book &amp; manage group tickets instantly</p></div></div>
            <div className="al-card"><div className="al-card-icon">📊</div><div><b>Live Ledger</b><p>Real-time payment &amp; balance tracking</p></div></div>
            <div className="al-card"><div className="al-card-icon">🎫</div><div><b>E-Tickets</b><p>Instant PDF delivery to agents</p></div></div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="al-right">
        <div className="al-form-wrap">
          <div className="auth-card-brand"><span className="auth-card-mark">H</span><span><b>{AGENCY_NAME}</b><small>PORTAL</small></span></div>
          <img className="auth-travel-image" src="/travel-auth.svg" alt="Travel airplane illustration" />
          <div className="al-pill b2b-pill">B2B Agent Portal</div>
          <h2 className="al-form-title">Welcome back</h2>
          <p className="al-form-sub">Access your travel portal account in seconds.</p>

          <form onSubmit={submit} autoComplete="on" className="al-form">
            <div className="al-field">
              <label htmlFor="b2b-email">Email address</label>
              <input id="b2b-email" type="email" name="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="agency@example.com" required />
            </div>
            <div className="al-field">
              <label htmlFor="b2b-pw">Password</label>
              <div className="al-pw-wrap">
                <input id="b2b-pw" type={show ? 'text' : 'password'} name="password"
                  autoComplete="current-password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password" required />
                <button type="button" className="al-eye" onClick={() => setShow(s => !s)} tabIndex={-1}>
                  {show
                    ? <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && <div className="al-error">{error}</div>}

            <button type="submit" className="al-btn-primary" disabled={busy}>
              {busy ? <span className="al-spin" /> : null}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="al-divider"><span>Don't have an account?</span></div>
          <Link href="/signup" className="al-btn-ghost">Create agency account</Link>

          <div className="al-footer-links">
            <Link href="/admin/login" className="al-footer-link">Admin login →</Link>
            {SUPPORT_WHATSAPP && (
              <a href={`https://wa.me/${SUPPORT_WHATSAPP}`} target="_blank" rel="noreferrer" className="al-footer-link">Need help?</a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
