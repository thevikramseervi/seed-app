import { PrismaClient, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { readSheetAsJson } from './lib/excel-reader';

const prisma = new PrismaClient();

async function importAttendanceWide(filePath: string) {
  console.log('📥 Starting attendance import from Excel (wide format)...');
  console.log(`File: ${filePath}\n`);

  try {
    // Read Excel file
    const data = await readSheetAsJson(filePath);

    console.log(`Found ${data.length} employees in Excel file\n`);

    let totalRecords = 0;
    let usersCreated = 0;
    let usersSkipped = 0;
    let attendanceCreated = 0;
    let attendanceUpdated = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const employeeData: any = row;

        // Extract employee info
        const employeeId = employeeData['Employee IDs'] || employeeData['Employee ID'];
        const employeeNumber = parseInt(employeeData[' IDs'] || employeeData['IDs'] || employeeData['ID'] || '0');
        const name = employeeData['Names'] || employeeData['Name'];
        const designation = employeeData['Designation'] || 'Annotator';
        const doj = employeeData['DOJ'];

        if (!employeeId || !name) {
          console.warn(`⚠️  Skipping row - missing employee info`);
          errors++;
          continue;
        }

        // Parse DOJ (Excel serial date or date string)
        let dateOfJoining: Date;
        if (typeof doj === 'number') {
          // Excel serial date (days since 1900-01-01)
          dateOfJoining = new Date((doj - 25569) * 86400 * 1000);
        } else if (doj) {
          dateOfJoining = new Date(doj);
        } else {
          dateOfJoining = new Date('2024-01-01'); // Default
        }

        // Check if user exists; if not, we SKIP instead of auto-creating.
        // This avoids issues with duplicate employee numbers when historical
        // attendance contains ex-employees or inconsistent IDs.
        let user = await prisma.user.findUnique({
          where: { employeeId },
        });

        if (!user) {
          console.warn(
            `⚠️  Skipping employee row - user not found for employeeId=${employeeId}, name=${name}`
          );
          errors++;
          continue;
        }

        usersSkipped++;

        // Process each date column.
        // We treat any column whose header can be parsed as a valid Date
        // (e.g. "Mon Dec 01 2025 00:00:00 GMT+0000 (Coordinated Universal Time)")
        // as a day column.
        const dateColumns = Object.keys(employeeData).filter((key) => {
          const d = new Date(key);
          return !isNaN(d.getTime());
        });

        for (const dateCol of dateColumns) {
          try {
            const statusCode = employeeData[dateCol];
            if (!statusCode || statusCode.toString().trim() === '') {
              continue;
            }

            // Parse date from column name using JavaScript Date parsing.
            const date = new Date(dateCol);
            if (isNaN(date.getTime())) {
              console.warn(`⚠️  Unable to parse date column "${dateCol}"`);
              continue;
            }

            // Map status code to enum
            let status: AttendanceStatus;
            const statusStr = statusCode.toString().toUpperCase().trim();

            switch (statusStr) {
              case 'P':
                status = AttendanceStatus.PRESENT;
                break;
              case 'A':
              case 'LOP':
                status = AttendanceStatus.ABSENT;
                break;
              case 'HD':
              case 'HALF':
                status = AttendanceStatus.HALF_DAY;
                break;
              case 'CL':
              case 'LEAVE':
                status = AttendanceStatus.CASUAL_LEAVE;
                break;
              case 'W':
              case 'WO':
              case 'WEEKEND':
                status = AttendanceStatus.WEEKEND;
                break;
              case 'H':
              case 'HOLIDAY':
                status = AttendanceStatus.HOLIDAY;
                break;
              default:
                console.warn(`⚠️  Unknown status code: ${statusStr} for ${name} on ${dateCol}`);
                continue;
            }

            // Create or update attendance record
            const existing = await prisma.attendance.findUnique({
              where: {
                userId_date: {
                  userId: user.id,
                  date,
                },
              },
            });

            if (existing) {
              await prisma.attendance.update({
                where: { id: existing.id },
                data: { status },
              });
              attendanceUpdated++;
            } else {
              await prisma.attendance.create({
                data: {
                  userId: user.id,
                  date,
                  status,
                  biometricSynced: false,
                },
              });
              attendanceCreated++;
            }

            totalRecords++;
          } catch (dateError) {
            // Skip individual date errors
          }
        }

        console.log(`   Processed ${dateColumns.length} days for ${name}`);
      } catch (error) {
        console.error(`❌ Error importing employee:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`👥 Users:`);
    console.log(`   ✅ Created: ${usersCreated}`);
    console.log(`   ⏭️  Skipped (already exist): ${usersSkipped}`);
    console.log(`\n📅 Attendance Records:`);
    console.log(`   ✅ Created: ${attendanceCreated}`);
    console.log(`   🔄 Updated: ${attendanceUpdated}`);
    console.log(`   📊 Total: ${totalRecords}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`\n✨ Import completed successfully!`);
    console.log(`\n🔑 Default password for new users: employee123`);
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
    console.error('Usage: npm run import:attendance-wide <path-to-excel-file>');
    console.error('Example: npm run import:attendance-wide "./data/DECEMBER ATTENDANCE 2025.xlsx"');
    process.exit(1);
  }

  importAttendanceWide(filePath)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { importAttendanceWide };
