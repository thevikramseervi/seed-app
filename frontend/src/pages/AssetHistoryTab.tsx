import React, { useState, useMemo } from 'react';
import {
  Box, Typography, TextField, Select, MenuItem, FormControl, InputLabel,
  Chip, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, TableSortLabel, Alert, CircularProgress, InputAdornment,
  IconButton, Tooltip, Collapse,
} from '@mui/material';
import { Search, FilterList, FilterListOff, LaptopMac, Monitor, Storage, Cable, DevicesOther } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { assetsApi, AssetHistoryFilters } from '../api/assets';
import { AssetHistory, AssetAction, AssetType } from '../types';
import { QUERY_KEYS } from '../queryKeys';

const ACTION_COLORS: Record<AssetAction, 'success' | 'warning' | 'info' | 'error'> = {
  [AssetAction.ASSIGNED]: 'success',
  [AssetAction.RETURNED]: 'warning',
  [AssetAction.REASSIGNED]: 'info',
  [AssetAction.DELETED]: 'error',
};

const ACTION_LABELS: Record<AssetAction, string> = {
  [AssetAction.ASSIGNED]: 'Assigned',
  [AssetAction.RETURNED]: 'Returned',
  [AssetAction.REASSIGNED]: 'Reassigned',
  [AssetAction.DELETED]: 'Deleted',
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  [AssetType.LAPTOP]: 'Laptop',
  [AssetType.MONITOR]: 'Monitor',
  [AssetType.HDD]: 'HDD',
  [AssetType.CONNECTOR]: 'Connector',
  [AssetType.OTHER]: 'Other',
};

const ASSET_ICONS: Record<AssetType, React.ReactNode> = {
  [AssetType.LAPTOP]: <LaptopMac fontSize="small" />,
  [AssetType.MONITOR]: <Monitor fontSize="small" />,
  [AssetType.HDD]: <Storage fontSize="small" />,
  [AssetType.CONNECTOR]: <Cable fontSize="small" />,
  [AssetType.OTHER]: <DevicesOther fontSize="small" />,
};

type SortField = 'createdAt' | 'assetNumber' | 'assetType' | 'employeeName' | 'action' | 'performedByName';
type SortDir = 'asc' | 'desc';

interface Props {
  /** If provided, shows history only for this employee (admin per-employee view) */
  filterUserId?: string;
  /** Use the employee's own history endpoint instead of admin endpoint */
  isMine?: boolean;
}

const AssetHistoryTab: React.FC<Props> = ({ filterUserId, isMine = false }) => {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterAssetType, setFilterAssetType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const apiFilters: AssetHistoryFilters = {
    ...(filterUserId && { userId: filterUserId }),
    ...(filterAction && { action: filterAction }),
    ...(filterAssetType && { assetType: filterAssetType }),
    ...(filterFrom && { from: filterFrom }),
    ...(filterTo && { to: filterTo }),
    ...(search.trim() && { search: search.trim() }),
  };

  const { data: history = [], isLoading, isError } = useQuery({
    queryKey: isMine
      ? QUERY_KEYS.myAssetHistory
      : filterUserId
        ? QUERY_KEYS.assetEmployeeHistory(filterUserId)
        : QUERY_KEYS.assetHistory(apiFilters),
    queryFn: isMine
      ? () => assetsApi.getMyHistory()
      : filterUserId
        ? () => assetsApi.getEmployeeHistory(filterUserId)
        : () => assetsApi.getHistory(apiFilters),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Client-side filtering for isMine / filterUserId cases (server handles filters for admin full-list)
  const filtered = useMemo(() => {
    let rows = [...history];

    if (isMine || filterUserId) {
      // Apply client-side filters
      if (search.trim()) {
        const s = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.assetNumber.toLowerCase().includes(s) ||
            r.assetName.toLowerCase().includes(s) ||
            (r.performedByName ?? '').toLowerCase().includes(s) ||
            (r.remarks ?? '').toLowerCase().includes(s),
        );
      }
      if (filterAction) rows = rows.filter((r) => r.action === filterAction);
      if (filterAssetType) rows = rows.filter((r) => r.assetType === filterAssetType);
      if (filterFrom) rows = rows.filter((r) => new Date(r.createdAt) >= new Date(filterFrom));
      if (filterTo) {
        const to = new Date(filterTo);
        to.setHours(23, 59, 59, 999);
        rows = rows.filter((r) => new Date(r.createdAt) <= to);
      }
    }

    rows.sort((a, b) => {
      let av: string | number = a[sortField] ?? '';
      let bv: string | number = b[sortField] ?? '';
      if (sortField === 'createdAt') {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return rows;
  }, [history, search, filterAction, filterAssetType, filterFrom, filterTo, sortField, sortDir, isMine, filterUserId]);

  const hasActiveFilters = !!(filterAction || filterAssetType || filterFrom || filterTo);

  return (
    <Box>
      {/* Search + Filter toggle row */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search asset number, name, employee…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: '1 1 240px', minWidth: 200 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Tooltip title={showFilters ? 'Hide filters' : 'Show filters'}>
          <IconButton
            onClick={() => setShowFilters((v) => !v)}
            color={hasActiveFilters ? 'primary' : 'default'}
            size="small"
          >
            {hasActiveFilters ? <FilterList /> : <FilterListOff />}
          </IconButton>
        </Tooltip>
        <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Collapsible filter row */}
      <Collapse in={showFilters}>
        <Box
          sx={{
            display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap',
            p: 2, borderRadius: 2, border: '1px solid', borderColor: 'divider',
            backgroundColor: 'action.hover',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Action</InputLabel>
            <Select value={filterAction} label="Action" onChange={(e) => setFilterAction(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {Object.values(AssetAction).map((a) => (
                <MenuItem key={a} value={a}>{ACTION_LABELS[a]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Asset Type</InputLabel>
            <Select value={filterAssetType} label="Asset Type" onChange={(e) => setFilterAssetType(e.target.value)}>
              <MenuItem value="">All</MenuItem>
              {Object.values(AssetType).map((t) => (
                <MenuItem key={t} value={t}>{ASSET_TYPE_LABELS[t]}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="From date"
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="To date"
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
        </Box>
      </Collapse>

      {isLoading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Alert severity="error">Failed to load asset history.</Alert>
      ) : filtered.length === 0 ? (
        <Alert severity="info">No asset history records found.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'createdAt'}
                    direction={sortField === 'createdAt' ? sortDir : 'asc'}
                    onClick={() => handleSort('createdAt')}
                  >
                    Date & Time
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'assetType'}
                    direction={sortField === 'assetType' ? sortDir : 'asc'}
                    onClick={() => handleSort('assetType')}
                  >
                    Type
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'assetNumber'}
                    direction={sortField === 'assetNumber' ? sortDir : 'asc'}
                    onClick={() => handleSort('assetNumber')}
                  >
                    Asset
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Serial No.</TableCell>
                {!isMine && (
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={sortField === 'employeeName'}
                      direction={sortField === 'employeeName' ? sortDir : 'asc'}
                      onClick={() => handleSort('employeeName')}
                    >
                      Employee
                    </TableSortLabel>
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'action'}
                    direction={sortField === 'action' ? sortDir : 'asc'}
                    onClick={() => handleSort('action')}
                  >
                    Action
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortField === 'performedByName'}
                    direction={sortField === 'performedByName' ? sortDir : 'asc'}
                    onClick={() => handleSort('performedByName')}
                  >
                    Performed By
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((row: AssetHistory) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Typography variant="body2">
                      {new Date(row.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(row.createdAt).toLocaleTimeString('en-IN', {
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ color: 'primary.main', display: 'flex' }}>{ASSET_ICONS[row.assetType]}</Box>
                      <Typography variant="body2">{ASSET_TYPE_LABELS[row.assetType]}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{row.assetNumber}</Typography>
                    <Typography variant="caption" color="text.secondary">{row.assetName}</Typography>
                  </TableCell>
                  <TableCell>
                    {row.serialNumber
                      ? <Typography variant="body2" color="text.secondary">{row.serialNumber}</Typography>
                      : <Typography variant="body2" color="text.disabled">—</Typography>
                    }
                  </TableCell>
                  {!isMine && (
                    <TableCell>
                      {row.employeeName ? (
                        <>
                          <Typography variant="body2">{row.employeeName}</Typography>
                          {row.employeeId && (
                            <Typography variant="caption" color="text.secondary">{row.employeeId}</Typography>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Chip
                      label={ACTION_LABELS[row.action]}
                      color={ACTION_COLORS[row.action]}
                      size="small"
                      variant="filled"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.performedByName}</Typography>
                  </TableCell>
                  <TableCell>
                    {row.remarks
                      ? <Typography variant="body2" color="text.secondary">{row.remarks}</Typography>
                      : <Typography variant="body2" color="text.disabled">—</Typography>
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default AssetHistoryTab;
