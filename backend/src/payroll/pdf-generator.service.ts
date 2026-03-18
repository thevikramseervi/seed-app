import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { Readable } from 'stream';
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
export class PdfGeneratorService {
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1];
  }

  private formatCurrency(amount: number): string {
    return `Rs. ${amount.toFixed(2)}`;
  }

  private formatDate(date: Date): string {
    const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = new Date(date);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = MONTH_SHORT[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  }

  async generateSalarySlipPDF(payrollData: PayrollData): Promise<Readable> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 54 });
        const stream = new Readable();
        stream._read = () => {};

        doc.on('data', (chunk) => stream.push(chunk));
        doc.on('end', () => {
          stream.push(null);
          resolve(stream);
        });
        doc.on('error', reject);

        const monthName = this.getMonthName(payrollData.month);
        const payPeriod = getPayPeriod(payrollData.month, payrollData.year);
        const payDateStr = getPayDateFormatted(
          payrollData.month,
          payrollData.year,
          payrollData.paymentDate,
        );

        // Header: Pay Slip for the month of ... then company, division, address, currency note
        doc.fontSize(12).font('Helvetica-Bold').text(`Pay Slip for the month of ${monthName} ${payrollData.year}`, { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(9).font('Helvetica').text(companyName, { align: 'center' });
        doc.fontSize(8).font('Helvetica').text(division, { align: 'center' });
        address.split('\n').forEach((line) => {
          doc.fontSize(8).font('Helvetica').text(line.trim(), { align: 'center' });
        });
        doc.fontSize(8).font('Helvetica').text(currencyNote, { align: 'center' });
        doc.moveDown(0.5);

        // Draw horizontal line
        doc.strokeColor('#333333').lineWidth(1);
        doc.moveTo(54, doc.y).lineTo(541, doc.y).stroke();
        doc.moveDown(0.5);

        // Table styling for Employee Details, Attendance Summary, and Salary Breakdown
        const leftColumn = 54;
        const tableFullWidth = 487;
        const sectionHeaderGray = '#D9D9D9';
        const borderGray = '#D5D5D5';
        const rowH = 14;
        const headerRowH = 16;
        const pad = 6; // cell padding
        let currentY = doc.y;

        // Helper: draw a 4-column table with gray header and data rows
        const drawFourColTable = (
          headerText: string,
          rows: [string, string, string, string][],
        ) => {
          // Wider value columns (2 & 4) so email and other long values don't wrap
          const colW = [96, 156, 96, 139]; // 4 columns sum to tableFullWidth (487)
          const x0 = leftColumn;
          const x1 = x0 + colW[0];
          const x2 = x1 + colW[1];
          const x3 = x2 + colW[2];
          const tabTop = currentY;
          const tabHeight = headerRowH + rows.length * rowH;
          doc.strokeColor(borderGray).lineWidth(0.5);
          doc.rect(leftColumn, tabTop, tableFullWidth, tabHeight).stroke();
          doc.fillColor(sectionHeaderGray).rect(x0, tabTop, colW[0], headerRowH).fill();
          doc.fillColor(sectionHeaderGray).rect(x1, tabTop, colW[1], headerRowH).fill();
          doc.fillColor(sectionHeaderGray).rect(x2, tabTop, colW[2], headerRowH).fill();
          doc.fillColor(sectionHeaderGray).rect(x3, tabTop, colW[3], headerRowH).fill();
          doc.rect(x0, tabTop, colW[0], headerRowH).stroke();
          doc.rect(x1, tabTop, colW[1], headerRowH).stroke();
          doc.rect(x2, tabTop, colW[2], headerRowH).stroke();
          doc.rect(x3, tabTop, colW[3], headerRowH).stroke();
          doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
          doc.text(headerText, x0 + pad, tabTop + pad, { width: tableFullWidth - pad * 2 });
          let rowY = tabTop + headerRowH;
          doc.fontSize(8).font('Helvetica');
          rows.forEach(([l1, v1, l2, v2]) => {
            doc.rect(x0, rowY, colW[0], rowH).stroke();
            doc.rect(x1, rowY, colW[1], rowH).stroke();
            doc.rect(x2, rowY, colW[2], rowH).stroke();
            doc.rect(x3, rowY, colW[3], rowH).stroke();
            doc.font('Helvetica-Bold').text(l1, x0 + pad, rowY + 3, { width: colW[0] - pad * 2 });
            doc.font('Helvetica').text(v1, x1 + pad, rowY + 3, { width: colW[1] - pad * 2 });
            doc.font('Helvetica-Bold').text(l2, x2 + pad, rowY + 3, { width: colW[2] - pad * 2 });
            doc.font('Helvetica').text(v2, x3 + pad, rowY + 3, { width: colW[3] - pad * 2 });
            rowY += rowH;
          });
          currentY = rowY + 8;
        };

        // EMPLOYEE DETAILS — table (truncate long email so it doesn't wrap)
        const maxEmailLen = 42;
        const emailStr = payrollData.user.email || '';
        const displayEmail = emailStr.length > maxEmailLen ? emailStr.slice(0, maxEmailLen - 3) + '...' : emailStr;
        const empRows: [string, string, string, string][] = [
          ['Employee ID:', payrollData.user.employeeId, 'Email:', displayEmail],
          ['Name:', payrollData.user.name, 'Designation:', payrollData.user.designation],
          ['Employee Number:', String(payrollData.user.employeeNumber), 'Date of Joining:', this.formatDate(payrollData.user.dateOfJoining)],
          ['Pay Period:', payPeriod, 'Pay Date:', payDateStr],
        ];
        drawFourColTable('EMPLOYEE DETAILS', empRows);

        // ATTENDANCE SUMMARY — table
        const attRows: [string, string, string, string][] = [
          ['Total Days:', payrollData.workingDays.toString(), 'Weekend Days:', payrollData.weekendDays.toString()],
          ['Holiday Days:', payrollData.holidayDays.toString(), 'Present Days:', payrollData.presentDays.toString()],
          ['Casual Leave:', payrollData.casualLeaveDays.toString(), 'Half Days:', payrollData.halfDays.toString()],
          ['Loss of Pay:', payrollData.lossOfPayDays.toString(), 'Total Pay Days:', payrollData.totalPayDays.toString()],
        ];
        drawFourColTable('ATTENDANCE SUMMARY', attRows);

        // SALARY BREAKDOWN — section header bar then table below
        doc.fillColor(sectionHeaderGray).rect(leftColumn, currentY, tableFullWidth, headerRowH).fill();
        doc.strokeColor(borderGray).rect(leftColumn, currentY, tableFullWidth, headerRowH).stroke();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('black');
        doc.text('SALARY BREAKDOWN', leftColumn + pad, currentY + pad, { width: tableFullWidth - pad * 2 });
        currentY += headerRowH + 4;

        const tableLeft = 54;
        const tableWidth = 437;
        const headerGray = '#EBEBEB';

        // Single 4-column table: Earnings | Amount | Deductions | Amount (no gap between column pairs)
        const c0 = tableLeft;           const w0 = 150;
        const c1 = c0 + w0;             const w1 = 80;
        const c2 = c1 + w1;             const w2 = 130;
        const c3 = c2 + w2;             const w3 = tableWidth - (w0 + w1 + w2);

        const tableTop = currentY;
        const mainTableHeight = headerRowH + rowH * 2;

        // Single table: draw outer border first, then cell borders
        doc.strokeColor(borderGray).lineWidth(0.5);
        doc.rect(tableLeft, tableTop, tableWidth, mainTableHeight).stroke();

        // Header row (soft light gray) — 4 columns in one row
        doc.fillColor(headerGray).rect(c0, tableTop, w0, headerRowH).fill();
        doc.fillColor(headerGray).rect(c1, tableTop, w1, headerRowH).fill();
        doc.fillColor(headerGray).rect(c2, tableTop, w2, headerRowH).fill();
        doc.fillColor(headerGray).rect(c3, tableTop, w3, headerRowH).fill();
        doc.rect(c0, tableTop, w0, headerRowH).stroke();
        doc.rect(c1, tableTop, w1, headerRowH).stroke();
        doc.rect(c2, tableTop, w2, headerRowH).stroke();
        doc.rect(c3, tableTop, w3, headerRowH).stroke();

        doc.fontSize(8).font('Helvetica-Bold').fillColor('black');
        doc.text('Earnings', c0 + pad, tableTop + 4, { width: w0 - pad * 2 });
        doc.text('Amount (Rs.)', c1 + pad, tableTop + 4, { width: w1 - pad * 2, align: 'right' });
        doc.text('Deductions', c2 + pad, tableTop + 4, { width: w2 - pad * 2 });
        doc.text('Amount (Rs.)', c3 + pad, tableTop + 4, { width: w3 - pad * 2, align: 'right' });

        let rowY = tableTop + headerRowH;
        doc.rect(c0, rowY, w0, rowH).stroke();
        doc.rect(c1, rowY, w1, rowH).stroke();
        doc.rect(c2, rowY, w2, rowH).stroke();
        doc.rect(c3, rowY, w3, rowH).stroke();
        doc.fontSize(8).font('Helvetica').text('Salary and other Allowances', c0 + pad, rowY + 3, { width: w0 - pad * 2 });
        doc.text(this.formatCurrency(payrollData.grossEarnings), c1 + pad, rowY + 3, { width: w1 - pad * 2, align: 'right' });
        doc.text('Withholding Tax', c2 + pad, rowY + 3, { width: w2 - pad * 2 });
        doc.text('-', c3 + pad, rowY + 3, { width: w3 - pad * 2, align: 'right' });
        rowY += rowH;
        doc.rect(c0, rowY, w0, rowH).stroke();
        doc.rect(c1, rowY, w1, rowH).stroke();
        doc.rect(c2, rowY, w2, rowH).stroke();
        doc.rect(c3, rowY, w3, rowH).stroke();
        doc.text('Professional Tax', c2 + pad, rowY + 3, { width: w2 - pad * 2 });
        doc.text('-', c3 + pad, rowY + 3, { width: w3 - pad * 2, align: 'right' });
        rowY += rowH;

        const reimbLabelW = 350;
        doc.rect(tableLeft, rowY, reimbLabelW, rowH).stroke();
        doc.rect(tableLeft + reimbLabelW, rowY, tableWidth - reimbLabelW, rowH).stroke();
        doc.fontSize(8).font('Helvetica-Bold').text('Reimbursements', tableLeft + pad, rowY + 3, { width: reimbLabelW - pad * 2 });
        doc.font('Helvetica').text(
          payrollData.reimbursements > 0 ? this.formatCurrency(payrollData.reimbursements) : '-',
          tableLeft + reimbLabelW + pad, rowY + 3,
          { width: tableWidth - reimbLabelW - pad * 2, align: 'right' },
        );
        rowY += rowH + 6;

        // Summary table (2 columns): label | amount
        const sumLabelW = 250;
        const sumAmountW = tableWidth - sumLabelW;
        const summaryTop = rowY;

        doc.fillColor(headerGray).rect(tableLeft, summaryTop, sumLabelW, headerRowH).fill();
        doc.fillColor(headerGray).rect(tableLeft + sumLabelW, summaryTop, sumAmountW, headerRowH).fill();
        doc.strokeColor(borderGray).rect(tableLeft, summaryTop, sumLabelW, headerRowH).stroke();
        doc.strokeColor(borderGray).rect(tableLeft + sumLabelW, summaryTop, sumAmountW, headerRowH).stroke();
        doc.fontSize(8).font('Helvetica-Bold').fillColor('black').text('Summary', tableLeft + pad, summaryTop + 4, { width: sumLabelW - pad * 2 });
        rowY = summaryTop + headerRowH;

        const summaryRows = [
          ['Gross Earnings', this.formatCurrency(payrollData.grossEarnings)],
          ['Total Deductions', this.formatCurrency(payrollData.deductions)],
          ['Total Reimbursements', this.formatCurrency(payrollData.reimbursements)],
          ['Net Payable', this.formatCurrency(payrollData.netSalary)],
        ];
        for (let i = 0; i < summaryRows.length; i++) {
          const [label, value] = summaryRows[i];
          const isNetPayable = i === summaryRows.length - 1;
          if (isNetPayable) {
            doc.fontSize(8).font('Helvetica-Bold');
          } else {
            doc.fontSize(8).font('Helvetica');
          }
          doc.rect(tableLeft, rowY, sumLabelW, rowH).stroke();
          doc.rect(tableLeft + sumLabelW, rowY, sumAmountW, rowH).stroke();
          doc.text(label, tableLeft + pad, rowY + 3, { width: sumLabelW - pad * 2 });
          doc.text(value, tableLeft + sumLabelW + pad, rowY + 3, { width: sumAmountW - pad * 2, align: 'right' });
          rowY += rowH;
        }

        currentY = rowY + 8;

        doc.fontSize(8).font('Helvetica-Oblique').text('Net Payable = Gross earnings - Total deductions', leftColumn, currentY);
        currentY += 12;

        doc.fontSize(8).font('Helvetica').text(`Net Payable in words: ${numberToWordsInr(payrollData.netSalary)}`, leftColumn, currentY, { width: tableFullWidth });
        currentY += 22;

        doc.strokeColor('#333333').lineWidth(1);
        doc.moveTo(54, currentY).lineTo(541, currentY).stroke();
        currentY += 12;

        doc.fontSize(8).font('Helvetica-Oblique');
        doc.text('This is a computer-generated document. No signature is required.', leftColumn, currentY, { align: 'center', width: tableFullWidth });
        currentY += 12;
        doc.text(`Generated on: ${this.formatDate(new Date())}`, leftColumn, currentY, { align: 'center', width: tableFullWidth });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}
