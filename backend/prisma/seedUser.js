//Seed users from Excel file into database
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

// Convert Excel serial date number to JS Date
function excelDateToJSDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  return new Date(utcDays * 86400 * 1000);
}

async function main() {
  const filePath = path.join(__dirname, 'excel', 'Employee details- app 2026.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Skip header row, filter out empty rows
  const dataRows = rows.slice(1).filter(row => row.length > 0 && row[0]);

  console.log(`Found ${dataRows.length} users in Excel file.\n`);

  for (const row of dataRows) {
    // A=slNo, B=bioId, C=employeeId, D=name, E=password, F=salary, G=email, H=designation, I=role, J=doj
    const [slNo, bioId, employeeId, name, password, salary, email, designation, role, doj] = row;

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const dateOfJoining = typeof doj === 'number' ? excelDateToJSDate(doj) : new Date(doj);

    const userData = {
      employeeId:     String(employeeId),
      employeeNumber: Number(bioId),
      name:           String(name),
      email:          String(email),
      passwordHash:   hashedPassword,
      designation:    String(designation || 'Annotator'),
      role:           String(role || 'EMPLOYEE'),
      baseSalary:     Number(salary) || 22000,
      dateOfJoining,
      status: 'ACTIVE',
    };

    const user = await prisma.user.upsert({
      where: { employeeId: userData.employeeId },
      update: {
        employeeNumber: userData.employeeNumber,
        name:           userData.name,
        email:          userData.email,
        passwordHash:   userData.passwordHash,
        designation:    userData.designation,
        role:           userData.role,
        baseSalary:     userData.baseSalary,
        dateOfJoining:  userData.dateOfJoining,
        status:         userData.status,
      },
      create: userData,
    });

    console.log(`Created user: ${user.name} (${user.employeeId}) - ${user.email}`);

    // Create leave balance for 2026
    await prisma.leaveBalance.upsert({
      where: {
        userId_year: {
          userId: user.id,
          year: 2026,
        },
      },
      update: {},
      create: {
        userId: user.id,
        year: 2026,
        casualLeaveTotal: 12,
        casualLeaveUsed: 0,
        casualLeavePending: 0,
        casualLeaveAvailable: 12,
      },
    });
  }

  console.log(`\nSuccessfully seeded ${dataRows.length} users with leave balances.`);
}

main()
  .catch((e) => {
    console.error('Error seeding users:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });