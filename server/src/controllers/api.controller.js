import { asyncHandler } from '../middleware/error.js';
import { adminDashboard } from '../services/dashboard.service.js';
import { createFlight, listAdminFlights, listFlights } from '../services/flight.service.js';
import prisma from '../config/prisma.js';

export const dashboard = asyncHandler(async (req, res) => res.json(await adminDashboard()));
export const flights = asyncHandler(async (req, res) => res.json({ data: await listFlights() }));
export const adminFlights = asyncHandler(async (req, res) => res.json({ data: await listAdminFlights() }));
export const saveFlight = asyncHandler(async (req, res) => res.status(201).json(await createFlight(req.body)));

export const saveFlightRpc = asyncHandler(async (req, res) => {
  const row = req.body.p_row || {};
  const data = {
    airline: row.airline, flightNo: row.flight_no, origin: row.origin, destination: row.destination,
    departureAt: row.departure_at, arrivalAt: row.arrival_at, price: row.price, baggage: row.baggage, meal: row.meal,
    totalSeats: row.total_seats, holdHours: row.hold_hours || Math.max(1, Math.round((row.hold_minutes || 360) / 60)),
    active: row.active !== false,
  };
  const flight = req.body.p_id
    ? await prisma.flight.update({ where: { id: req.body.p_id }, data: { ...data } })
    : await prisma.flight.create({ data });
  if (req.body.p_pnr) await prisma.flightPrivate.upsert({ where: { id: flight.id }, create: { id: flight.id, pnr: req.body.p_pnr }, update: { pnr: req.body.p_pnr } });
  res.json({ data: flight.id });
});
