// Builds the passenger list (Excel) of ONE flight, in a layout that is easy to copy into an airline group form.
const pad = n => String(n).padStart(2, '0');
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const dmy = d => { if (!d) return ''; const x = new Date(d.length === 10 ? d + 'T00:00:00' : d); return `${pad(x.getDate())}${MON[x.getMonth()]}${x.getFullYear()}`; };
const when = d => { if (!d) return ''; const x = new Date(d); return `${dmy(d)} ${pad(x.getHours())}:${pad(x.getMinutes())}`; };
const TYPE = { adult: 'ADULT', child: 'CHILD', infant: 'INFANT' };
const STATUS = { on_hold: 'ON HOLD', confirmed: 'CONFIRMED', issued: 'TICKET ISSUED' };

// flight: row of flights, bookings: rows with passengers + agent profile, pnr: airline PNR, sector: "ISB - JED - ISB"
export async function buildPaxWorkbook({ flight, bookings, pnr, sector }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Passengers', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });

  const rows = [];
  [...bookings].sort((a, b) => (a.booking_no || 0) - (b.booking_no || 0)).forEach(b => {
    (b.passengers || []).forEach(p => rows.push({ b, p }));
  });
  const count = t => rows.filter(r => (r.p.pax_type || 'adult') === t).length;

  const info = [
    ['GROUP PASSENGER LIST'],
    ['Airline', flight.airline, '', 'Flight', flight.flight_no],
    ['Sector', sector, '', 'Departure', when(flight.departure_at)],
    ['Airline PNR', pnr || '', '', 'Total passengers', rows.length],
    ['Adults', count('adult'), '', 'Children / Infants', `${count('child')} / ${count('infant')}`],
    [],
  ];
  info.forEach(r => ws.addRow(r));
  ws.getRow(1).font = { bold: true, size: 14 };
  [2, 3, 4, 5].forEach(i => { ws.getRow(i).getCell(1).font = { bold: true }; ws.getRow(i).getCell(4).font = { bold: true }; });

  const head = ['SR', 'TITLE', 'SURNAME', 'GIVEN NAME', 'NAME FOR AIRLINE', 'TYPE', 'DATE OF BIRTH', 'PASSPORT NO', 'PASSPORT EXPIRY', 'NATIONALITY', 'AGENT', 'BOOKING #', 'STATUS'];
  const h = ws.addRow(head);
  h.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075985' } }; c.alignment = { vertical: 'middle' }; });
  const headRow = h.number;

  rows.forEach(({ b, p }, i) => {
    const sur = String(p.last_name || '').toUpperCase(), giv = String(p.first_name || '').toUpperCase(), ti = String(p.title || '').toUpperCase();
    const r = ws.addRow([i + 1, ti, sur, giv, `${sur}/${giv}${ti ? ' ' + ti : ''}`, TYPE[p.pax_type] || 'ADULT', dmy(p.dob), String(p.passport_number || '').toUpperCase(), dmy(p.passport_expiry), String(p.nationality || '').toUpperCase(), String(b.profiles?.agency_name || '').toUpperCase(), b.booking_no || '', STATUS[b.status] || b.status]);
    r.eachCell(c => { c.border = { bottom: { style: 'thin', color: { argb: 'FFD9E2EC' } } }; });
  });

  const widths = [5, 8, 18, 18, 30, 9, 13, 15, 15, 16, 22, 11, 15];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: headRow }];
  ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: headRow, column: head.length } };
  return { wb, count: rows.length };
}
