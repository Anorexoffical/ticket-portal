import { authenticate, registerAgent } from '../services/auth.service.js';
import { signToken } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role, status: user.status, agencyName: user.agencyName, umrahAccess: user.umrahAccess, canSeeProfit: user.canSeeProfit };
}

export async function login(req, res) {
  const user = await authenticate(req.body.email, req.body.password);
  const token = signToken(user);
  res.cookie('ticket_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 12 * 60 * 60 * 1000 });
  res.json({ user: publicUser(user), token });
}
export async function signup(req, res) {
  const user = await registerAgent(req.body);
  res.status(201).json({ user: publicUser(user) });
}
export async function me(req, res) { const prisma = (await import('../config/prisma.js')).default; const user = await prisma.user.findUnique({ where: { id: req.user.sub } }); if (!user) return res.status(401).json({ message: 'User not found' }); res.json(publicUser(user)); }
export function logout(req, res) { res.clearCookie('ticket_token'); res.status(204).end(); }
export async function changePassword(req, res) {
  const prisma = (await import('../config/prisma.js')).default;
  const { password } = req.body;
  if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' });
  const hash = await bcrypt.hash(password, 12);
  await prisma.user.update({ where: { id: req.user.sub }, data: { passwordHash: hash } });
  res.json({ ok: true });
}
