'use client';
import { useState } from 'react';
import { supabase } from '../lib/db';
import { dOnly } from '../lib/format';
import { TITLES, TYPES, TYPE_LABEL, passportShort } from '../lib/passenger';
import CountrySelect from './CountrySelect';

// Shows passengers of one booking. If canEdit, each row can be corrected (typing mistakes).
// departure (optional) = flight date, used to flag passports with less than 6 months validity.
export default function PassengerList({ passengers, canEdit, onSaved, departure }) {
  const [editId, setEditId] = useState(null);
  const [f, setF] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setF({ ...f, [k]: e.target.value });

  function start(p) {
    setEditId(p.id); setErr('');
    setF({ title: p.title || '', first_name: p.first_name, last_name: p.last_name, pax_type: p.pax_type || 'adult', dob: p.dob, passport_number: p.passport_number, passport_expiry: p.passport_expiry, nationality: p.nationality });
  }

  async function save() {
    setBusy(true); setErr('');
    if (Object.values(f).some(v => !String(v).trim())) { setErr('Fill all fields (including title and nationality).'); setBusy(false); return; }
    if (departure && passportShort(f.passport_expiry, departure) &&
        !confirm('This passport is valid for less than 6 months after the flight date. The passenger may be refused boarding. Save anyway?')) { setBusy(false); return; }
    const { error } = await supabase.from('passengers').update({
      ...f, first_name: f.first_name.trim(), last_name: f.last_name.trim(),
      passport_number: f.passport_number.trim().toUpperCase(), nationality: f.nationality.trim(),
    }).eq('id', editId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEditId(null); onSaved && onSaved();
  }

  return (
    <div>
      {err && <div className="error">{err}</div>}
      <div className="scroll">
        <table>
          <thead><tr><th>#</th><th>Title</th><th>First name</th><th>Last name</th><th>Type</th><th>DOB</th><th>Passport no.</th><th>Passport expiry</th><th>Nationality</th>{canEdit && <th></th>}</tr></thead>
          <tbody>
            {passengers.map((p, i) => editId === p.id ? (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td><select value={f.title} onChange={set('title')}><option value="">Title</option>{TITLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                <td><input value={f.first_name} onChange={set('first_name')} /></td>
                <td><input value={f.last_name} onChange={set('last_name')} /></td>
                <td><select value={f.pax_type} onChange={set('pax_type')}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
                <td><input type="date" value={f.dob} onChange={set('dob')} /></td>
                <td><input value={f.passport_number} onChange={set('passport_number')} /></td>
                <td><input type="date" value={f.passport_expiry} onChange={set('passport_expiry')} /></td>
                <td><CountrySelect value={f.nationality} onChange={v => setF({ ...f, nationality: v })} /></td>
                <td><div className="actions"><button className="ok" disabled={busy} onClick={save}>Save</button><button className="ghost" onClick={() => setEditId(null)}>Cancel</button></div></td>
              </tr>
            ) : (
              <tr key={p.id}>
                <td>{i + 1}</td><td>{p.title ? p.title[0] + p.title.slice(1).toLowerCase() : '-'}</td><td>{p.first_name}</td><td>{p.last_name}</td>
                <td>{TYPE_LABEL[p.pax_type] || 'Adult'}</td><td>{dOnly(p.dob)}</td>
                <td>{p.passport_number}</td>
                <td>{dOnly(p.passport_expiry)}{departure && passportShort(p.passport_expiry, departure) && <div className="neg small">less than 6 months</div>}</td>
                <td>{p.nationality}</td>
                {canEdit && <td><button className="ghost" onClick={() => start(p)}>Edit</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
