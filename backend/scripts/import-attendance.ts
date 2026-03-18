import { PrismaClient, AttendanceStatus } from '@prisma/client';
import { readSheetAsJson } from './lib/excel-reader';

const prisma = new PrismaClient();

async function importAttendance(filePath: string) {
  console.log('📥 Starting attendance import from Excel...');
  console.log(`File: ${filePath}`);

  try {
    // Read Excel file
    const data = await readSheetAsJson(filePath);

    console.log(`Found ${data.length} rows in Excel file`);

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const attendanceData: any = row;

        // Extract data
        const employeeId = attendanceData['Employee ID'] || attendanceData['employeeId'];
        const dateStr = attendanceData['Date'] || attendanceData['date'];
        const status = (attendanceData['Status'] || attendanceData['status'] || 'PRESENT').toUpperCase();
        const firstIn = attendanceData['First In'] || attendanceData['firstIn'] || attendanceData['In Time'];
        const lastOut = attendanceData['Last Out'] || attendanceData['lastOut'] || attendanceData['Out Time'];
        const duration = parseFloat(attendanceData['Duration (hrs)'] || attendanceData['duration'] || attendanceData['Duration'] || '0');

        // Validation
        if (!employeeId || !dateStr) {
          console.warn(`⚠️  Skipping row - missing required fields`);
          skipped++;
          continue;
        }

        // Find user
        const user = await prisma.user.findUnique({
          where: { employeeId },
        });

        if (!user) {
          console.warn(`⚠️  User not found: ${employeeId}`);
          skipped++;
          continue;
        }

        // Parse date
        let date: Date;
        try {
          date = new Date(dateStr);
          if (isNaN(date.getTime())) {
            throw new Error('Invalid date');
          }
        } catch {
          console.warn(`⚠️  Invalid date format: ${dateStr}`);
          skipped++;
          continue;
        }

        // Map status to enum
        let attendanceStatus: AttendanceStatus;
        switch (status) {
          case 'PRESENT':
          case 'P':
            attendanceStatus = AttendanceStatus.PRESENT;
            break;
          case 'ABSENT':
          case 'A':
          case 'LOP':
            attendanceStatus = AttendanceStatus.ABSENT;
            break;
          case 'HALF_DAY':
          case 'HALF':
          case 'HD':
            attendanceStatus = AttendanceStatus.HALF_DAY;
            break;
          case 'CASUAL_LEAVE':
          case 'CL':
          case 'LEAVE':
            attendanceStatus = AttendanceStatus.CASUAL_LEAVE;
            break;
          case 'WEEKEND':
          case 'W':
          case 'WO':
            attendanceStatus = AttendanceStatus.WEEKEND;
            break;
          case 'HOLIDAY':
          case 'H':
            attendanceStatus = AttendanceStatus.HOLIDAY;
            break;
          default:
            attendanceStatus = AttendanceStatus.PRESENT;
        }

        // Calculate total duration in minutes
        const totalDuration = duration ? Math.round(duration * 60) : null;

        // Check if attendance already exists
        const existing = await prisma.attendance.findUnique({
          where: {
            userId_date: {
              userId: user.id,
              date,
            },
          },
        });

        if (existing) {
          // Update existing
          await prisma.attendance.update({
            where: { id: existing.id },
            data: {
              status: attendanceStatus,
              firstInTime: firstIn || null,
              lastOutTime: lastOut || null,
              totalDuration,
              biometricSynced: false,
            },
          });
          console.log(`🔄 Updated: ${user.name} - ${date.toDateString()}`);
          updated++;
        } else {
          // Create new
          await prisma.attendance.create({
            data: {
              userId: user.id,
              date,
              status: attendanceStatus,
              firstInTime: firstIn || null,
              lastOutTime: lastOut || null,
              totalDuration,
              biometricSynced: false,
            },
          });
          console.log(`✅ Imported: ${user.name} - ${date.toDateString()}`);
          imported++;
        }
      } catch (error) {
        console.error(`❌ Error importing row:`, error.message);
        errors++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Imported: ${imported}`);
    console.log(`🔄 Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`\n✨ Attendance import completed!`);
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
    console.error('Usage: npm run import:attendance <path-to-excel-file>');
    console.error('Example: npm run import:attendance ./data/attendance.xlsx');
    process.exit(1);
  }

  importAttendance(filePath)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { importAttendance };
