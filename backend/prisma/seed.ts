import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default super admin
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@cambridge.edu.in' },
    update: {},
    create: {
      employeeId: 'CITADMIN001',
      employeeNumber: 1,
      name: 'Super Admin',
      email: 'admin@cambridge.edu.in',
      passwordHash: hashedPassword,
      designation: 'Administrator',
      role: 'SUPER_ADMIN',
      dateOfJoining: new Date('2026-01-01'),
      baseSalary: 50000,
      status: 'ACTIVE',
    },
  });

  console.log('✅ Created super admin:', superAdmin.email);

  // Create holidays (2025 December for payroll alignment with attendance calendar, then 2026)
  const holidays = [
    { date: new Date('2025-12-25'), name: 'Christmas', description: 'Christian Holiday' },
    { date: new Date('2025-12-26'), name: 'Boxing Day / Day after Christmas', description: 'Optional Holiday' },
    { date: new Date('2026-01-26'), name: 'Republic Day', description: 'National Holiday' },
    { date: new Date('2026-03-08'), name: 'Maha Shivaratri', description: 'Hindu Festival' },
    { date: new Date('2026-03-25'), name: 'Holi', description: 'Festival of Colors' },
    { date: new Date('2026-04-02'), name: 'Good Friday', description: 'Christian Holiday' },
    { date: new Date('2026-04-10'), name: 'Ramadan', description: 'Islamic Festival' },
    { date: new Date('2026-04-14'), name: 'Ugadi', description: 'Kannada New Year' },
    { date: new Date('2026-05-01'), name: 'May Day', description: 'Workers Day' },
    { date: new Date('2026-08-15'), name: 'Independence Day', description: 'National Holiday' },
    { date: new Date('2026-08-26'), name: 'Janmashtami', description: 'Hindu Festival' },
    { date: new Date('2026-10-02'), name: 'Gandhi Jayanti', description: 'National Holiday' },
    { date: new Date('2026-10-24'), name: 'Dussehra', description: 'Hindu Festival' },
    { date: new Date('2026-11-13'), name: 'Diwali', description: 'Festival of Lights' },
    { date: new Date('2026-12-25'), name: 'Christmas', description: 'Christian Holiday' },
  ];

  for (const holiday of holidays) {
    await prisma.holiday.upsert({
      where: { date: holiday.date },
      update: {},
      create: holiday,
    });
  }

  console.log(`✅ Created ${holidays.length} holidays (incl. Dec 2025 for payroll alignment)`);

  // Create initial leave balance for super admin (2026)
  await prisma.leaveBalance.upsert({
    where: {
      userId_year: {
        userId: superAdmin.id,
        year: 2026,
      },
    },
    update: {},
    create: {
      userId: superAdmin.id,
      year: 2026,
      casualLeaveTotal: 12,
      casualLeaveUsed: 0,
      casualLeavePending: 0,
      casualLeaveAvailable: 12,
    },
  });

  console.log('✅ Created leave balance for super admin');

  // Create a sample announcement
  await prisma.announcement.create({
    data: {
      title: 'Welcome to Attend Ease!',
      content: 'The new automated attendance and payroll system is now live. You can now view your daily attendance, apply for leaves, and download salary slips online.',
      priority: 'HIGH',
      isPinned: true,
      isActive: true,
      targetAudience: 'ALL',
      createdBy: superAdmin.id,
    },
  });

  console.log('✅ Created welcome announcement');

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📧 Super Admin Credentials:');
  console.log('   Email: admin@cambridge.edu.in');
  console.log('   Password: admin123');
  console.log('\n⚠️  Please change the default password after first login!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
