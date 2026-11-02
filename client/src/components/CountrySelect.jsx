'use client';
import { useMemo } from 'react';
import { countryNames } from '../lib/countries';

// Nationality dropdown. If an old booking has a value that is not in the list, it stays selectable.
export default function CountrySelect({ value, onChange }) {
  const names = useMemo(() => countryNames(), []);
  const list = value && !names.includes(value) ? [value, ...names] : names;
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}>
      <option value="">Select nationality</option>
      {list.map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  );
}
