import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authService } from '@/services/auth.service';
import { AGENCY_NAME } from '@/lib/config';

export default function AdminLogin() {
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
      if (!['admin', 'staff', 'superadmin'].includes(user.role)) {
        setError('Access denied. This login is for admin and staff only.');
        setBusy(false); return;
      }
      localStorage.setItem('portal_role', user.role);
      router.replace('/admin');
    } catch (err) {
      setError(err.message || 'Wrong email or password.');
    } finally { setBusy(false); }
  }

  return (
    <div className="al-root">
      {/* ── LEFT PANEL ── */}
      <div className="al-left al-left-admin">
        <div className="al-left-bg" />
        <div className="al-orb al-orb1" />
        <div className="al-orb al-orb2" />
        <div className="al-orb al-orb3" />

        <div className="al-left-inner">
          <div className="al-brand">
            <div className="al-brand-icon al-brand-icon-admin">{(AGENCY_NAME || 'H').slice(0, 1)}</div>
            <div>
              <div className="al-brand-name">{AGENCY_NAME}</div>
              <div className="al-brand-tag">Admin Control Panel</div>
            </div>
          </div>

          <div className="al-hero">
            <h1 className="al-hero-title">Full control,<br /><span className="al-hero-accent al-hero-accent-admin">zero limits</span></h1>
            <p className="al-hero-sub">Manage bookings, agents, payments and system settings from one powerful dashboard.</p>
          </div>

          <div className="al-cards">
            <div className="al-card"><div className="al-card-icon">📋</div><div><b>Booking Management</b><p>Confirm, issue &amp; track all bookings</p></div></div>
            <div className="al-card"><div className="al-card-icon">👥</div><div><b>Agent Control</b><p>Approve, manage &amp; monitor agents</p></div></div>
            <div className="al-card"><div className="al-card-icon">💰</div><div><b>Accounts &amp; Ledger</b><p>Full financial visibility</p></div></div>
          </div>

          <div className="al-secure-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Secured admin area — all access is logged
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="al-right">
        <div className="al-form-wrap">
          <div className="al-pill admin-pill">Admin Access</div>
          <h2 className="al-form-title">Admin Login</h2>
          <p className="al-form-sub">Restricted to authorised staff only</p>

          <form onSubmit={submit} autoComplete="on" className="al-form">
            <div className="al-field">
              <label htmlFor="adm-email">Email address</label>
              <input id="adm-email" type="email" name="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@example.com" required />
            </div>
            <div className="al-field">
              <label htmlFor="adm-pw">Password</label>
              <div className="al-pw-wrap">
                <input id="adm-pw" type={show ? 'text' : 'password'} name="password"
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

            <button type="submit" className="al-btn-primary al-btn-admin" disabled={busy}>
              {busy ? <span className="al-spin" /> : null}
              {busy ? 'Verifying…' : 'Sign in to Admin'}
            </button>
          </form>

          <div className="al-footer-links" style={{ marginTop: 28 }}>
            <Link href="/login" className="al-footer-link">← Agent login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
