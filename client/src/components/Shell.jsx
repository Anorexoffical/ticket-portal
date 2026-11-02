'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useProfile, signOut } from '../lib/useProfile';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/db';
import { effectiveStatus, money } from '../lib/format';
import { AGENCY_NAME } from '../lib/config';

const ADMIN_NAV = [
  ['/admin', 'home', 'Dashboard'],
  ['/admin/flights', 'plane', 'Flights'],
  ['/admin/bookings', 'list', 'Bookings'],
  ['/admin/payments', 'money', 'Payments'],
  ['/admin/accounts', 'bank', 'Accounts'],
  ['/admin/ledger', 'book', 'Ledgers'],
  ['/admin/agents', 'users', 'Agents'],
  ['/admin/suppliers', 'box', 'Suppliers', true],
  ['/admin/activity', 'clock', 'Activity', true],
  ['/admin/staff', 'badge', 'Staff', true],
  ['/admin/settings', 'gear', 'Settings', true],
];
const AGENT_NAV = [
  ['/agent', 'plane', 'Flights'],
  ['/agent/bookings', 'list', 'My Bookings'],
  ['/agent/pay', 'bank', 'Pay / Bank details'],
  ['/agent/ledger', 'book', 'My Ledger'],
  ['/agent/settings', 'gear', 'Settings'],
];

const ICONS = {
  bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM6 10v4M18 10v4',
  users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M18 14.3c1.8.8 3 2.6 3 4.7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  badge: 'M5 4h14v16H5zM12 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 18c0-2.2 1.8-4 4-4s4 1.8 4 4',
  plane: 'M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z',
  list: 'M9 4h6v3H9zM6 5h-1a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-1M8 12h8M8 16h6',
  book: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18a2 2 0 0 1 2-2h12',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .5-1.5-1.5.5-2-3-1-1 2h-2l-1-2-3 1 .5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 19l-.5 2 3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8',
  hotel: 'M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M18 6L6 18M6 6l12 12',
};
const Icon = ({ name, size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

function Logo({ name }) {
  const [available, setAvailable] = useState(false);
  const [bad, setBad] = useState(false);
  const url = '/api/uploads/file?path=branding/logo.png';
  useEffect(() => {
    fetch(url, { method: 'HEAD', credentials: 'include' })
      .then(r => setAvailable(r.ok)).catch(() => setAvailable(false));
  }, []);
  if (bad || !available) return <span className="toplogo-fb">{(name || 'A').trim().slice(0, 1).toUpperCase()}</span>;
  return <img className="toplogo" src={url} alt="" width="36" height="36" onError={() => setBad(true)} />;
}

function PendingStrip({ admin }) {
  const [s, setS] = useState(null);
  useEffect(() => {
    supabase.from('pending_payments').select('agent_id,balance,paid_amount,status,hold_expires_at').then(({ data }) => {
      if (!data) return;
      const rows = data.filter(r => effectiveStatus(r) !== 'expired' && Number(r.balance) > 0);
      setS({ total: rows.reduce((t, r) => t + Number(r.balance), 0), n: rows.length, agents: new Set(rows.map(r => r.agent_id)).size });
    });
  }, []);
  if (!s || s.n === 0) return null;
  return admin
    ? <div className="paystrip admin"><span>Pending from agents: <b>{money(s.total)}</b> ({s.agents} agent(s), {s.n} booking(s))</span><Link href="/admin/accounts">Open Accounts &amp; reminders</Link></div>
    : <div className="paystrip"><span>Your pending balance: <b>{money(s.total)}</b> on {s.n} booking(s). Please pay to keep your bookings safe.</span><Link href="/agent/pay">How to pay</Link></div>;
}

export default function Shell({ role, title, children }) {
  const router = useRouter();
  const path = usePathname();
  const { loading, profile } = useProfile(role);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);

  useEffect(() => {
    function handler(e) { if (navRef.current && !navRef.current.contains(e.target)) setMobileOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) return <div className="wrap"><p className="muted">Loading...</p></div>;
  const owner = ['admin', 'superadmin'].includes(profile.role);
  const isAdminSide = role === 'admin' || role === 'owner';
  const nav = (isAdminSide ? ADMIN_NAV : AGENT_NAV).filter(n => !n[3] || owner);
  const sub = isAdminSide ? (owner ? 'Main Admin' : 'Staff') : 'Agent Portal';
  const active = (href) => path === href || (href !== '/admin' && href !== '/agent' && path.startsWith(href + '/'));

  if (isAdminSide) return (
    <div className="admin-wrap">
      <header className="admin-topbar" ref={navRef}>
        <div className="admin-topbar-inner">
          <div className="admin-brand">
            <div className="admin-brand-logo">{(AGENCY_NAME || 'A').trim().slice(0,1).toUpperCase()}</div>
            <div className="admin-brand-text">
              <strong>{AGENCY_NAME}</strong>
              <span className="admin-brand-sub">{sub}</span>
            </div>
          </div>
          <nav className="admin-nav">
            {nav.map(([href, icon, label]) => (
              <Link key={href} href={href} className={'admin-navlink' + (active(href) ? ' on' : '')} onClick={() => setMobileOpen(false)}>
                <Icon name={icon} size={16} /><span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="admin-topbar-end">
            <button className="admin-logout ghost" onClick={() => signOut(router)}>Log out</button>
            <button className="admin-hamburger ghost" aria-label="Menu" onClick={() => setMobileOpen(o => !o)}>
              <Icon name={mobileOpen ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className="admin-mobile-nav">
            {nav.map(([href, icon, label]) => (
              <Link key={href} href={href} className={'admin-mobile-link' + (active(href) ? ' on' : '')} onClick={() => setMobileOpen(false)}>
                <Icon name={icon} size={16} />{label}
              </Link>
            ))}
            <button className="ghost" style={{ margin: '8px 12px 4px', width: 'calc(100% - 24px)' }} onClick={() => signOut(router)}>Log out</button>
          </nav>
        )}
      </header>
      <PendingStrip admin />
      <main className="admin-page">{typeof children === 'function' ? children(profile) : children}</main>
    </div>
  );

  return (
    <div className="topwrap">
      <header className="topbar">
        <div className="topbrand"><Logo name={AGENCY_NAME} /><div><strong>{profile.agency_name}</strong><div className="muted small">{sub}</div></div></div>
        <nav className="topnav">{nav.map(([href, icon, label]) => <Link key={href} href={href} className={'toplink' + (active(href) ? ' on' : '')}><Icon name={icon} />{label}</Link>)}<button className="ghost toplogout" onClick={() => signOut(router)}>Log out</button></nav>
      </header>
      <PendingStrip admin={false} />
      <main className="topmain"><h1>{title}</h1>{typeof children === 'function' ? children(profile) : children}</main>
    </div>
  );
}
