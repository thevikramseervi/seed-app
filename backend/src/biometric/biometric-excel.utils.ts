import * as ExcelJS from 'exceljs';

export interface ReadSheetAsArraysOptions {
  defval?: unknown;
}

/**
 * Read the first sheet from a Buffer as an array of rows (array of arrays).
 * Use for file uploads (e.g. multipart) where the file is in memory.
 */
export async function readSheetAsArraysFromBuffer(
  buffer: Buffer,
  options?: ReadSheetAsArraysOptions
): Promise<unknown[][]> {
  const defval = options?.defval ?? '';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: unknown[][] = [];
  worksheet.eachRow((row) => {
    const raw = (row.values ?? []) as unknown[];
    const rowArr = raw
      .slice(1)
      .map((v) => (v === undefined || v === null ? defval : v));
    rows.push(rowArr);
  });
  return rows;
}
