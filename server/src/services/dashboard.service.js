import prisma from '../config/prisma.js';

export async function adminDashboard() {
  const now = new Date();
  const [pendingAgents, holds, outstanding, flights] = await Promise.all([
    prisma.user.count({ where: { role: 'agent', status: 'pending' } }),
    prisma.booking.findMany({ where: { status: 'on_hold' }, include: { agent: true }, orderBy: { holdExpiresAt: 'asc' } }),
    prisma.booking.aggregate({ where: { status: { in: ['on_hold', 'confirmed', 'issued'] } }, _sum: { totalAmount: true } }),
    prisma.flight.count({ where: { active: true, departureAt: { gt: now } } }),
  ]);
  return { pendingAgents, holds, outstanding: Number(outstanding._sum.totalAmount || 0), flights };
}
