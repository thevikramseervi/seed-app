import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const employeeId = 'CITSEED444';
  const newDate = new Date('2024-10-04'); // October 4, 2024

  const user = await prisma.user.findUnique({ where: { employeeId } });
  if (!user) {
    console.error('User not found:', employeeId);
    return;
  }

  await prisma.user.update({
    where: { employeeId },
    data: { dateOfJoining: newDate },
  });

  console.log(`Updated ${employeeId} dateOfJoining -> ${newDate.toISOString().slice(0,10)}`);
}

main()
  .catch((e) => {
    console.error('Error updating joining date:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
