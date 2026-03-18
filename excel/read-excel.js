const ExcelJS = require('exceljs');

// Note: ExcelJS supports .xlsx only; .xls files will fail with an error.
const files = [
  'excel/Activity_Report_2026-01-21 (December 2025).xlsx',
  'excel/DECEMBER ATTENDANCE 2025.xlsx',
  'excel/DECEMBER BIOMETRIC 2025.xls',
  'excel/Pay Slip - Likhithashree.xls'
];

async function getSheetAsArrays(worksheet, defval = '') {
  const rows = [];
  worksheet.eachRow((row) => {
    const raw = (row.values || []);
    const rowArr = raw.slice(1).map((v) => (v === undefined || v === null ? defval : v));
    rows.push(rowArr);
  });
  return rows;
}

async function main() {
  for (const filePath of files) {
    console.log('\n' + '='.repeat(80));
    console.log(`FILE: ${filePath}`);
    console.log('='.repeat(80));

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      for (let index = 0; index < workbook.worksheets.length; index++) {
        const sheet = workbook.worksheets[index];
        const sheetName = sheet.name;
        console.log(`\n--- Sheet ${index + 1}: ${sheetName} ---\n`);

        const data = await getSheetAsArrays(sheet, '');

        const rowsToPrint = Math.min(data.length, 50);
        for (let i = 0; i < rowsToPrint; i++) {
          console.log(JSON.stringify(data[i]));
        }

        if (data.length > 50) {
          console.log(`\n... (showing first 50 of ${data.length} rows)`);
        }
      }
    } catch (error) {
      console.error(`Error reading ${filePath}:`, error.message);
    }
  }
}

main();
