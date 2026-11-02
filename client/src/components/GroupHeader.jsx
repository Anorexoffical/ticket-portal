import AirlineLogo from './AirlineLogo';
import { cityName } from '../lib/cities';

// Centred header above each flight table: logo, airline name, full sector (Islamabad – Dammam)
export default function GroupHeader({ g, size = 40 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4, textTransform: 'uppercase', padding: '14px 18px', background: '#f4f7fc', borderBottom: '1px solid #e6ebf3' }}>
      <AirlineLogo flightNo={g.flightNo} airline={g.name} size={size} />
      <b style={{ fontSize: 17 }}>{g.name}</b>
      <div className="route" style={{ fontSize: 16 }}>{(g.path || [g.origin, g.destination]).map(cityName).join(' – ')}</div>
    </div>
  );
}
