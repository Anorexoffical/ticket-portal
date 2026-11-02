import { useRouter } from 'next/navigation';
import { useProfile, signOut } from '@/lib/useProfile';
import { AGENCY_NAME, SUPPORT_WHATSAPP } from '@/lib/config';

export default function Pending() {
  const router = useRouter();
  const { loading, profile } = useProfile();
  if (loading) return <div className="wrap"><p className="muted">Loading…</p></div>;
  const blocked = profile.status === 'blocked';

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
            <h1 className="al-hero-title">{blocked ? 'Account\n' : 'Almost\n'}<span className="al-hero-accent">{blocked ? 'blocked' : 'there'}</span></h1>
            <p className="al-hero-sub">{blocked ? 'Your account has been blocked. Please contact the team to resolve this.' : 'Your account is under review. We\'ll have you up and running very soon.'}</p>
          </div>
        </div>
      </div>

      <div className="al-right">
        <div className="al-form-wrap">
          <div className={`al-status-icon ${blocked ? 'al-status-blocked' : 'al-status-pending'}`}>
            {blocked
              ? <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              : <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            }
          </div>

          <h2 className="al-form-title" style={{ textAlign: 'center' }}>
            {blocked ? 'Account Blocked' : 'Waiting for Approval'}
          </h2>
          <p className="al-form-sub" style={{ textAlign: 'center', marginBottom: 32 }}>
            {blocked
              ? 'Your account has been blocked by the admin. Please contact the team.'
              : 'Your agency account is created and pending admin review.'}
          </p>

          {!blocked && (
            <div className="al-steps">
              <div className="al-step al-step-done">
                <div className="al-step-dot">✓</div>
                <div><b>Account registered</b><span>Registration complete</span></div>
              </div>
              <div className="al-step al-step-active">
                <div className="al-step-dot al-step-pulse">2</div>
                <div><b>Admin review</b><span>Usually within 1–24 hours</span></div>
              </div>
              <div className="al-step al-step-dim">
                <div className="al-step-dot">3</div>
                <div><b>Access granted</b><span>Start booking flights</span></div>
              </div>
            </div>
          )}

          <div className="al-contact-box">
            <p className="al-contact-label">{blocked ? 'Contact the team to resolve this:' : 'Want to speed things up?'}</p>
            <div className="al-contact-row">
              {SUPPORT_WHATSAPP && (
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(blocked ? 'Hi, my account has been blocked on the portal. Please help.' : 'Hi, I registered on the portal and my account is pending approval. Please review it.')}`}
                  target="_blank" rel="noreferrer"
                  className="al-btn-primary"
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L0 24l6.335-1.508A11.955 11.955 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.65-.52-5.16-1.427l-.37-.22-3.76.895.952-3.668-.242-.378A9.96 9.96 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  WhatsApp the team
                </a>
              )}
              <a href="mailto:support@example.com" className="al-btn-ghost" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                ✉ Send an email
              </a>
            </div>
          </div>

          <button className="al-logout-btn" onClick={() => signOut(router)}>Log out</button>
        </div>
      </div>
    </div>
  );
}
