import prisma from '../config/prisma.js';

export async function listFlights() {
  return prisma.flight.findMany({ where: { active: true }, include: { legs: true }, orderBy: { departureAt: 'asc' } });
}

export async function listAdminFlights() {
  return prisma.flight.findMany({ include: { legs: true, private: true }, orderBy: { departureAt: 'desc' } });
}

export async function createFlight(data) {
  return prisma.flight.create({ data: { airline: data.airline, flightNo: data.flightNo, origin: data.origin, destination: data.destination, departureAt: new Date(data.departureAt), arrivalAt: data.arrivalAt ? new Date(data.arrivalAt) : null, price: data.price, baggage: data.baggage || null, meal: data.meal || null, totalSeats: Number(data.totalSeats), holdHours: Number(data.holdHours || 6), active: data.active !== false } });
}
