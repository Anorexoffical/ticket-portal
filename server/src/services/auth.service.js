import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

export async function authenticate(email, password) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    const error = new Error('Invalid email or password'); error.status = 401; throw error;
  }
  if (user.status === 'blocked') { const error = new Error('Account is blocked'); error.status = 403; throw error; }
  if (user.role === 'agent' && user.status === 'pending') { const error = new Error('Your account is awaiting admin approval.'); error.status = 403; throw error; }
  return user;
}

export async function registerAgent(input) {
  const email = input.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) { const error = new Error('Email is already registered'); error.status = 409; throw error; }
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({ data: { email, passwordHash, agencyName: input.agencyName, phone: input.phone, whatsapp: input.whatsapp, role: 'agent', status: 'pending' } });
}
