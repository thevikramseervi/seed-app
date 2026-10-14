const { PrismaClient } = require('@prisma/client');
const XLSX = require('xlsx');
const path = require('path');

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');
const managedAssets = [
  { index: 3, assetType: 'LAPTOP', assetName: 'Laptop' },
  { index: 4, assetType: 'MONITOR', assetName: 'Monitor' },
];

async function createHistory(client, asset, action, user, performer, remarks) {
  await client.assetHistory.create({
    data: {
      assetId: asset.id,
      assetNumber: asset.assetNumber,
      assetName: asset.assetName,
      assetType: asset.assetType,
      serialNumber: asset.serialNumber ?? null,
      userId: user?.id ?? null,
      employeeName: user?.name ?? null,
      employeeId: user?.employeeId ?? null,
      action,
      performedBy: performer.id,
      performedByName: performer.name,
      remarks,
    },
  });
}

function logPlan(action, assetType, assetNumber, user, detail = '') {
  console.log(`  ${action}: ${assetType} [${assetNumber}] for ${user.name} (${user.employeeId})${detail ? ` - ${detail}` : ''}`);
}

async function reconcileUser(client, user, desiredAssets, performer, counts) {
  const currentAssets = await client.asset.findMany({
    where: { userId: user.id, assetType: { in: ['LAPTOP', 'MONITOR'] } },
    include: { user: { select: { id: true, name: true, employeeId: true, status: true } } },
  });
  const desiredKeys = new Set(desiredAssets.map((asset) => `${asset.assetType}:${asset.assetNumber}`));

  for (const current of currentAssets) {
    if (desiredKeys.has(`${current.assetType}:${current.assetNumber}`)) continue;
    counts.returned += 1;
    logPlan(dryRun ? 'WOULD RETURN' : 'RETURNED', current.assetType, current.assetNumber, user, 'missing from workbook');
    if (!dryRun) {
      await client.asset.update({ where: { id: current.id }, data: { userId: null } });
      await createHistory(client, current, 'RETURNED', user, performer, 'Returned during asset workbook reconciliation');
    }
  }

  for (const desired of desiredAssets) {
    const existing = await client.asset.findUnique({
      where: { assetNumber: desired.assetNumber },
      include: { user: { select: { id: true, name: true, employeeId: true, status: true } } },
    });

    if (!existing) {
      counts.created += 1;
      logPlan(dryRun ? 'WOULD CREATE' : 'CREATED', desired.assetType, desired.assetNumber, user);
      if (!dryRun) {
        const created = await client.asset.create({
          data: { assetName: desired.assetName, assetType: desired.assetType, assetNumber: desired.assetNumber, userId: user.id },
        });
        await createHistory(client, created, 'ASSIGNED', user, performer, 'Assigned during asset workbook reconciliation');
      }
      continue;
    }

    if (existing.userId === user.id && existing.assetType === desired.assetType) continue;

    if (existing.userId && existing.userId !== user.id) {
      counts.reassigned += 1;
      logPlan(dryRun ? 'WOULD REASSIGN' : 'REASSIGNED', desired.assetType, desired.assetNumber, user, `from ${existing.user.name} (${existing.user.employeeId})`);
      if (!dryRun) {
        await createHistory(client, existing, 'RETURNED', existing.user, performer, 'Returned during asset workbook reconciliation');
        const reassigned = await client.asset.update({
          where: { id: existing.id },
          data: { assetName: desired.assetName, assetType: desired.assetType, userId: user.id },
        });
        await createHistory(client, reassigned, 'REASSIGNED', user, performer, 'Reassigned during asset workbook reconciliation');
      }
      continue;
    }

    counts.assigned += 1;
    logPlan(dryRun ? 'WOULD ASSIGN' : 'ASSIGNED', desired.assetType, desired.assetNumber, user);
    if (!dryRun) {
      const assigned = await client.asset.update({
        where: { id: existing.id },
        data: { assetName: desired.assetName, assetType: desired.assetType, userId: user.id },
      });
      await createHistory(client, assigned, 'ASSIGNED', user, performer, 'Assigned during asset workbook reconciliation');
    }
  }
}

async function main() {
  const filePath = path.join(__dirname, 'excel/SEED ASSET DATA - OCT.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const dataRows = rows.slice(1).filter((row) => row.length > 0 && row[1]);

  const performerKey = process.env.ASSET_IMPORT_PERFORMED_BY;
  if (!performerKey) throw new Error('Set ASSET_IMPORT_PERFORMED_BY to an admin user ID, employee ID, or email.');
  const performer = await prisma.user.findFirst({
    where: { OR: [{ id: performerKey }, { employeeId: performerKey }, { email: performerKey.toLowerCase() }] },
    select: { id: true, name: true, role: true },
  });
  if (!performer) throw new Error(`Importing admin user not found: ${performerKey}`);
  if (!['LAB_ADMIN', 'SUPER_ADMIN'].includes(performer.role)) throw new Error(`Import performer must be an admin: ${performerKey}`);

  const workbookById = new Map();
  for (const row of dataRows) {
    const employeeId = String(row[1]).trim();
    if (workbookById.has(employeeId)) throw new Error(`Duplicate employee ID in workbook: ${employeeId}`);
    const desired = managedAssets.map(({ index, assetType, assetName }) => ({
      assetType,
      assetName,
      assetNumber: row[index] == null || String(row[index]).trim() === 'Not Using' ? '' : String(row[index]).trim(),
    })).filter((asset) => asset.assetNumber);
    workbookById.set(employeeId, desired);
  }

  const users = await prisma.user.findMany({
    where: { employeeId: { in: [...workbookById.keys()] } },
    select: { id: true, name: true, employeeId: true, status: true },
  });
  const userByEmployeeId = new Map(users.map((user) => [user.employeeId, user]));
  const activeAssetOwners = new Set(users.filter((user) => user.status === 'ACTIVE').map((user) => user.employeeId));
  const activeAssetNumbers = new Map();

  for (const [employeeId, desiredAssets] of workbookById) {
    if (!activeAssetOwners.has(employeeId)) continue;
    for (const asset of desiredAssets) {
      const key = `${asset.assetType}:${asset.assetNumber}`;
      const previous = activeAssetNumbers.get(key);
      if (previous) throw new Error(`Asset ${key} is assigned to multiple active employees: ${previous}, ${employeeId}`);
      activeAssetNumbers.set(key, employeeId);
    }
  }

  console.log(`${dryRun ? 'DRY RUN: ' : ''}Reading ${dataRows.length} workbook rows from ${filePath}`);
  console.log(`History performer: ${performer.name}`);
  const counts = { created: 0, assigned: 0, reassigned: 0, returned: 0, skippedInactive: 0, skippedMissingUser: 0 };

  for (const [employeeId, desiredAssets] of workbookById) {
    const user = userByEmployeeId.get(employeeId);
    if (!user) {
      console.log(`SKIP: User not found for Employee ID ${employeeId}`);
      counts.skippedMissingUser += 1;
      continue;
    }
    if (user.status !== 'ACTIVE') {
      console.log(`SKIP: Inactive employee ${employeeId} (${user.name})`);
      counts.skippedInactive += 1;
      continue;
    }
    if (dryRun) await reconcileUser(prisma, user, desiredAssets, performer, counts);
    else await prisma.$transaction((tx) => reconcileUser(tx, user, desiredAssets, performer, counts));
  }

  console.log(`\n${dryRun ? 'Dry-run plan' : 'Reconciliation'} complete:`);
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error('Original asset reconciliation failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
