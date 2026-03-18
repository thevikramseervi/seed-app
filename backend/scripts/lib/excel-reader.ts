import * as ExcelJS from 'exceljs';

/**
 * Read the first sheet of an Excel file as an array of objects (header row = keys).
 * Equivalent to XLSX.utils.sheet_to_json(worksheet).
 */
export async function readSheetAsJson(
  filePath: string
): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const jsonData: Record<string, unknown>[] = [];
  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values as unknown[];
  // ExcelJS row.values is 1-indexed, so values[0] is empty
  const headerKeys = (headers?.slice(1) ?? []).map((h) =>
    String(h ?? '').trim()
  );

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const rowData: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const key = headerKeys[colNumber - 1];
      if (key) rowData[key] = cell.value ?? undefined;
    });
    jsonData.push(rowData);
  });

  return jsonData;
}

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
    const rowArr = raw.slice(1).map((v) => (v === undefined || v === null ? defval : v));
    rows.push(rowArr);
  });
  return rows;
}

/**
 * Read the first sheet as an array of rows (array of arrays).
 * Equivalent to XLSX.utils.sheet_to_json(worksheet, { header: 1, defval }).
 */
export async function readSheetAsArrays(
  filePath: string,
  options?: ReadSheetAsArraysOptions
): Promise<unknown[][]> {
  const defval = options?.defval ?? '';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: unknown[][] = [];
  worksheet.eachRow((row) => {
    // ExcelJS row.values is 1-indexed; values[0] is typically empty
    const raw = (row.values ?? []) as unknown[];
    const rowArr = raw.slice(1).map((v) => (v === undefined || v === null ? defval : v));
    rows.push(rowArr);
  });
  return rows;
}

/**
 * Read workbook and return sheet names plus a function to get each sheet as JSON.
 * Used by analyze-excel.ts which iterates all sheets.
 */
export async function readWorkbook(filePath: string): Promise<{
  sheetNames: string[];
  getSheetAsJson: (sheetIndex: number) => Record<string, unknown>[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheetNames = workbook.worksheets.map((ws) => ws.name);

  function getSheetAsJson(sheetIndex: number): Record<string, unknown>[] {
    const worksheet = workbook.worksheets[sheetIndex];
    if (!worksheet) return [];

    const jsonData: Record<string, unknown>[] = [];
    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values as unknown[];
    const headerKeys = (headers?.slice(1) ?? []).map((h) =>
      String(h ?? '').trim()
    );

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData: Record<string, unknown> = {};
      row.eachCell((cell, colNumber) => {
        const key = headerKeys[colNumber - 1];
        if (key) rowData[key] = cell.value ?? undefined;
      });
      jsonData.push(rowData);
    });
    return jsonData;
  }

  return { sheetNames, getSheetAsJson };
}
