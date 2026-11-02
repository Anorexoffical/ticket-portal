'use client';
// Shared pieces of the Umrah pages: the style block (everything is scoped under .um, so ticket pages cannot change),
// the +/- stepper and the stay timeline (Makkah -> Madinah -> Makkah).

const CSS = `
.um{--um-bd:#bae6fd;--um-soft:#e0f2fe;--um-ink:#0c2d48;--um-mute:#475569;--um-mk:#0369a1;--um-md:#15803d}
.um *{box-sizing:border-box}
/* two columns on a computer: steps on the left, live price on the right */
.um-layout{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;align-items:start}
.um-side{position:sticky;top:84px}
@media (max-width:980px){.um-layout{grid-template-columns:minmax(0,1fr)}.um-side{position:static}}

.um-sec h2{display:flex;align-items:center;gap:10px;margin:0 0 14px;font-size:18px;letter-spacing:-.01em;line-height:1.2}
.um-sec h2 small{font-weight:500;color:var(--um-mute);font-size:13px;letter-spacing:0}
.um-num{width:28px;height:28px;border-radius:50%;background:var(--p,#0369a1);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex:none}
.um-hint{color:var(--um-mute);font-size:13px;margin:10px 0 0}

/* + / - steppers */
.um-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}
.um-step{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#fff;border:1px solid var(--um-bd);border-radius:14px;padding:10px 12px}
.um-step-l{font-weight:700;color:var(--um-ink);line-height:1.2}
.um-step-h{font-size:12px;color:var(--um-mute);margin-top:2px}
.um-step-c{display:flex;align-items:center;gap:10px;flex:none}
.um-step-v{min-width:26px;text-align:center;font-size:22px;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.um button.um-round{width:44px;height:44px;min-height:44px;padding:0;border-radius:50%;font-size:24px;line-height:1;font-weight:600;background:var(--um-soft);color:var(--pd,#075985)}
.um button:active:not(:disabled){transform:scale(.95)}
.um button{transition:transform 100ms ease-out,filter .15s}

/* hotel parts */
.um-slot{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:10px;align-items:end;padding:12px 14px 12px 16px;margin-bottom:10px;border:1px solid var(--um-bd);border-radius:14px;background:#fff;position:relative}
.um-slot::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:4px;border-radius:0 4px 4px 0}
.um-slot.mk::before{background:var(--um-mk)}.um-slot.md::before{background:var(--um-md)}
.um-slot label{margin-top:0}
.um-n{font-size:22px;font-weight:800;letter-spacing:-.02em;padding:8px 0}

/* the result card (this is what the client sees) */
.um-res{background:#fff;border:1px solid var(--um-bd);border-radius:22px;padding:24px;box-shadow:0 1px 2px rgba(12,45,72,.06),0 12px 32px rgba(12,45,72,.08);transition:opacity .2s}
.um-stale{opacity:.55}
.um-agency{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--um-mute);font-weight:700}
.um-title{font-size:clamp(1.6rem,4.5vw,2.1rem);line-height:1.05;letter-spacing:-.025em;margin:4px 0 2px;font-weight:800;color:var(--um-ink)}
.um-sum{color:var(--um-mute);font-size:15px}
.um-blk{margin-top:20px}
.um-lab{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--um-mute);font-weight:700;margin-bottom:8px}
.um-flights{display:grid;grid-template-columns:1fr;gap:8px}
.um-leg{background:#f6fbff;border:1px solid var(--um-bd);border-radius:14px;padding:12px 14px}
.um-leg span{display:block;color:var(--um-mute);font-size:13px}
.um-leg b{display:block;font-size:17px;letter-spacing:-.01em;color:var(--um-ink)}
.um-bar{display:flex;gap:4px;height:10px;margin:0 0 10px}
.um-bar i{display:block;border-radius:6px;min-width:6px}
.um-bar i.mk,.um-part.mk::before{background:var(--um-mk)}
.um-bar i.md,.um-part.md::before{background:var(--um-md)}
.um-parts{display:grid;gap:8px}
.um-part{position:relative;border:1px solid var(--um-bd);border-radius:14px;padding:12px 14px 12px 18px;background:#fff}
.um-part::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:4px;border-radius:0 4px 4px 0}
.um-part .c{font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:800}
.um-part.mk .c{color:var(--um-mk)}.um-part.md .c{color:var(--um-md)}
.um-part b{display:block;font-size:16px;letter-spacing:-.01em;color:var(--um-ink)}
.um-part .nn{font-size:26px;font-weight:800;letter-spacing:-.03em;line-height:1.1;color:var(--um-ink)}
.um-part .nn small{font-size:13px;font-weight:600;color:var(--um-mute);letter-spacing:0}
.um-part .m{color:var(--um-mute);font-size:13px}
@media (min-width:641px){.um-main .um-parts{grid-template-columns:repeat(3,minmax(0,1fr))}.um-main .um-parts.two{grid-template-columns:repeat(2,minmax(0,1fr))}.um-main .um-parts.one{grid-template-columns:minmax(0,1fr)}}
.um-chips{display:flex;gap:8px;flex-wrap:wrap}
.um-chip{background:#f6fbff;border:1px solid var(--um-bd);border-radius:99px;padding:5px 12px;font-size:13px;font-weight:700;color:var(--pd,#075985)}
.um-price{width:100%;border-collapse:collapse}
.um-price td{padding:11px 0;border-top:1px solid var(--um-bd);background:none}
.um-price tr:first-child td{border-top:0}
.um-price td:last-child{text-align:right;font-weight:800;font-variant-numeric:tabular-nums}
.um-total{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-top:6px;padding-top:16px;border-top:2px solid var(--um-ink)}
.um-total .t{font-size:14px;color:var(--um-mute);font-weight:700}
.um-total .v{font-size:clamp(1.9rem,6vw,2.6rem);font-weight:800;letter-spacing:-.035em;line-height:1;font-variant-numeric:tabular-nums;color:var(--um-ink)}
.um-total .v small{font-size:.5em;letter-spacing:0;color:var(--um-mute);margin-right:6px;font-weight:700}
.um-empty{border:1px dashed var(--um-bd);border-radius:22px;padding:28px 22px;text-align:center;color:var(--um-mute);background:#fff}
.um-empty b{display:block;color:var(--um-ink);font-size:17px;margin-bottom:4px}
.um-agent{margin-top:12px;padding:14px;border-radius:14px;background:var(--um-soft)}
.um-live{font-size:12px;font-weight:700;color:var(--um-mute);min-height:18px}
.um-hero{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:linear-gradient(135deg,#075985,#0369a1);color:#fff;border-radius:18px;padding:22px 24px;margin-bottom:16px}
.um-hero h2{color:#fff;margin:0 0 4px;font-size:22px;letter-spacing:-.02em}
.um-hero p{margin:0;color:#e0f2fe}
.um button.um-hero-btn{background:#fff;color:#075985;padding:13px 22px;font-size:15px}

/* floating action bar on phones: the page scrolls under it */
.um-dock{display:none}
@media (max-width:980px){
 .um-dock{display:block;position:fixed;left:0;right:0;bottom:0;z-index:30;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.72);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);border-top:1px solid rgba(255,255,255,.8);box-shadow:0 -8px 24px rgba(12,45,72,.08)}
 .um-dock .in{display:flex;gap:10px;align-items:center;justify-content:space-between}
 .um-dock .s{font-size:12px;color:var(--um-mute);font-weight:700;line-height:1.2}
 .um-dock .s b{display:block;font-size:19px;color:var(--um-ink);letter-spacing:-.02em}
 .um-dock .b{display:flex;gap:8px}
 .um-space{height:84px}
}
@media (prefers-reduced-motion:reduce){.um button,.um-res{transition:none!important}.um button:active:not(:disabled){transform:none}}
@media (prefers-reduced-transparency:reduce){.um-dock{background:#fff;backdrop-filter:none;-webkit-backdrop-filter:none}}
@media (prefers-contrast:more){.um-res,.um-part,.um-leg,.um-step,.um-slot{border-color:#0c2d48}}
@media print{.um-layout{display:block}.um-side{position:static}.um-dock,.um-form,.um-space{display:none!important}.um-res{box-shadow:none;border:0;padding:0}}
`;

// the room that fits the group: one group fills one room
export function suggestRoom(n) {
  if (n <= 1) return 'sharing';
  if (n <= 5) return ['', '', 'double', 'triple', 'quad', 'quint'][n];
  for (const [r, c] of [['quint', 5], ['quad', 4], ['triple', 3], ['double', 2]]) if (n % c === 0) return r;
  return 'sharing';
}

export function UmrahStyle() {
  return <style>{CSS}</style>;
}

// big +/- buttons (easy on a phone). max is optional.
export function Stepper({ label, hint, value, onChange, min = 0, max = 60 }) {
  return (
    <div className="um-step">
      <div><div className="um-step-l">{label}</div>{hint && <div className="um-step-h">{hint}</div>}</div>
      <div className="um-step-c">
        <button type="button" className="um-round" aria-label={'Less: ' + label} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <b className="um-step-v" aria-live="polite">{value}</b>
        <button type="button" className="um-round" aria-label={'More: ' + label} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

// the stay as one line split into hotel parts, then a card for each part
// parts: [{ city, name, nights, distance_m, area }]
export function StayBar({ parts, total }) {
  if (!parts || parts.length === 0) return null;
  const cls = parts.length === 1 ? ' one' : parts.length === 2 ? ' two' : '';
  return (
    <div className="um-blk">
      <div className="um-lab">Your stay{total ? ` · ${total} nights` : ''}</div>
      <div className="um-bar">{parts.map((p, i) => <i key={i} className={p.city === 'Makkah' ? 'mk' : 'md'} style={{ flex: p.nights || 1 }} />)}</div>
      <div className={'um-parts' + cls}>
        {parts.map((p, i) => (
          <div key={i} className={'um-part ' + (p.city === 'Makkah' ? 'mk' : 'md')}>
            <div className="c">{p.city}</div>
            <b>{p.name}</b>
            <div className="nn">{p.nights} <small>nights</small></div>
            <div className="m">{p.distance_m != null ? `${p.distance_m} m from Haram` : ''}{p.distance_m != null && p.area ? ' · ' : ''}{p.area || ''}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
