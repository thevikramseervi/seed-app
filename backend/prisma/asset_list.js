// Column A is Employee ID, Column B is Laptop Asset Number,
// Column C is HDD Asset Number, Column D is Monitor Asset Number
// Update query for asset table — display to all users

const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, 'excel', 'asset_list.xlsx');
  console.log('Reading file from:', filePath);

  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // Skip header row, filter out empty rows
  const dataRows = rows.slice(1).filter(row => row.length > 0 && row[0]);

  console.log(`Found ${dataRows.length} rows in the excel file.`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const employeeId = String(row[0]).trim();
    const laptopAssetNumber = row[1] ? String(row[1]).trim() : null;
    const hddAssetNumber = row[2] ? String(row[2]).trim() : null;
    const monitorAssetNumber = row[3] ? String(row[3]).trim() : null;

    // Find the user by employeeId
    const user = await prisma.user.findUnique({
      where: { employeeId },
    });

    if (!user) {
      console.log(`⚠ User not found for Employee ID: ${employeeId} — skipping.`);
      skipped++;
      continue;
    }

    // Define assets to upsert for this user
    const assets = [
      { assetType: 'LAPTOP', assetNumber: laptopAssetNumber, assetName: 'Laptop' },
      { assetType: 'HDD', assetNumber: hddAssetNumber, assetName: 'HDD' },
      { assetType: 'MONITOR', assetNumber: monitorAssetNumber, assetName: 'Monitor' },
    ];

    for (const asset of assets) {
      if (!asset.assetNumber) continue; // skip if no asset number provided

      try {
        const result = await prisma.asset.upsert({
          where: { assetNumber: asset.assetNumber },
          update: {
            userId: user.id,
            assetType: asset.assetType,
            assetName: asset.assetName,
          },
          create: {
            assetName: asset.assetName,
            assetType: asset.assetType,
            assetNumber: asset.assetNumber,
            userId: user.id,
          },
        });

        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
          created++;
          console.log(`  ✔ Created ${asset.assetType} [${asset.assetNumber}] for ${user.name} (${employeeId})`);
        } else {
          updated++;
          console.log(`  ✔ Updated ${asset.assetType} [${asset.assetNumber}] for ${user.name} (${employeeId})`);
        }
      } catch (err) {
        console.error(`  ✘ Error processing ${asset.assetType} [${asset.assetNumber}] for ${employeeId}:`, err.message);
      }
    }
  }

  console.log(`\nDone! Created: ${created}, Updated: ${updated}, Skipped users: ${skipped}`);
}

main()
  .catch((e) => {
    console.error('Error processing assets:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });