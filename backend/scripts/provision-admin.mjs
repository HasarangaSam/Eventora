import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const clerkUserId = process.argv[2]?.trim();
if (!clerkUserId) {
  console.error('Usage: npm run admin:provision -- <clerk-user-id>');
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required in backend/.env');
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(584893271004::bigint)`;
      const activeAdmins = await tx.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdmins > 0) throw new Error('An active administrator already exists');
      const target = await tx.user.findUnique({ where: { clerkUserId } });
      if (!target) throw new Error('No synchronized Eventora user matches that Clerk ID');
      if (target.status !== 'ACTIVE') throw new Error('The target account is deactivated');
      await tx.user.update({ where: { id: target.id }, data: { role: 'ADMIN' } });
    }, { isolationLevel: 'Serializable' });
    console.log(`Provisioned the initial administrator for ${clerkUserId}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Administrator provisioning failed');
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
