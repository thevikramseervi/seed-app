import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box, Button, FormControl, InputLabel, Select, MenuItem,
  Grid, Alert, Typography, CircularProgress, Chip,
} from '@mui/material';
import { Download, Inventory2 } from '@mui/icons-material';
import ExcelJS from 'exceljs';
import { assetsApi } from '../../api/assets';
import { AssetType } from '../../types';
import type { User } from '../../types';
import { QUERY_KEYS } from '../../queryKeys';
import ResponsiveTable from '../../components/ResponsiveTable';

type FilterType = 'ALL' | 'ASSIGNED' | 'RETURNED';

interface AssetReportRow {
  userId: string;
  employeeId: string;
  employeeNumber: number;
  name: string;
  role: string;
  designation: string;
  laptop: string;
  monitor: string;
  hdd: string;
  connector: string;
  serialNumber: string;
  hasAssets: boolean;
}

interface Props {
  users: User[] | undefined;
  usersLoading: boolean;
}

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 'ALL',      label: 'All Employees' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'RETURNED', label: 'Returned / No Assets' },
];

const AssetReportTab: React.FC<Props> = ({ users, usersLoading }) => {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [generated, setGenerated] = useState(false);

  const { data: assets = [], isLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.assets,
    queryFn: () => assetsApi.getAll(),
    enabled: false,
  });

  const handleGenerate = () => {
    setGenerated(true);
    refetch();
  };

  // Build per-employee rows by joining users + assets
  const rows = useMemo<AssetReportRow[]>(() => {
    if (!generated || !users) return [];

    // Index assets by userId
    const assetsByUser = new Map<string, typeof assets>();
    for (const asset of assets) {
      if (!asset.userId) continue;
      if (!assetsByUser.has(asset.userId)) assetsByUser.set(asset.userId, []);
      assetsByUser.get(asset.userId)!.push(asset);
    }

    return users
      .filter((u) => u.status === 'ACTIVE' || !u.status)
      .map((u) => {
        const userAssets = assetsByUser.get(u.id) ?? [];
        const get = (type: AssetType) =>
          userAssets.find((a) => a.assetType === type)?.assetNumber ?? '';

        const laptop   = get(AssetType.LAPTOP);
        const monitor  = get(AssetType.MONITOR);
        const hdd      = get(AssetType.HDD);
        const connector = get(AssetType.CONNECTOR);

        const mainSerial =
          userAssets.find((a) => a.assetType === AssetType.LAPTOP)?.serialNumber ??
          userAssets.find((a) => a.serialNumber)?.serialNumber ?? '';

        return {
          userId: u.id,
          employeeId: u.employeeId,
          employeeNumber: u.employeeNumber,
          name: u.name,
          role: u.role.replace(/_/g, ' '),
          designation: u.designation,
          laptop,
          monitor,
          hdd,
          connector,
          serialNumber: mainSerial,
          hasAssets: userAssets.length > 0,
        };
      });
  }, [generated, users, assets]);

  const filteredRows = useMemo(() => {
    if (filter === 'ASSIGNED') return rows.filter((r) => r.hasAssets);
    if (filter === 'RETURNED') return rows.filter((r) => !r.hasAssets);
    return rows;
  }, [rows, filter]);

  const handleExport = async () => {
    if (!filteredRows.length) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Asset Report');

    const headers = [
      'Sl No', 'Employee ID', 'Employee Name', 'Role', 'Designation',
      'Laptop', 'Monitor', 'External HDD', 'Asset Number (Connector)', 'Serial Number',
    ];

    // Header row
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
    sheet.getRow(1).height = 28;

    // Data rows
    filteredRows.forEach((r, idx) => {
      const row = sheet.addRow([
        idx + 1,
        r.employeeId,
        r.name,
        r.role,
        r.designation,
        r.laptop      || '—',
        r.monitor     || '—',
        r.hdd         || '—',
        r.connector   || '—',
        r.serialNumber || '—',
      ]);
      row.height = 18;
      row.eachCell((cell, colNum) => {
        cell.font = { size: 10 };
        cell.alignment = { horizontal: colNum <= 5 ? 'left' : 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
        // Highlight rows with no assets in light red
        if (!r.hasAssets) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF0F0' } };
        } else if (idx % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5FF' } };
        }
      });
    });

    // Column widths
    const widths = [8, 14, 24, 18, 20, 18, 18, 16, 22, 20];
    sheet.columns.forEach((col, i) => { col.width = widths[i] ?? 15; });

    // Freeze header
    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    // Filter label in subtitle
    const filterLabel = FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? 'All';
    sheet.addRow([]);
    const noteRow = sheet.addRow([`Filter: ${filterLabel} | Total: ${filteredRows.length} employees`]);
    noteRow.getCell(1).font = { italic: true, size: 9, color: { argb: 'FF666666' } };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Asset_Report_${filter}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Controls */}
      <Grid container spacing={2} mb={3} alignItems="flex-end">
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth>
            <InputLabel>Filter</InputLabel>
            <Select
              value={filter}
              label="Filter"
              onChange={(e) => setFilter(e.target.value as FilterType)}
            >
              {FILTER_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, md: 2 }}>
          <Button
            fullWidth
            variant="contained"
            onClick={handleGenerate}
            disabled={isLoading || usersLoading}
            sx={{ height: 56 }}
          >
            {isLoading ? <CircularProgress size={22} /> : 'Generate'}
          </Button>
        </Grid>

        {generated && filteredRows.length > 0 && (
          <Grid size={{ xs: 12, md: 3 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExport}
              sx={{ height: 56 }}
            >
              Export to Excel
            </Button>
          </Grid>
        )}
      </Grid>

      {/* Summary chips */}
      {generated && !isLoading && rows.length > 0 && (
        <Box display="flex" gap={1.5} mb={2} flexWrap="wrap">
          <Chip
            icon={<Inventory2 fontSize="small" />}
            label={`${rows.filter((r) => r.hasAssets).length} Assigned`}
            color="success"
            size="small"
            variant={filter === 'ASSIGNED' ? 'filled' : 'outlined'}
            onClick={() => setFilter('ASSIGNED')}
            clickable
          />
          <Chip
            label={`${rows.filter((r) => !r.hasAssets).length} No Assets`}
            color="default"
            size="small"
            variant={filter === 'RETURNED' ? 'filled' : 'outlined'}
            onClick={() => setFilter('RETURNED')}
            clickable
          />
          <Chip
            label={`${rows.length} Total`}
            color="primary"
            size="small"
            variant={filter === 'ALL' ? 'filled' : 'outlined'}
            onClick={() => setFilter('ALL')}
            clickable
          />
          <Typography variant="body2" color="text.secondary" alignSelf="center">
            — showing {filteredRows.length} employee{filteredRows.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
      )}

      {/* Table */}
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : generated && filteredRows.length === 0 ? (
        <Alert severity="info">No records found for the selected filter.</Alert>
      ) : generated ? (
        <ResponsiveTable
          rows={filteredRows}
          rowKey={(r) => r.userId}
          maxHeight={520}
          columns={[
            {
              header: 'Employee',
              render: (r) => (
                <Box>
                  <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.employeeId}</Typography>
                </Box>
              ),
            },
            {
              header: 'Role',
              render: (r) => (
                <Chip label={r.role} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
              ),
            },
            { header: 'Designation', render: (r) => r.designation },
            {
              header: 'Laptop',
              render: (r) => r.laptop
                ? <Chip label={r.laptop} size="small" color="primary" variant="outlined" />
                : <Typography variant="body2" color="text.disabled">—</Typography>,
            },
            {
              header: 'Monitor',
              render: (r) => r.monitor
                ? <Chip label={r.monitor} size="small" color="info" variant="outlined" />
                : <Typography variant="body2" color="text.disabled">—</Typography>,
            },
            {
              header: 'HDD',
              render: (r) => r.hdd
                ? <Chip label={r.hdd} size="small" color="success" variant="outlined" />
                : <Typography variant="body2" color="text.disabled">—</Typography>,
            },
            {
              header: 'Connector',
              render: (r) => r.connector
                ? <Chip label={r.connector} size="small" color="warning" variant="outlined" />
                : <Typography variant="body2" color="text.disabled">—</Typography>,
            },
            {
              header: 'Serial No.',
              render: (r) => r.serialNumber
                ? <Typography variant="body2">{r.serialNumber}</Typography>
                : <Typography variant="body2" color="text.disabled">—</Typography>,
            },
          ]}
        />
      ) : null}
    </Box>
  );
};

export default AssetReportTab;
