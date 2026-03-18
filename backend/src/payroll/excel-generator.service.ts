import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  companyName,
  division,
  address,
  currencyNote,
  getPayPeriod,
  getPayDateFormatted,
} from './slip-config';
import { numberToWordsInr } from '../common/number-to-words';

interface PayrollData {
  id: string;
  month: number;
  year: number;
  paymentDate?: Date | null;
  baseSalary: number;
  workingDays: number;
  weekendDays: number;
  holidayDays: number;
  presentDays: number;
  casualLeaveDays: number;
  halfDays: number;
  lossOfPayDays: number;
  totalPayDays: number;
  grossEarnings: number;
  deductions: number;
  reimbursements: number;
  netSalary: number;
  user: {
    employeeId: string;
    employeeNumber: number;
    name: string;
    email: string;
    designation: string;
    dateOfJoining: Date;
  };
}

@Injectable()
export class ExcelGeneratorService {
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  private formatDate(date: Date): string {
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTH_SHORT[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  }

  async generateSalarySlipExcel(payrollData: PayrollData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Salary Slip');

    const monthName = this.getMonthName(payrollData.month);
    const payPeriod = getPayPeriod(payrollData.month, payrollData.year);
    const payDateStr = getPayDateFormatted(
      payrollData.month,
      payrollData.year,
      payrollData.paymentDate,
    );

    // Set column widths
    worksheet.columns = [
      { width: 5 },   // A - spacing
      { width: 25 },  // B - labels
      { width: 20 },  // C - values
      { width: 5 },   // D - spacing
      { width: 25 },  // E - labels
      { width: 20 },  // F - values
    ];

    let currentRow = 2;

    // Header: Pay Slip for the month of ...
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const headerCell = worksheet.getCell(`B${currentRow}`);
    headerCell.value = `Pay Slip for the month of ${monthName} ${payrollData.year}`;
    headerCell.font = { size: 14, bold: true };
    headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 1;

    // Company, division, address, currency note
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = companyName;
    worksheet.getCell(`B${currentRow}`).font = { size: 11 };
    worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 1;

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = division;
    worksheet.getCell(`B${currentRow}`).font = { size: 10 };
    worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 1;

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = address;
    worksheet.getCell(`B${currentRow}`).font = { size: 10 };
    worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 1;

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = currencyNote;
    worksheet.getCell(`B${currentRow}`).font = { size: 10 };
    worksheet.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 2;

    // Employee Details Section Header
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const empHeaderCell = worksheet.getCell(`B${currentRow}`);
    empHeaderCell.value = 'EMPLOYEE DETAILS';
    empHeaderCell.font = { size: 12, bold: true };
    empHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
    };
    empHeaderCell.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow += 1;

    // Employee Details (including Pay Period and Pay Date)
    const employeeDetails = [
      ['Employee ID:', payrollData.user.employeeId, 'Email:', payrollData.user.email],
      ['Name:', payrollData.user.name, 'Designation:', payrollData.user.designation],
      ['Employee Number:', payrollData.user.employeeNumber.toString(), 'Date of Joining:', this.formatDate(payrollData.user.dateOfJoining)],
      ['Pay Period:', payPeriod, 'Pay Date:', payDateStr],
    ];

    employeeDetails.forEach((row) => {
      worksheet.getCell(`B${currentRow}`).value = row[0];
      worksheet.getCell(`B${currentRow}`).font = { bold: true };
      worksheet.getCell(`C${currentRow}`).value = row[1];
      
      worksheet.getCell(`E${currentRow}`).value = row[2];
      worksheet.getCell(`E${currentRow}`).font = { bold: true };
      worksheet.getCell(`F${currentRow}`).value = row[3];
      currentRow += 1;
    });

    currentRow += 1;

    // Attendance Summary Section Header
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const attHeaderCell = worksheet.getCell(`B${currentRow}`);
    attHeaderCell.value = 'ATTENDANCE SUMMARY';
    attHeaderCell.font = { size: 12, bold: true };
    attHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
    };
    attHeaderCell.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow += 1;

    // Attendance Details
    const attendanceDetails = [
      ['Total Days:', payrollData.workingDays.toString(), 'Weekend Days:', payrollData.weekendDays.toString()],
      ['Holiday Days:', payrollData.holidayDays.toString(), 'Present Days:', payrollData.presentDays.toString()],
      ['Casual Leave:', payrollData.casualLeaveDays.toString(), 'Half Days:', payrollData.halfDays.toString()],
      ['Loss of Pay:', payrollData.lossOfPayDays.toString(), 'Total Pay Days:', payrollData.totalPayDays.toString()],
    ];

    attendanceDetails.forEach((row) => {
      worksheet.getCell(`B${currentRow}`).value = row[0];
      worksheet.getCell(`B${currentRow}`).font = { bold: true };
      worksheet.getCell(`C${currentRow}`).value = row[1];
      
      worksheet.getCell(`E${currentRow}`).value = row[2];
      worksheet.getCell(`E${currentRow}`).font = { bold: true };
      worksheet.getCell(`F${currentRow}`).value = row[3];
      currentRow += 1;
    });

    currentRow += 1;

    // Salary Breakdown Section Header
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const salHeaderCell = worksheet.getCell(`B${currentRow}`);
    salHeaderCell.value = 'SALARY BREAKDOWN';
    salHeaderCell.font = { size: 12, bold: true };
    salHeaderCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD9D9D9' }
    };
    salHeaderCell.alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow += 1;

    // Earnings (left B/C) and Deductions (right E/F) side by side — soft light gray header
    const headerGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFEBEBEB' } };
    worksheet.getCell(`B${currentRow}`).value = 'Earnings';
    worksheet.getCell(`B${currentRow}`).font = { bold: true, underline: true };
    worksheet.getCell(`B${currentRow}`).fill = headerGray;
    worksheet.getCell(`C${currentRow}`).value = 'Amount (₹)';
    worksheet.getCell(`C${currentRow}`).font = { bold: true, underline: true };
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`C${currentRow}`).fill = headerGray;
    worksheet.getCell(`E${currentRow}`).value = 'Deductions';
    worksheet.getCell(`E${currentRow}`).font = { bold: true, underline: true };
    worksheet.getCell(`E${currentRow}`).fill = headerGray;
    worksheet.getCell(`F${currentRow}`).value = 'Amount (₹)';
    worksheet.getCell(`F${currentRow}`).font = { bold: true, underline: true };
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`F${currentRow}`).fill = headerGray;
    currentRow += 1;

    worksheet.getCell(`B${currentRow}`).value = 'Salary and other Allowances';
    worksheet.getCell(`C${currentRow}`).value = payrollData.grossEarnings;
    worksheet.getCell(`C${currentRow}`).numFmt = '₹#,##0.00';
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`E${currentRow}`).value = 'Withholding Tax';
    worksheet.getCell(`F${currentRow}`).value = '-';
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 1;

    worksheet.getCell(`E${currentRow}`).value = 'Professional Tax';
    worksheet.getCell(`F${currentRow}`).value = '-';
    worksheet.getCell(`F${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 1;

    // Reimbursements: always show
    worksheet.getCell(`B${currentRow}`).value = 'Reimbursements';
    worksheet.getCell(`B${currentRow}`).font = { bold: true };
    worksheet.getCell(`C${currentRow}`).value = payrollData.reimbursements > 0 ? payrollData.reimbursements : '-';
    if (payrollData.reimbursements > 0) {
      worksheet.getCell(`C${currentRow}`).numFmt = '₹#,##0.00';
    }
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 2;

    // Summary: Gross Earnings, Total Deductions, Total Reimbursements, Net Payable — soft gray header
    const summaryHeaderGray = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFEBEBEB' } };
    worksheet.getCell(`B${currentRow}`).value = 'Summary';
    worksheet.getCell(`B${currentRow}`).font = { bold: true, underline: true };
    worksheet.getCell(`B${currentRow}`).fill = summaryHeaderGray;
    worksheet.getCell(`C${currentRow}`).fill = summaryHeaderGray;
    currentRow += 1;

    worksheet.getCell(`B${currentRow}`).value = 'Gross Earnings';
    worksheet.getCell(`C${currentRow}`).value = payrollData.grossEarnings;
    worksheet.getCell(`C${currentRow}`).numFmt = '₹#,##0.00';
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 1;

    worksheet.getCell(`B${currentRow}`).value = 'Total Deductions';
    worksheet.getCell(`C${currentRow}`).value = payrollData.deductions;
    worksheet.getCell(`C${currentRow}`).numFmt = '₹#,##0.00';
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 1;

    worksheet.getCell(`B${currentRow}`).value = 'Total Reimbursements';
    worksheet.getCell(`C${currentRow}`).value = payrollData.reimbursements;
    worksheet.getCell(`C${currentRow}`).numFmt = '₹#,##0.00';
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    currentRow += 1;

    worksheet.getCell(`B${currentRow}`).value = 'Net Payable';
    worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 };
    worksheet.getCell(`C${currentRow}`).value = payrollData.netSalary;
    worksheet.getCell(`C${currentRow}`).numFmt = '₹#,##0.00';
    worksheet.getCell(`C${currentRow}`).alignment = { horizontal: 'right' };
    worksheet.getCell(`C${currentRow}`).font = { bold: true, size: 12 };
    currentRow += 2;

    // Formula
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = 'Net Payable = Gross earnings - Total deductions';
    worksheet.getCell(`B${currentRow}`).font = { italic: true };
    currentRow += 1;

    // Net Payable in words
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    worksheet.getCell(`B${currentRow}`).value = `Net Payable in words: ${numberToWordsInr(payrollData.netSalary)}`;
    worksheet.getCell(`B${currentRow}`).font = { size: 10 };
    currentRow += 2;

    // Footer
    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const footerCell = worksheet.getCell(`B${currentRow}`);
    footerCell.value = 'This is a computer-generated document. No signature is required.';
    footerCell.font = { italic: true, size: 9 };
    footerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    currentRow += 1;

    worksheet.mergeCells(`B${currentRow}:F${currentRow}`);
    const dateCell = worksheet.getCell(`B${currentRow}`);
    dateCell.value = `Generated on: ${this.formatDate(new Date())}`;
    dateCell.font = { italic: true, size: 9 };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
