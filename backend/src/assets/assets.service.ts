import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateMyAssetDto } from './dto/update-my-asset.dto';
import { AssetType, AssetAction } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as path from 'path';

const userSelect = { id: true, name: true, employeeId: true, employeeNumber: true };

type AssetSnapshot = {
  id: string;
  assetNumber: string;
  assetName: string;
  assetType: AssetType;
  serialNumber?: string | null;
};

@Injectable()
export class AssetsService {
  constructor(private prisma: PrismaService) {}

  private async logHistory(
    asset: AssetSnapshot,
    action: AssetAction,
    userId: string | null,
    performedById: string,
    remarks: string | null,
  ) {
    const ids = [...new Set([performedById, ...(userId ? [userId] : [])])];
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, employeeId: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const performer = userMap.get(performedById);
    const employee = userId ? userMap.get(userId) : null;

    await this.prisma.assetHistory.create({
      data: {
        assetId: asset.id,
        assetNumber: asset.assetNumber,
        assetName: asset.assetName,
        assetType: asset.assetType,
        serialNumber: asset.serialNumber ?? null,
        userId: userId ?? null,
        employeeName: employee?.name ?? null,
        employeeId: employee?.employeeId ?? null,
        action,
        performedBy: performedById,
        performedByName: performer?.name ?? 'Unknown',
        remarks,
      },
    });
  }

  async create(dto: CreateAssetDto, performedById: string) {
    const existing = await this.prisma.asset.findUnique({ where: { assetNumber: dto.assetNumber } });
    if (existing) throw new ConflictException('Asset number already exists');

    const asset = await this.prisma.asset.create({
      data: {
        assetName: dto.assetName,
        assetType: dto.assetType,
        assetNumber: dto.assetNumber,
        serialNumber: dto.serialNumber,
        userId: dto.userId ?? null,
      },
      include: { user: { select: userSelect } },
    });

    if (dto.userId) {
      await this.logHistory(asset, AssetAction.ASSIGNED, dto.userId, performedById, null);
    }

    return asset;
  }

  async findAll(userId?: string) {
    return this.prisma.asset.findMany({
      where: userId ? { userId } : undefined,
      include: { user: { select: userSelect } },
      orderBy: [{ assetType: 'asc' }, { assetName: 'asc' }],
    });
  }

  async findOne(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: { user: { select: userSelect } },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async update(id: string, dto: UpdateAssetDto, performedById: string) {
    const current = await this.findOne(id);

    if (dto.assetNumber) {
      const conflict = await this.prisma.asset.findUnique({ where: { assetNumber: dto.assetNumber } });
      if (conflict && conflict.id !== id) throw new ConflictException('Asset number already in use');
    }

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.assetName && { assetName: dto.assetName }),
        ...(dto.assetType && { assetType: dto.assetType }),
        ...(dto.assetNumber && { assetNumber: dto.assetNumber }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
        ...('userId' in dto && { userId: dto.userId ?? null }),
      },
      include: { user: { select: userSelect } },
    });

    if ('userId' in dto) {
      const oldUserId = current.userId ?? null;
      const newUserId = dto.userId ?? null;

      if (oldUserId !== newUserId) {
        const snap: AssetSnapshot = {
          id: current.id,
          assetNumber: dto.assetNumber ?? current.assetNumber,
          assetName: dto.assetName ?? current.assetName,
          assetType: (dto.assetType as AssetType) ?? current.assetType,
          serialNumber: dto.serialNumber !== undefined ? dto.serialNumber : current.serialNumber,
        };

        if (!oldUserId && newUserId) {
          await this.logHistory(snap, AssetAction.ASSIGNED, newUserId, performedById, null);
        } else if (oldUserId && !newUserId) {
          await this.logHistory(snap, AssetAction.RETURNED, oldUserId, performedById, null);
        } else if (oldUserId && newUserId) {
          // Transferred: log RETURNED for old, ASSIGNED for new
          await this.logHistory(snap, AssetAction.RETURNED, oldUserId, performedById, `Transferred to another employee`);
          await this.logHistory(snap, AssetAction.REASSIGNED, newUserId, performedById, `Transferred from previous employee`);
        }
      }
    }

    return updated;
  }

  async remove(id: string, performedById: string) {
    const current = await this.findOne(id);

    if (current.userId) {
      await this.logHistory(current, AssetAction.RETURNED, current.userId, performedById, 'Asset record deleted');
    }
    await this.logHistory(current, AssetAction.DELETED, null, performedById, null);

    return this.prisma.asset.delete({ where: { id } });
  }

  async findMyAssets(userId: string) {
    return this.prisma.asset.findMany({
      where: { userId },
      orderBy: [{ assetType: 'asc' }, { assetName: 'asc' }],
    });
  }

  async createMyAsset(userId: string, dto: { assetType: string; assetNumber: string; serialNumber?: string }) {
    const existing = await this.prisma.asset.findUnique({ where: { assetNumber: dto.assetNumber } });
    if (existing) {
      if (existing.userId && existing.userId !== userId)
        throw new ConflictException('Asset number is already assigned to another user');

      const updated = await this.prisma.asset.update({
        where: { id: existing.id },
        data: { userId, serialNumber: dto.serialNumber ?? existing.serialNumber },
      });

      if (!existing.userId) {
        await this.logHistory(updated, AssetAction.ASSIGNED, userId, userId, 'Self-registered');
      }

      return updated;
    }

    const created = await this.prisma.asset.create({
      data: {
        assetName: dto.assetType.charAt(0) + dto.assetType.slice(1).toLowerCase(),
        assetType: dto.assetType as AssetType,
        assetNumber: dto.assetNumber,
        serialNumber: dto.serialNumber,
        userId,
      },
    });

    await this.logHistory(created, AssetAction.ASSIGNED, userId, userId, 'Self-registered');
    return created;
  }

  async updateMyAsset(id: string, userId: string, dto: UpdateMyAssetDto) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.userId !== userId) throw new ForbiddenException('You can only update your own assets');

    if (dto.assetNumber && dto.assetNumber !== asset.assetNumber) {
      const conflict = await this.prisma.asset.findUnique({ where: { assetNumber: dto.assetNumber } });
      if (conflict && conflict.id !== id) throw new ConflictException('Asset number already in use');
    }

    return this.prisma.asset.update({
      where: { id },
      data: {
        ...(dto.assetNumber !== undefined && { assetNumber: dto.assetNumber }),
        ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber || null }),
      },
    });
  }

  async getHistory(filters: {
    userId?: string;
    assetType?: string;
    action?: string;
    from?: string;
    to?: string;
    search?: string;
  }) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.assetType) where.assetType = filters.assetType as AssetType;
    if (filters.action) where.action = filters.action as AssetAction;

    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) {
        const to = new Date(filters.to);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (filters.search) {
      const s = filters.search.trim();
      where.OR = [
        { assetNumber: { contains: s, mode: 'insensitive' } },
        { assetName: { contains: s, mode: 'insensitive' } },
        { employeeName: { contains: s, mode: 'insensitive' } },
        { employeeId: { contains: s, mode: 'insensitive' } },
        { performedByName: { contains: s, mode: 'insensitive' } },
        { remarks: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.assetHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEmployeeHistory(userId: string) {
    return this.prisma.assetHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyHistory(userId: string) {
    return this.prisma.assetHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReferenceList(): Promise<{ laptops: string[]; monitors: string[] }> {
    const filePath = path.resolve(__dirname, '../../prisma/excel/1asset.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.worksheets[0];

    const laptops: string[] = [];
    const monitors: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const a = row.getCell(1).value;
      const b = row.getCell(2).value;
      if (a != null && String(a).trim()) laptops.push(String(a).trim());
      if (b != null && String(b).trim()) monitors.push(String(b).trim());
    });

    return { laptops, monitors };
  }
}
