const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');

(async () => {
  const downloadDir = os.tmpdir();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    acceptDownloads: true,
    downloadsPath: downloadDir,
  });
  const page = await context.newPage();

  // 1. Login
  console.log('Navigating to app...');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

  await page.fill('input[type="email"], input[name="email"]', 'bvikram.23cse@cambridge.edu.in');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Logged in, URL:', page.url());

  // 2. Navigate to Reports
  await page.goto('http://localhost:8080/reports', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('On reports page');

  // 3. Set date range 01-01-2026 to 07-01-2026
  const startInput = page.locator('input[type="date"]').first();
  const endInput = page.locator('input[type="date"]').nth(1);
  await startInput.fill('2026-01-01');
  await endInput.fill('2026-01-07');

  // 4. Click Generate
  await page.getByRole('button', { name: /generate/i }).click();
  await page.waitForTimeout(3000);
  console.log('Report generated');

  // 5. Export to Excel
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /export/i }).click(),
  ]);

  const xlsxPath = path.join(downloadDir, 'attendance.xlsx');
  await download.saveAs(xlsxPath);
  console.log('Downloaded to:', xlsxPath);

  // 6. Parse and verify Excel
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const sheet = wb.worksheets[0];

  // Read header row
  const headers = [];
  sheet.getRow(1).eachCell((cell) => headers.push(cell.value?.toString() ?? ''));
  console.log('\nHeaders:', headers.join(' | '));

  // Check for weekend dates (03-01-2026=Sat, 04-01-2026=Sun)
  const has03 = headers.some(h => h.includes('03-01-2026'));
  const has04 = headers.some(h => h.includes('04-01-2026'));
  console.log('\n✓ 03-01-2026 column present:', has03);
  console.log('✓ 04-01-2026 column present:', has04);

  // Check row 2 values for those columns
  const col03 = headers.findIndex(h => h.includes('03-01-2026')) + 1;
  const col04 = headers.findIndex(h => h.includes('04-01-2026')) + 1;
  if (col03 > 0) {
    const val = sheet.getRow(2).getCell(col03).value;
    console.log('03-01-2026 row2 value:', val, '(expected W)');
  }
  if (col04 > 0) {
    const val = sheet.getRow(2).getCell(col04).value;
    console.log('04-01-2026 row2 value:', val, '(expected W)');
  }

  // Check HD column value
  const hdCol = headers.findIndex(h => h === 'HD') + 1;
  if (hdCol > 0) {
    for (let i = 2; i <= Math.min(sheet.rowCount, 5); i++) {
      const val = sheet.getRow(i).getCell(hdCol).value;
      if (val && val !== 0) console.log(`Row ${i} HD value: ${val} (should be 0.5 per half day)`);
    }
  }

  await browser.close();
  console.log('\nTest complete.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
