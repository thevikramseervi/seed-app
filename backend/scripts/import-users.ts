import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import { readSheetAsJson } from './lib/excel-reader';
import { getProRataCasualLeaveForYear } from '../src/leave/leave.utils';

const prisma = new PrismaClient();

interface EmployeeRow {
  employeeId: string;
  employeeNumber: number;
  name: string;
  email: string;
  designation: string;
  dateOfJoining: Date;
  baseSalary: number;
  role?: string;
}

async function importUsers(filePath: string) {
  console.log('📥 Starting user import from Excel...');
  console.log(`File: ${filePath}`);

  try {
    // Read Excel file
    const data = await readSheetAsJson(filePath);

    console.log(`Found ${data.length} rows in Excel file`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const employeeData: any = row;

        // Extract and validate data
        const employeeId = employeeData['Employee ID'] || employeeData['employeeId'];
        const employeeNumber = parseInt(employeeData['Employee Number'] || employeeData['employeeNumber'] || '0');
        const name = employeeData['Name'] || employeeData['name'];
        const email = employeeData['Email'] || employeeData['email'];
        const designation = employeeData['Designation'] || employeeData['designation'] || 'Annotator';
        const dateOfJoining = employeeData['Date of Joining'] || employeeData['dateOfJoining'];
        const baseSalary = parseFloat(employeeData['Base Salary'] || employeeData['baseSalary'] || '22000');
        const role = employeeData['Role'] || employeeData['role'] || 'EMPLOYEE';

        // Validation
        if (!employeeId || !name || !email) {
          console.warn(`⚠️  Skipping row - missing required fields:`, { employeeId, name, email });
          skipped++;
          continue;
        }

        // Check if user already exists
        const existing = await prisma.user.findUnique({
          where: { email },
        });

        if (existing) {
          console.log(`⏭️  User already exists: ${name} (${email})`);
          skipped++;
          continue;
        }

        // Generate default password: employee123
        const passwordHash = await bcrypt.hash('employee123', 10);

        // Parse date of joining
        let joiningDate: Date;
        if (dateOfJoining) {
          joiningDate = new Date(dateOfJoining);
          if (isNaN(joiningDate.getTime())) {
            joiningDate = new Date();
          }
        } else {
          joiningDate = new Date();
        }

        // Create user
        const user = await prisma.user.create({
          data: {
            employeeId,
            employeeNumber: employeeNumber || 0,
            name,
            email,
            passwordHash,
            designation,
            dateOfJoining: joiningDate,
            baseSalary,
            role: role as any,
            status: 'ACTIVE',
          },
        });

        // Create leave balance for current year (pro-rata if joined mid-year)
        const currentYear = new Date().getFullYear();
        const proRataTotal = getProRataCasualLeaveForYear(joiningDate, currentYear);
        await prisma.leaveBalance.create({
          data: {
            userId: user.id,
            year: currentYear,
            casualLeaveTotal: proRataTotal,
            casualLeaveUsed: 0,
            casualLeavePending: 0,
            casualLeaveAvailable: proRataTotal,
          },
        });

        console.log(`✅ Imported: ${name} (${employeeId})`);
        imported++;
      } catch (error) {
        console.error(`❌ Error importing row:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`\n✨ User import completed!`);
    console.log(`\n🔐 Default password for all imported users: employee123`);
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Usage: npm run import:users <path-to-excel-file>');
    console.error('Example: npm run import:users ./data/employees.xlsx');
    process.exit(1);
  }

  importUsers(filePath)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { importUsers };
