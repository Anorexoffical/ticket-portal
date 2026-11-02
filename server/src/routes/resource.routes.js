import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import prisma from '../config/prisma.js';

const router = Router();
const models = {
  profiles: 'user', flights: 'flight', bookings: 'booking', passengers: 'passenger', payments: 'payment',
  bank_accounts: 'bankAccount', hold_rules: 'holdRule', suppliers: 'supplier', flight_legs: 'flightLeg',
  flight_private: 'flightPrivate', flight_cost: 'flightCost', flights_with_seats: 'flight', pending_payments: 'booking', audit_log: 'auditLog',
};
const fields = {
  user: { id: true, email: true, role: true, status: true, agencyName: true, phone: true, whatsapp: true, ownerName: true, address: true, licenseNo: true, voucherStyle: true, deliveryPref: true, discount: true, umrahAccess: true, canSeeProfit: true, createdAt: true },
  flight: true, booking: true, passenger: true, payment: true, bankAccount: true, holdRule: true, supplier: true, flightLeg: true, flightPrivate: true, flightCost: true, booking: true, auditLog: true,
};

const writeAliases = { agency_name: 'agencyName', owner_name: 'ownerName', delivery_pref: 'deliveryPref', departure_at: 'departureAt', arrival_at: 'arrivalAt', total_seats: 'totalSeats', hold_hours: 'holdHours', flight_no: 'flightNo', agent_id: 'agentId', flight_id: 'flightId', booking_id: 'bookingId', created_at: 'createdAt', hold_expires_at: 'holdExpiresAt', total_amount: 'totalAmount', paid_amount: 'paidAmount', ticket_pdf_path: 'ticketPdfPath', discount_per_ticket: 'discount', booking_no: 'bookingNo', edit_unlocked: 'editUnlocked', confirmed_by: 'confirmedBy' };
const aliases = writeAliases;
const prismaData = body => Object.fromEntries(Object.entries(body || {}).map(([key, value]) => [writeAliases[key] || key, value]).filter(([key]) => key !== 'profiles'));

router.get('/resources/:table', requireAuth, asyncHandler(async (req, res) => {
  const modelName = models[req.params.table];

  // Virtual: agent_balances
  if (req.params.table === 'agent_balances') {
    const agents = await prisma.user.findMany({ where: { role: 'agent' }, select: { id: true, agencyName: true } });
    const bookings = await prisma.booking.findMany({ where: { status: { not: 'cancelled' } }, select: { agentId: true, totalAmount: true } });
    const payments = await prisma.payment.findMany({ select: { agentId: true, amount: true } });
    const map = {};
    for (const a of agents) map[a.id] = { agent_id: a.id, agency_name: a.agencyName, total_booked: 0, total_paid: 0 };
    for (const b of bookings) if (map[b.agentId]) map[b.agentId].total_booked += Number(b.totalAmount);
    for (const p of payments) if (map[p.agentId]) map[p.agentId].total_paid += Number(p.amount);
    return res.json({ data: Object.values(map) });
  }

  // Virtual: agent_ledger
  if (req.params.table === 'agent_ledger') {
    const agentId = req.query.agent_id;
    if (!agentId) return res.json({ data: [] });
    const [bookings, payments] = await Promise.all([
      prisma.booking.findMany({ where: { agentId }, orderBy: { createdAt: 'asc' }, include: { flight: { include: { private: true } }, passengers: true } }),
      prisma.payment.findMany({ where: { agentId }, orderBy: { createdAt: 'asc' }, include: { booking: { include: { flight: { include: { private: true } }, passengers: true } } } }),
    ]);
    const passengerText = passengers => passengers.map(p => `${p.title || ''} ${p.firstName} ${p.lastName}${p.passportNumber ? ` (${p.passportNumber})` : ''}`.replace(/\s+/g, ' ').trim()).join(', ');
    const rows = [
      ...bookings.map(b => {
        const sector = b.flight ? `${b.flight.origin}-${b.flight.destination}` : '-';
        return { type: 'booking', id: b.id, ref: b.ref, booking_no: b.bookingNo, pnr: b.pnr || '', debit: Number(b.totalAmount), credit: 0, amount: Number(b.totalAmount), status: b.status, created_at: b.createdAt,
          description: `Booking ${b.ref}${b.pnr ? ` | PNR ${b.pnr}` : ''} | ${passengerText(b.passengers)} | Sector: ${sector} | Flight: ${b.flight?.flightNo || '-'}` };
      }),
      ...payments.map(p => {
        const b = p.booking;
        const sector = b?.flight ? `${b.flight.origin}-${b.flight.destination}` : '-';
        return { type: 'payment', id: p.id, booking_id: p.bookingId, ref: b?.ref, booking_no: b?.bookingNo, pnr: b?.pnr || '', debit: 0, credit: Number(p.amount), amount: Number(p.amount), method: p.method, note: p.note, created_at: p.createdAt,
          description: `Payment received${b?.ref ? ` for ${b.ref}` : ''}${b?.pnr ? ` | PNR ${b.pnr}` : ''} | ${sector}${p.method ? ` | ${p.method}` : ''}${p.note ? ` | ${p.note}` : ''}` };
      }),
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return res.json({ data: rows });
  }

  if (!modelName) return res.status(404).json({ message: 'Unknown resource' });
  const model = prisma[modelName];
  const where = {};
  for (const [rawKey, rawValue] of Object.entries(req.query)) {
    if (['select', 'order', 'limit', 'count'].includes(rawKey)) continue;
    const [rawName, operator] = rawKey.split('__');
    const key = writeAliases[rawName] || rawName;
    let value = rawValue;
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (/^\d{4}-\d{2}-\d{2}/.test(value)) value = new Date(value);
    else if (/^-?\d+(\.\d+)?$/.test(value)) value = Number(value);
    if (operator && ['gt', 'gte', 'lt', 'lte', 'neq'].includes(operator)) where[key] = { [operator]: value };
    else if (operator === 'in') where[key] = { in: rawValue.split(',') };
    else where[key] = value;
  }
  const args = { where, take: req.query.limit ? Number(req.query.limit) : undefined };
  let data;
  if (req.params.table === 'bookings') {
    data = await model.findMany({ ...args, include: { agent: true, flight: true, passengers: true, payments: true, confirmer: true } });
    data = data.map(booking => ({
      ...booking,
      flights: booking.flight ? {
        id: booking.flight.id,
        airline: booking.flight.airline,
        flight_no: booking.flight.flightNo,
        origin: booking.flight.origin,
        destination: booking.flight.destination,
        departure_at: booking.flight.departureAt,
        arrival_at: booking.flight.arrivalAt,
        price: booking.flight.price,
      } : null,
      profiles: booking.agent ? { agency_name: booking.agent.agencyName, agent_no: booking.agent.agencyName, whatsapp: booking.agent.whatsapp, email: booking.agent.email, delivery_pref: booking.agent.deliveryPref } : null,
      confirmer: booking.confirmer ? { agency_name: booking.confirmer.agencyName } : null,
      payments: (booking.payments || []).map(p => ({
        id: p.id,
        booking_id: p.bookingId,
        agent_id: p.agentId,
        amount: p.amount,
        method: p.method,
        note: p.note,
        recorded_by: p.recordedBy,
        created_at: p.createdAt,
      })),
      passengers: (booking.passengers || []).map(p => ({
        id: p.id,
        booking_id: p.bookingId,
        title: p.title,
        first_name: p.firstName,
        last_name: p.lastName,
        pax_type: p.paxType,
        dob: p.dob instanceof Date ? p.dob.toISOString().slice(0, 10) : p.dob,
        passport_number: p.passportNumber,
        passport_expiry: p.passportExpiry instanceof Date ? p.passportExpiry.toISOString().slice(0, 10) : p.passportExpiry,
        nationality: p.nationality,
      })),
    }));
  } else if (req.params.table === 'flights_with_seats') {
    data = await model.findMany({ ...args, include: { bookings: { where: { status: { in: ['on_hold', 'confirmed', 'issued'] } }, select: { passengers: { select: { id: true } } } } } });
    data = data.map(flight => ({ ...flight, seats_left: flight.totalSeats - flight.bookings.reduce((sum, booking) => sum + booking.passengers.length, 0), bookings: undefined }));
  } else {
    data = req.params.table === 'bookings' || req.params.table === 'pending_payments'
      ? await model.findMany({ ...args, include: { agent: true, confirmer: true } })
      : await model.findMany(args);
  }
  const serialize = (row) => {
    if (!row || typeof row !== 'object') return row;
    const out = { ...row };
    for (const [snake, camel] of Object.entries(Object.fromEntries(Object.entries(aliases).map(([a,b]) => [b,a])))) if (snake in out) out[camel] = out[snake];
    if (out.agent) {
      out.profiles = { agency_name: out.agent.agencyName };
      out.agency_name = out.agent.agencyName;
    }
    // computed balance for pending_payments
    if (req.params.table === 'pending_payments') {
      out.balance = (Number(out.total_amount || out.totalAmount) - Number(out.paid_amount || out.paidAmount)).toFixed(2);
      out.booking_id = out.id;
    }
    return out;
  };
  res.json({ data: Array.isArray(data) ? data.map(serialize) : serialize(data), count: Array.isArray(data) ? data.length : undefined });
}));

router.post('/resources/:table', requireAuth, asyncHandler(async (req, res) => {
  const modelName = models[req.params.table];
  if (!modelName) return res.status(404).json({ message: 'Unknown resource' });
  const data = await prisma[modelName].create({ data: prismaData(req.body) });
  res.status(201).json({ data });
}));
router.patch('/resources/:table/:id', requireAuth, asyncHandler(async (req, res) => {
  const modelName = models[req.params.table];
  if (!modelName) return res.status(404).json({ message: 'Unknown resource' });
  const data = await prisma[modelName].update({ where: { id: req.params.id }, data: prismaData(req.body) });
  res.json({ data });
}));
router.delete('/resources/:table/:id', requireAuth, asyncHandler(async (req, res) => {
  const modelName = models[req.params.table];
  if (!modelName) return res.status(404).json({ message: 'Unknown resource' });
  await prisma[modelName].delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default router;
