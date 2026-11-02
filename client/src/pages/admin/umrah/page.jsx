import Link from 'next/link';
import Shell from '@/components/Shell.jsx';
import { UmrahStyle } from '@/components/UmrahBits';

// Umrah home. More sections will be added here step by step.
export default function AdminUmrah() {
  const box = { textDecoration: 'none', color: 'inherit' };
  return (
    <Shell role="admin" title="Umrah">
      <div className="um"><UmrahStyle />
        <div className="um-hero"><div><h2>Umrah</h2><p>Hotels, flights and ready packages. Agents see PKR prices only.</p></div></div>
      </div>
      <div className="stats">
        <Link href="/admin/umrah/hotels" className="stat" style={box}>
          <span className="muted small">Makkah and Madinah</span><b>Hotels and rates</b>
        </Link>
        <Link href="/admin/umrah/flights" className="stat" style={box}>
          <span className="muted small">Mark your Umrah flights</span><b>Umrah flights</b>
        </Link>
        <Link href="/admin/umrah/packages" className="stat" style={box}>
          <span className="muted small">Fixed offers with typed prices</span><b>Ready packages</b>
        </Link>
        <Link href="/admin/umrah/costs" className="stat" style={box}>
          <span className="muted small">Visa 15/28/80 days, buying prices</span><b>Visa and costs</b>
        </Link>
        <div className="stat" style={{ opacity: 0.55 }}><span className="muted small">Later</span><b>Bookings, Visa, Transport</b></div>
      </div>
    </Shell>
  );
}
