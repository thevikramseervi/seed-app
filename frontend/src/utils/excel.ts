import ExcelJS from 'exceljs';

export interface ExcelColumn<T> {
  header: string;
  value: (row: T) => string | number;
}

/** Generate an Excel file and trigger a browser download. */
export async function downloadExcel<T>(
  filename: string,
  columns: ExcelColumn<T>[],
  rows: T[],
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.addRow(columns.map((c) => c.header));
  rows.forEach((row) => worksheet.addRow(columns.map((c) => c.value(row))));
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
