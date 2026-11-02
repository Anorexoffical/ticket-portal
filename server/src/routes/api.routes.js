import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { dashboard, flights, adminFlights, saveFlight, saveFlightRpc } from '../controllers/api.controller.js';

const router = Router();
router.get('/flights', requireAuth, flights);
router.get('/admin/dashboard', requireAuth, requireRole('admin', 'superadmin', 'staff'), dashboard);
router.get('/admin/flights', requireAuth, requireRole('admin', 'superadmin', 'staff'), adminFlights);
router.post('/admin/flights', requireAuth, requireRole('admin', 'superadmin', 'staff'), saveFlight);
router.post('/rpc/is_owner', requireAuth, (req, res) => res.json({ data: ['admin', 'superadmin'].includes(req.user.role) }));
router.post('/rpc/has_profit', requireAuth, (req, res) => res.json({ data: ['admin', 'superadmin'].includes(req.user.role) }));
router.post('/rpc/owner_set_hold_rules', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const { p_open, p_close, p_day, p_near } = req.body;
  await prisma.holdRule.upsert({ where: { id: 1 }, create: { id: 1, openTime: p_open, closeTime: p_close, dayHoldMax: p_day, nearHoldMax: p_near }, update: { openTime: p_open, closeTime: p_close, dayHoldMax: p_day, nearHoldMax: p_near } });
  res.json({ data: true });
});
router.post('/rpc/owner_save_supplier', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const { p_id, p_name, p_phone, p_note, p_active } = req.body;
  if (!p_name?.trim()) return res.status(400).json({ message: 'Name is required' });
  const data = { name: p_name.trim(), phone: p_phone?.trim() || null, note: p_note?.trim() || null, active: p_active !== false };
  const supplier = p_id
    ? await prisma.supplier.update({ where: { id: p_id }, data })
    : await prisma.supplier.create({ data });
  res.json({ data: supplier.id });
});
router.post('/rpc/admin_save_flight', requireAuth, requireRole('admin', 'superadmin', 'staff'), saveFlightRpc);
router.post('/rpc/admin_sales_series', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const payments = await prisma.payment.findMany({ include: { booking: true }, orderBy: { createdAt: 'asc' } });
  const groups = {};
  for (const payment of payments) {
    const day = payment.createdAt.toISOString().slice(0, 10);
    groups[day] ||= { day, bookings: 0, seats: 0, sales: 0, profit: 0, costed_sales: 0 };
    groups[day].sales += Number(payment.amount);
    groups[day].profit += Number(payment.amount);
    groups[day].bookings += 1;
  }
  res.json({ data: Object.values(groups) });
});
router.post('/rpc/admin_set_booking_status', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const { p_booking, p_status } = req.body;
  const booking = await prisma.booking.update({ where: { id: p_booking }, data: { status: p_status } });
  res.json({ data: booking.id });
});
router.post('/rpc/admin_add_flights', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const rows = req.body.p_rows || [];
  const created = [];
  for (const row of rows) {
    const flight = await prisma.flight.create({ data: { airline: row.airline, flightNo: row.flight_no, origin: row.origin, destination: row.destination, departureAt: new Date(row.departure_at), arrivalAt: row.arrival_at ? new Date(row.arrival_at) : null, price: Number(row.price), baggage: row.baggage || null, meal: row.meal || null, totalSeats: Number(row.total_seats), holdHours: Math.max(1, Math.round((row.hold_minutes || 360) / 60)), active: true } });
    if (row.pnr) await prisma.flightPrivate.create({ data: { id: flight.id, pnr: row.pnr } });
    if (row.legs?.length) await prisma.flightLeg.createMany({ data: row.legs.map((leg, index) => ({ flightId: flight.id, journey: Number(leg.journey || 0), seq: Number(leg.seq ?? index), airline: leg.airline || null, flightNo: leg.flight_no || null, origin: leg.origin || null, destination: leg.destination || null, departureAt: leg.departure_at ? new Date(leg.departure_at) : null, arrivalAt: leg.arrival_at ? new Date(leg.arrival_at) : null })) });
    created.push(flight.id);
  }
  res.json({ data: created });
});

router.post('/rpc/create_booking', requireAuth, requireRole('agent'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const flight = await prisma.flight.findUnique({ where: { id: req.body.p_flight_id }, include: { bookings: { where: { status: { in: ['on_hold', 'confirmed', 'issued'] } }, include: { passengers: true } } } });
  if (!flight || !flight.active) return res.status(404).json({ message: 'Flight not found or unavailable.' });
  if (new Date(flight.departureAt) <= new Date()) return res.status(400).json({ message: 'This flight has already departed.' });
  const passengers = req.body.p_passengers || [];
  if (!passengers.length) return res.status(400).json({ message: 'Add at least one passenger.' });
  const bookedSeats = flight.bookings.reduce((total, booking) => total + booking.passengers.length, 0);
  if (bookedSeats + passengers.length > flight.totalSeats) return res.status(400).json({ message: `Only ${Math.max(0, flight.totalSeats - bookedSeats)} seats available.` });
  const booking = await prisma.booking.create({ data: {
    ref: `BK-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    flightId: flight.id, agentId: req.user.sub, status: 'on_hold',
    holdExpiresAt: new Date(Date.now() + Math.max(1, flight.holdHours) * 60 * 60 * 1000),
    totalAmount: Number(flight.price) * passengers.length, paidAmount: 0,
    passengers: { create: passengers.map(p => ({ title: p.title || '', firstName: p.first_name || '', lastName: p.last_name || '', paxType: (p.pax_type || 'adult').toLowerCase(), dob: new Date(p.dob), passportNumber: p.passport_number || '', passportExpiry: new Date(p.passport_expiry), nationality: p.nationality || '' })) },
  } });
  res.status(201).json({ data: booking });
});
router.post('/rpc/admin_set_agent_status', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.user.update({ where: { id: req.body.p_agent }, data: { status: req.body.p_status } });
  res.json({ data: true });
});
router.post('/rpc/owner_set_agent_discount', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.user.update({ where: { id: req.body.p_agent }, data: { discount: Number(req.body.p_amount) || 0 } });
  res.json({ data: true });
});
router.post('/rpc/owner_set_umrah_access', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.user.update({ where: { id: req.body.p_agent }, data: { umrahAccess: !!req.body.p_on } });
  res.json({ data: true });
});
router.post('/rpc/admin_save_agent', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const { p_id, p_email, p_agency_name, p_owner_name, p_phone, p_whatsapp, p_password } = req.body;
  const data = { agencyName: p_agency_name?.trim() || null, ownerName: p_owner_name?.trim() || null, phone: p_phone?.trim() || null, whatsapp: p_whatsapp?.trim() || p_phone?.trim() || null };
  if (p_password?.trim()) data.passwordHash = await bcrypt.hash(p_password.trim(), 12);
  if (p_id) await prisma.user.update({ where: { id: p_id }, data });
  else {
    if (!p_email?.trim()) return res.status(400).json({ message: 'Email is required.' });
    await prisma.user.create({ data: { ...data, email: p_email.trim().toLowerCase(), passwordHash: data.passwordHash || await bcrypt.hash('ChangeMe123', 12), role: 'agent', status: 'approved' } });
  }
  res.json({ data: true });
});
router.post('/rpc/owner_create_staff', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const { p_email, p_name, p_password, p_permissions } = req.body;
  if (!p_email?.trim()) return res.status(400).json({ message: 'Email is required.' });
  if (!p_password?.trim() || p_password.trim().length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  const existing = await prisma.user.findUnique({ where: { email: p_email.trim().toLowerCase() } });
  if (existing) return res.status(400).json({ message: 'An account with this email already exists.' });
  const perms = p_permissions || {};
  await prisma.user.create({ data: { email: p_email.trim().toLowerCase(), passwordHash: await bcrypt.hash(p_password.trim(), 12), agencyName: p_name?.trim() || null, role: 'staff', status: 'approved', umrahAccess: !!perms.umrah, canSeeProfit: !!perms.seeProfit, permissions: perms } });
  res.json({ data: true });
});
router.post('/rpc/owner_update_staff', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const { p_id, p_name, p_password, p_permissions } = req.body;
  const perms = p_permissions || {};
  const data = { agencyName: p_name?.trim() || null, umrahAccess: !!perms.umrah, canSeeProfit: !!perms.seeProfit, permissions: perms };
  if (p_password?.trim()) {
    if (p_password.trim().length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    data.passwordHash = await bcrypt.hash(p_password.trim(), 12);
  }
  await prisma.user.update({ where: { id: p_id }, data });
  res.json({ data: true });
});
router.post('/rpc/owner_remove_staff', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.user.update({ where: { id: req.body.p_id }, data: { role: 'agent', status: 'pending' } });
  res.json({ data: true });
});
router.post('/rpc/admin_delete_agent', requireAuth, requireRole('admin', 'superadmin'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const bookings = await prisma.booking.count({ where: { agentId: req.body.p_agent } });
  if (bookings) return res.status(400).json({ message: 'This agent has bookings and cannot be deleted. Block the agent instead.' });
  await prisma.user.delete({ where: { id: req.body.p_agent } });
  res.json({ data: true });
});

router.post('/rpc/admin_record_payment', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const { p_booking, p_amount, p_method, p_note } = req.body;
  const booking = await prisma.booking.findUnique({ where: { id: p_booking } });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const amount = Number(p_amount);
  if (!(amount > 0)) return res.status(400).json({ message: 'Invalid amount' });
  const newPaid = Number(booking.paidAmount) + amount;
  const newStatus = newPaid >= Number(booking.totalAmount) ? 'confirmed' : booking.status === 'on_hold' ? 'on_hold' : booking.status;
  await prisma.$transaction([
    prisma.payment.create({ data: { bookingId: p_booking, agentId: booking.agentId, amount, method: p_method || null, note: p_note || null, recordedBy: req.user.sub } }),
    prisma.booking.update({ where: { id: p_booking }, data: { paidAmount: newPaid, status: newStatus } }),
  ]);
  res.json({ data: true });
});

router.post('/rpc/admin_extend_hold', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const { p_booking, p_hours } = req.body;
  const hours = Math.max(1, parseInt(p_hours, 10) || 1);
  const booking = await prisma.booking.findUnique({ where: { id: p_booking } });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });
  const base = booking.status === 'expired' || !booking.holdExpiresAt || new Date(booking.holdExpiresAt) < new Date() ? new Date() : new Date(booking.holdExpiresAt);
  await prisma.booking.update({ where: { id: p_booking }, data: { holdExpiresAt: new Date(base.getTime() + hours * 3600000), status: 'on_hold' } });
  res.json({ data: true });
});

router.post('/rpc/admin_set_pnr', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.booking.update({ where: { id: req.body.p_booking }, data: { pnr: req.body.p_pnr || null } });
  res.json({ data: true });
});

router.post('/rpc/admin_attach_ticket', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.booking.update({ where: { id: req.body.p_booking }, data: { ticketPdfPath: req.body.p_path, status: 'issued' } });
  res.json({ data: true });
});

router.post('/rpc/admin_set_edit_unlock', requireAuth, requireRole('admin', 'superadmin', 'staff'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  await prisma.booking.update({ where: { id: req.body.p_booking }, data: { editUnlocked: !!req.body.p_unlock } });
  res.json({ data: true });
});

router.post('/rpc/cancel_my_booking', requireAuth, requireRole('agent'), async (req, res) => {
  const prisma = (await import('../config/prisma.js')).default;
  const booking = await prisma.booking.findUnique({ where: { id: req.body.p_booking } });
  if (!booking || booking.agentId !== req.user.sub) return res.status(404).json({ message: 'Booking not found' });
  if (Number(booking.paidAmount) > 0) return res.status(400).json({ message: 'Cannot cancel a booking with payments. Contact the main agency.' });
  if (!['on_hold', 'expired'].includes(booking.status)) return res.status(400).json({ message: 'This booking cannot be cancelled.' });
  await prisma.booking.update({ where: { id: req.body.p_booking }, data: { status: 'cancelled' } });
  res.json({ data: true });
});

export default router;
