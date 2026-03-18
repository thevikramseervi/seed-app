import { readWorkbook } from './lib/excel-reader';

const filePath = process.argv[2];

if (!filePath) {
  console.error('Usage: ts-node analyze-excel.ts <path-to-excel>');
  process.exit(1);
}

console.log('📊 Analyzing Excel file structure...\n');
console.log(`File: ${filePath}\n`);

async function main() {
  try {
    const { sheetNames, getSheetAsJson } = await readWorkbook(filePath);

    console.log(`📄 Sheet Names: ${sheetNames.join(', ')}\n`);

    for (let index = 0; index < sheetNames.length; index++) {
      const sheetName = sheetNames[index];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Sheet ${index + 1}: "${sheetName}"`);
      console.log('='.repeat(60));

      const data = getSheetAsJson(index);

      console.log(`Total rows: ${data.length}\n`);

      if (data.length > 0) {
        console.log('Column Names:');
        const firstRow: Record<string, unknown> = data[0];
        Object.keys(firstRow).forEach((key, idx) => {
          console.log(`  ${idx + 1}. "${key}"`);
        });

        console.log(`\nFirst 3 rows of data:`);
        console.log(JSON.stringify(data.slice(0, 3), null, 2));
      }
    }

    console.log('\n✅ Analysis complete!');
  } catch (error: any) {
    console.error('❌ Error analyzing file:', error.message);
    process.exit(1);
  }
}

main();
