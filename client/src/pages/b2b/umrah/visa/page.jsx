import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import { UmrahStyle, Stepper } from '@/components/UmrahBits';
import { num } from '@/lib/umrah';

const MEM = 'umrah_visa_v1';

// Visa only: the agent picks 15 / 28 / 80 days and the people. Price in PKR only, works out by itself.
export default function VisaOnly() {
  return <Shell role="agent" title="Visa only">{p => <Visa agency={p?.agency_name || ''} />}</Shell>;
}

function Visa({ agency }) {
  const [opts, setOpts] = useState(null);
  const [days, setDays] = useState(0);
  const [pax, setPax] = useState({ a: 2, c: 0, i: 0 });
  const [markup, setMarkup] = useState('');
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    (async () => {
      let d0 = 0;
      try {
        setMarkup(localStorage.getItem('umrah_markup_visa') || '');
        const s = JSON.parse(localStorage.getItem(MEM) || '{}');
        if (s.pax && ['a', 'c', 'i'].every(k => Number.isInteger(s.pax[k]) && s.pax[k] >= 0 && s.pax[k] <= 60)) setPax(s.pax);
        d0 = Number(s.days) || 0;
      } catch (e) { /* ignore */ }
      setReady(true);
      const { data, error } = await supabase.rpc('umrah_visa_options');
      if (error) { setError(error.message); setOpts([]); return; }
      setOpts(data);
      if (data.some(x => x.days === d0)) setDays(d0); else if (data.length) setDays(data[Math.min(1, data.length - 1)].days);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(MEM, JSON.stringify({ pax, days })); } catch (e) { /* ignore */ }
  }, [ready, pax, days]);

  const key = JSON.stringify([days, pax]);
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const my = ++seq.current;
    if (!opts) return;
    if (!days || pax.a < 1) { setRes(null); setBusy(false); return; }
    setBusy(true);
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('umrah_visa_quote', { p_days: days, p_adults: pax.a, p_children: pax.c, p_inf: pax.i });
      if (my !== seq.current) return;
      setBusy(false);
      if (error) { setError(error.message); setRes(null); return; }
      setError(''); setRes({ key, q: data });
    }, 300);
    return () => clearTimeout(t);
  }, [key, opts]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const m = Number(markup) || 0;
  const setP = (k, v) => setPax(p => ({ ...p, [k]: v }));
  const fresh = res && res.key === key;
  let lines = [], total = 0, payers = 0;
  if (res) {
    const q = res.q;
    lines = [['Adult', q.adults, q.each + m], ['Child', q.children, q.each + m], ['Infant', q.infants, q.each]].filter(x => x[1] > 0);
    payers = q.adults + q.children;
    total = q.total + payers * m;
  }
  function saveMarkup(v) { setMarkup(v); try { localStorage.setItem('umrah_markup_visa', v); } catch (e) { /* ignore */ } }
  function whatsapp() {
    const text = ['*Umrah visa*', `Visa: ${res.q.days} days`, `Passengers: ${res.q.adults} adult${res.q.children ? `, ${res.q.children} child` : ''}${res.q.infants ? `, ${res.q.infants} infant` : ''}`,
      ...lines.map(l => `${l[0]}: PKR ${num(l[2])} each`), `*Total: PKR ${num(total)}*`, agency].filter(Boolean).join('\n');
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }

  return (
    <div className="um">
      <UmrahStyle />
      <style>{'@media print{.topbar,.paystrip,.noprint,.topmain>h1{display:none!important}.topmain{padding:0!important}}'}</style>
      <div className="noprint actions" style={{ marginBottom: 12 }}><Link href="/agent/umrah"><button className="ghost">← Back to Umrah</button></Link></div>
      {error && <div className="error noprint">{error}</div>}
      <div className="um-layout">
        <div className="um-form noprint">
          <div className="card um-sec">
            <h2><span className="um-num">1</span>Visa days</h2>
            {!opts ? <p className="muted">Loading...</p> : opts.length === 0 ? <p className="muted">No visa prices are set yet. Please ask the main agency.</p> : (
              <div className="um-chips" role="radiogroup" aria-label="Visa days">
                {opts.map(o => (
                  <button key={o.days} type="button" role="radio" aria-checked={days === o.days} className={days === o.days ? '' : 'ghost'} style={{ minHeight: 56, flex: '1 1 120px', lineHeight: 1.2 }} onClick={() => setDays(o.days)}>
                    {o.days} days<div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>PKR {num(o.pkr)} each</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="card um-sec">
            <h2><span className="um-num">2</span>Passengers</h2>
            <div className="um-steps">
              <Stepper label="Adults" value={pax.a} onChange={v => setP('a', v)} />
              <Stepper label="Children" value={pax.c} onChange={v => setP('c', v)} />
              <Stepper label="Infants" value={pax.i} onChange={v => setP('i', v)} />
            </div>
            {pax.a < 1 && <p className="neg small" style={{ margin: '10px 0 0' }}>At least 1 adult is needed.</p>}
            <p className="um-hint">Visa only: no flight, no hotel. Every passenger pays the visa price of the chosen days.</p>
          </div>
        </div>
        <div className="um-side">
          <div className="um-live noprint">{busy ? 'Working out the price…' : fresh ? 'Price is up to date' : ''}</div>
          {!res ? <div className="um-empty noprint"><b>Your price will show here</b>Choose the visa days. It works out by itself.</div> : (
            <div className={'um-res' + (fresh ? '' : ' um-stale')}>
              {agency && <div className="um-agency">{agency}</div>}
              <div className="um-title">Umrah visa</div>
              <div className="um-sum">{res.q.days} days · Visa only</div>
              <div className="um-blk">
                <table className="um-price"><tbody>{lines.map(l => <tr key={l[0]}><td>{l[0]} × {l[1]}</td><td>PKR {num(l[2])} each</td></tr>)}</tbody></table>
                <div className="um-total"><span className="t">Total</span><span className="v"><small>PKR</small>{num(total)}</span></div>
              </div>
              <div className="noprint">
                <div className="um-agent">
                  <div className="actions" style={{ flexWrap: 'wrap' }}>
                    <label style={{ margin: 0, fontWeight: 600 }}>Your profit per person (PKR)</label>
                    <input type="number" min="0" step="100" style={{ width: 110 }} value={markup} onChange={e => saveMarkup(e.target.value)} placeholder="0" />
                  </div>
                  <div className="small" style={{ marginTop: 8 }}>You pay the agency: <b>PKR {num(res.q.total)}</b> · Your profit: <b>PKR {num(payers * m)}</b> <span className="muted">(not printed or sent; infants carry no profit)</span></div>
                </div>
                <div className="actions" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                  <button disabled={!fresh} onClick={() => window.print()}>Print / Save as PDF</button>
                  <button className="ok" disabled={!fresh} onClick={whatsapp}>Send on WhatsApp</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="um-space noprint" />
      <div className="um-dock noprint"><div className="in">
        <div className="s">Total<b>{res ? `PKR ${num(total)}` : '—'}</b></div>
        <div className="b"><button disabled={!fresh} onClick={() => window.print()}>PDF</button><button className="ok" disabled={!fresh} onClick={whatsapp}>WhatsApp</button></div>
      </div></div>
    </div>
  );
}
