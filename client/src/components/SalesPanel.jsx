'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/db';
import SalesChart, { buildBuckets } from './SalesChart';
import { money } from '../lib/format';

// Sales cards + graph. Shown to the owner and to staff the owner ticked. Everyone else gets nothing (the database refuses, the panel hides itself).
export default function SalesPanel({ detailsLink = true, onNoAccess }) {
  const [rows, setRows] = useState(null);
  const [mode, setMode] = useState('days');
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('admin_sales_series', { p_days: 400 });
      if (error) {
        if (/No access/i.test(error.message)) { setDenied(true); if (onNoAccess) onNoAccess(); }
        else setError(error.message);
        return;
      }
      setRows(data || []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => {
    if (!rows) return null;
    const days = buildBuckets(rows, 'days'), months = buildBuckets(rows, 'months');
    const today = days[days.length - 1], month = months[months.length - 1];
    return { today, month, cover: month.sales > 0 ? Math.round((month.costed / month.sales) * 100) : null };
  }, [rows]);

  if (denied) return null;
  if (error) return <div className="error">{error}</div>;
  if (!rows) return <div className="card"><p className="muted">Loading sales...</p></div>;

  return (
    <div className="card">
      <div className="stats" style={{ marginBottom: 14 }}>
        <div className="stat"><span className="muted small">Sales today</span><b>{money(cards.today.sales)}</b></div>
        <div className="stat"><span className="muted small">Sales this month</span><b>{money(cards.month.sales)}</b></div>
        <div className="stat"><span className="muted small">Profit this month</span><b className={cards.month.profit < 0 ? 'neg' : ''}>{cards.month.costed ? money(cards.month.profit) : '-'}</b>
          {cards.cover != null && <span className="muted small">{cards.month.costed ? `counted on ${cards.cover}% of sales` : 'add buying prices to see profit'}</span>}
        </div>
      </div>
      <div className="actions" style={{ marginBottom: 8, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div className="actions" style={{ gap: 6 }}>
          <button className={mode === 'days' ? '' : 'ghost'} onClick={() => setMode('days')}>Last 30 days</button>
          <button className={mode === 'months' ? '' : 'ghost'} onClick={() => setMode('months')}>Last 12 months</button>
        </div>
        <span className="small muted"><span style={{ color: '#0369a1' }}>■</span> Sales &nbsp; <span style={{ color: '#15803d' }}>■</span> Profit</span>
      </div>
      <SalesChart rows={rows} mode={mode} />
      <p className="muted small" style={{ margin: '6px 0 0' }}>Confirmed and issued ticket bookings only.{detailsLink && <> <Link href="/admin/sales">Buying prices and profit by flight →</Link></>}</p>
    </div>
  );
}
