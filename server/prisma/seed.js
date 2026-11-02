import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { role: 'superadmin', status: 'approved', passwordHash: await bcrypt.hash('admin', 12) },
    create: { email: 'admin@gmail.com', passwordHash: await bcrypt.hash('admin', 12), agencyName: 'Main Agency', role: 'superadmin', status: 'approved' },
  });
  await prisma.user.upsert({
    where: { email: 'admin+test@gmail.com' },
    update: { role: 'agent', status: 'approved', passwordHash: await bcrypt.hash('admin', 12), umrahAccess: true },
    create: { email: 'admin+test@gmail.com', passwordHash: await bcrypt.hash('admin', 12), agencyName: 'Admin Test Agency', role: 'agent', status: 'approved', umrahAccess: true },
  });
  console.log('Seeded preview users.');
}

main().finally(() => prisma.$disconnect());
