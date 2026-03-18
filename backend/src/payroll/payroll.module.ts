import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PayrollController } from './payroll.controller';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ExcelGeneratorService } from './excel-generator.service';

@Module({
  controllers: [PayrollController],
  providers: [
    PayrollService,
    PayrollCalculatorService,
    PdfGeneratorService,
    ExcelGeneratorService,
  ],
  exports: [
    PayrollService,
    PayrollCalculatorService,
    PdfGeneratorService,
    ExcelGeneratorService,
  ],
})
export class PayrollModule {}
