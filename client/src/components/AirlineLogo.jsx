'use client';
import { useState } from 'react';
import { airlineInfo } from '../lib/airlines';

// Airline logo. The airline is found from the flight number (SV725) or, if that is odd, from the
// airline name ("SV", "Saudi", "SAUDIA" all give Saudia). If the logo cannot load,
// a coloured badge with the airline code is shown instead.
export default function AirlineLogo({ flightNo, airline, size = 36 }) {
  const { code, name } = airlineInfo(flightNo, airline);
  const [bad, setBad] = useState(false);
  let hue = 0;
  for (const c of code) hue = (hue * 31 + c.charCodeAt(0)) % 360;

  if (!code || bad) {
    return (
      <span className="logo-fb" title={name || code}
        style={{ width: size, height: size, fontSize: size * 0.4, background: `hsl(${hue} 55% 38%)` }}>
        {code || '?'}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="logo" src={`https://images.kiwi.com/airlines/64x64/${code}.png`} alt={name} title={name}
      width={size} height={size} onError={() => setBad(true)} />
  );
}
