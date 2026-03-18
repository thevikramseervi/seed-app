import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  async create(createHolidayDto: CreateHolidayDto) {
    const existingHoliday = await this.prisma.holiday.findUnique({
      where: { date: new Date(createHolidayDto.date) },
    });

    if (existingHoliday) {
      throw new ConflictException('Holiday already exists for this date');
    }

    return this.prisma.holiday.create({
      data: {
        date: new Date(createHolidayDto.date),
        name: createHolidayDto.name,
        description: createHolidayDto.description,
        isMandatory: createHolidayDto.isMandatory ?? true,
      },
    });
  }

  async findAll(year?: number) {
    const where: any = {};

    if (year) {
      where.date = {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      };
    }

    return this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    return holiday;
  }

  async update(id: string, updateHolidayDto: UpdateHolidayDto) {
    await this.findOne(id);

    const updateData: any = { ...updateHolidayDto };

    if (updateHolidayDto.date) {
      updateData.date = new Date(updateHolidayDto.date);

      // Check if new date conflicts with another holiday
      const existingHoliday = await this.prisma.holiday.findUnique({
        where: { date: updateData.date },
      });

      if (existingHoliday && existingHoliday.id !== id) {
        throw new ConflictException('Holiday already exists for this date');
      }
    }

    return this.prisma.holiday.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.holiday.delete({
      where: { id },
    });
  }

  async getHolidayDates(year: number): Promise<Date[]> {
    const holidays = await this.findAll(year);
    return holidays.map((h) => h.date);
  }
}
