'use client';
// Sales bars drawn as plain SVG (no extra library). Sales = blue bar, profit = green bar beside it.
// rows come from the database function admin_sales_series: { day:'YYYY-MM-DD', bookings, seats, sales, profit, costed_sales }

const KHI = 'Asia/Karachi';
const ymd = d => new Intl.DateTimeFormat('en-CA', { timeZone: KHI, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const n = v => Number(v) || 0;

// one bucket per day (last 30) or per month (last 12), empty ones filled with 0
export function buildBuckets(rows, mode) {
  const now = new Date();
  const out = [];
  if (mode === 'months') {
    const [y, m] = ymd(now).split('-').map(Number);
    for (let i = 11; i >= 0; i--) {
      const t = new Date(Date.UTC(y, m - 1 - i, 1));
      out.push({ key: `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`, label: MON[t.getUTCMonth()], sales: 0, profit: 0, costed: 0, seats: 0 });
    }
  } else {
    for (let i = 29; i >= 0; i--) {
      const k = ymd(new Date(now.getTime() - i * 86400000));
      out.push({ key: k, label: String(Number(k.slice(8))), sales: 0, profit: 0, costed: 0, seats: 0 });
    }
  }
  const idx = Object.fromEntries(out.map((b, i) => [b.key, i]));
  (rows || []).forEach(r => {
    const k = mode === 'months' ? String(r.day).slice(0, 7) : String(r.day).slice(0, 10);
    const b = out[idx[k]];
    if (!b) return;
    b.sales += n(r.sales); b.profit += n(r.profit); b.costed += n(r.costed_sales); b.seats += n(r.seats);
  });
  return out;
}

const short = v => (v >= 1e7 ? (v / 1e7).toFixed(1) + ' Cr' : v >= 1e5 ? (v / 1e5).toFixed(1) + ' L' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : String(Math.round(v)));
const full = v => 'PKR ' + Math.round(v).toLocaleString('en-PK');

export default function SalesChart({ rows, mode = 'days', showProfit = true }) {
  const data = buildBuckets(rows, mode);
  const W = 640, H = 220, L = 46, R = 8, T = 10, B = 26;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(1, ...data.map(d => Math.max(d.sales, showProfit ? d.profit : 0)));
  const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(max))); const f = max / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; })();
  const y = v => T + ih - (Math.max(v, 0) / nice) * ih;
  const slot = iw / data.length;
  const bw = Math.min(26, slot * 0.7);
  const ticks = [0, 0.5, 1].map(f => f * nice);
  const total = data.reduce((s, d) => s + d.sales, 0);
  const anyProfit = showProfit && data.some(d => d.profit > 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sales per ${mode === 'months' ? 'month' : 'day'}. Total ${full(total)}.`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#bae6fd" strokeWidth="1" strokeDasharray={i === 0 ? '' : '3 4'} />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#475569">{short(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = L + slot * i + slot / 2;
        const two = anyProfit && d.profit > 0;
        const w = anyProfit ? bw / 2 : bw;
        const x0 = cx - bw / 2;
        const showLab = mode === 'months' || i % 3 === 0 || i === data.length - 1;
        return (
          <g key={d.key}>
            <title>{`${d.key}: sales ${full(d.sales)}${showProfit && d.costed ? `, profit ${full(d.profit)}` : ''}, ${d.seats} seats`}</title>
            {d.sales > 0 && <rect x={x0} y={y(d.sales)} width={Math.max(w - 1, 2)} height={y(0) - y(d.sales)} rx="2" fill="#0369a1" />}
            {two && <rect x={x0 + w} y={y(d.profit)} width={Math.max(w - 1, 2)} height={y(0) - y(d.profit)} rx="2" fill="#15803d" />}
            {showLab && <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#475569">{d.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
