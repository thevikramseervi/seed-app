import { readSheetAsArrays } from './lib/excel-reader';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: ts-node analyze-biometric.ts <path-to-excel>');
  process.exit(1);
}

console.log('📊 Analyzing Biometric Excel file...\n');
console.log(`File: ${filePath}\n`);

async function main() {
  try {
    const data = await readSheetAsArrays(filePath);

    console.log(`Total rows: ${data.length}\n`);

    // Show first 20 rows to understand structure
    console.log('First 20 rows:');
    console.log('='.repeat(100));
    data.slice(0, 20).forEach((row: unknown[], idx: number) => {
      console.log(`Row ${idx}:`, JSON.stringify(row));
    });

    console.log('\n' + '='.repeat(100));

    // Try to find the header row
    console.log('\nLooking for header row with "Emp ID", "Name", "Date", etc...\n');

    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row: unknown[] = data[i];
      const rowStr = JSON.stringify(row).toLowerCase();
      if (rowStr.includes('emp') || rowStr.includes('employee') || rowStr.includes('name')) {
        console.log(`Potential header at row ${i}:`, row);
        headerRowIndex = i;
      }
    }

    if (headerRowIndex >= 0) {
      console.log(`\nUsing row ${headerRowIndex} as header`);
      console.log('\nFirst 5 data rows after header:');
      const dataAfterHeader = data.slice(headerRowIndex + 1, headerRowIndex + 6);
      dataAfterHeader.forEach((row: unknown[], idx: number) => {
        console.log(`Data ${idx + 1}:`, row);
      });
    }

    console.log('\n✅ Analysis complete!');
  } catch (error: any) {
    console.error('❌ Error analyzing file:', error.message);
    process.exit(1);
  }
}

main();
