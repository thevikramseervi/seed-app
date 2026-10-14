import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Chip,
  Alert,
  Typography,
  TextField,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import ExcelJS from 'exceljs';
import { attendanceApi } from '../../api/attendance';
import { Attendance, AttendanceStatus, Role } from '../../types';
import type { User } from '../../types';
import { QUERY_KEYS } from '../../queryKeys';
import { formatTime, formatDuration } from '../../utils/format';
import ResponsiveDialog from '../../components/ResponsiveDialog';
import ResponsiveTable from '../../components/ResponsiveTable';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { getApiErrorMessage } from '../../hooks/apiMessages';

type AttendanceReportRow = Attendance & {
  user?: {
    employeeId: string;
    employeeNumber?: number;
    name: string;
    designation?: string;
  };
};

interface AttendanceReportTabProps {
  users: User[] | undefined;
  usersLoading: boolean;
  usersError: boolean;
  onRefetchUsers: () => void;
}

const AttendanceReportTab: React.FC<AttendanceReportTabProps> = ({
  users,
  usersLoading,
  usersError,
  onRefetchUsers,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | 'WEEKEND_HOLIDAY' | null>(null);

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    record: AttendanceReportRow | null;
    newStatus: AttendanceStatus | '';
  }>({ open: false, record: null, newStatus: '' });

  const [createDialog, setCreateDialog] = useState<{
    open: boolean;
    userId: string;
    date: string;
    status: AttendanceStatus | '';
  }>({
    open: false,
    userId: '',
    date: new Date().toISOString().split('T')[0],
    status: AttendanceStatus.PRESENT,
  });

  const { data, isLoading, refetch } = useQuery<AttendanceReportRow[]>({
    queryKey: QUERY_KEYS.attendanceReport(selectedUserId, startDate, endDate),
    queryFn: () =>
      attendanceApi.getReport({
        userId: selectedUserId || undefined,
        startDate,
        endDate,
      }),
    enabled: false,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      attendanceApi.update(id, { status }),
    onSuccess: () => {
      setEditDialog({ open: false, record: null, newStatus: '' });
      showSuccess('Attendance updated successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attendanceDashboard });
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to update attendance'));
    },
  });

  const createMutation = useMutation({
    mutationFn: attendanceApi.createManual,
    onSuccess: () => {
      setCreateDialog((p) => ({ ...p, open: false }));
      showSuccess('Attendance entry created');
      refetch();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attendanceDashboard });
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to create attendance entry'));
    },
  });

  const summary = React.useMemo(() => {
    if (!data) return null;
    const s = { total: data.length, present: 0, absent: 0, halfDay: 0, casualLeave: 0, weekend: 0, holiday: 0 };
    data.forEach((r) => {
      if (r.status === AttendanceStatus.PRESENT) s.present++;
      else if (r.status === AttendanceStatus.ABSENT) s.absent++;
      else if (r.status === AttendanceStatus.HALF_DAY) s.halfDay++;
      else if (r.status === AttendanceStatus.CASUAL_LEAVE) s.casualLeave++;
      else if (r.status === AttendanceStatus.WEEKEND) s.weekend++;
      else if (r.status === AttendanceStatus.HOLIDAY) s.holiday++;
    });
    return s;
  }, [data]);

  const filteredData = React.useMemo(() => {
    if (!data || !statusFilter) return data;
    if (statusFilter === 'WEEKEND_HOLIDAY')
      return data.filter((r) => r.status === AttendanceStatus.WEEKEND || r.status === AttendanceStatus.HOLIDAY);
    return data.filter((r) => r.status === statusFilter);
  }, [data, statusFilter]);

  const STATUS_ABBREV: Record<AttendanceStatus, string> = {
    [AttendanceStatus.PRESENT]:      'P',
    [AttendanceStatus.ABSENT]:       'A',
    [AttendanceStatus.HALF_DAY]:     'HD',
    [AttendanceStatus.HOLIDAY]:      'H',
    [AttendanceStatus.WEEKEND]:      'W',
    [AttendanceStatus.CASUAL_LEAVE]: 'CL',
    [AttendanceStatus.NO_PUNCH]:     'NP',
  };

  const STATUS_COLOR: Partial<Record<AttendanceStatus, string>> = {
    [AttendanceStatus.HOLIDAY]:      'FF0070C0', // blue
    [AttendanceStatus.WEEKEND]:      'FF808080', // grey
    [AttendanceStatus.ABSENT]:       'FFFF0000', // red
    [AttendanceStatus.NO_PUNCH]:     'FFFF0000', // red
    [AttendanceStatus.CASUAL_LEAVE]: 'FFFF9900', // orange
    [AttendanceStatus.HALF_DAY]:     'FFCC6600', // amber
  };

  const handleExport = async () => {
    if (!data?.length) return;

    // 1. Group records by userId, preserving per-day status
    const grouped = new Map<string, Map<string, AttendanceReportRow>>();
    for (const record of data) {
      if (!grouped.has(record.userId)) grouped.set(record.userId, new Map());
      grouped.get(record.userId)!.set(record.date.slice(0, 10), record);
    }

    // 2. Generate ALL dates in the selected range (fills weekend gaps).
    // Use local calendar components — Date#toISOString() is UTC and would
    // shift IST midnight back one day (1 Jul–31 Jul → 30 Jun–30 Jul).
    const dates: string[] = [];
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const cur = new Date(sy, sm - 1, sd);
    const rangeEnd = new Date(ey, em - 1, ed);
    while (cur <= rangeEnd) {
      dates.push(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
      );
      cur.setDate(cur.getDate() + 1);
    }

    // 3. Sort employees by employeeId
    const sortedEntries = Array.from(grouped.entries()).sort(([, aMap], [, bMap]) => {
      const a = aMap.values().next().value?.user?.employeeId ?? '';
      const b = bMap.values().next().value?.user?.employeeId ?? '';
      return a.localeCompare(b);
    });

    // 4. Build workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance Report');

    const FIXED_HEADERS = [
      'Sl No', 'DOJ', 'DOL', 'Bio IDs', 'Employee IDs',
      'Names', 'Designation', 'WD', 'H', 'P', 'HD', 'A(lop)', 'CL', 'Total Pay Days',
    ];
    const dateHeaders = dates.map((d) => {
      const [y, m, day] = d.split('-');
      return `${day}-${m}-${y}`;
    });

    // Header row
    const headerRow = sheet.addRow([...FIXED_HEADERS, ...dateHeaders]);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' },
      };
    });
    sheet.getRow(1).height = 30;

    // 5. Data rows
    let slNo = 1;
    for (const [userId, dayMap] of sortedEntries) {
      const userInfo = users?.find((u) => u.id === userId);
      const records = Array.from(dayMap.values());
      const firstRecord = records[0];

      let wd = 0, h = 0, p = 0, hd = 0, absent = 0, cl = 0;
      for (const r of records) {
        switch (r.status) {
          case AttendanceStatus.PRESENT:      p++;      break;
          case AttendanceStatus.ABSENT:       absent++; break;
          case AttendanceStatus.HALF_DAY:     hd += 0.5; break;
          case AttendanceStatus.HOLIDAY:      h++;      break;
          case AttendanceStatus.WEEKEND:      wd++;     break;
          case AttendanceStatus.CASUAL_LEAVE: cl++;     break;
          case AttendanceStatus.NO_PUNCH:     absent++; break;
        }
      }
      const totalPayDays = p + hd + cl + h + wd;

      const rowValues: (string | number)[] = [
        slNo++,
        userInfo?.dateOfJoining
          ? new Date(userInfo.dateOfJoining).toLocaleDateString('en-IN')
          : '',
        userInfo?.dateOfLeaving
          ? new Date(userInfo.dateOfLeaving).toLocaleDateString('en-IN')
          : '',
        firstRecord.user?.employeeNumber ?? '',
        firstRecord.user?.employeeId ?? '',
        firstRecord.user?.name ?? '',
        firstRecord.user?.designation ?? '',
        wd, h, p, hd, absent, cl, totalPayDays,
        ...dates.map((d) => {
          const r = dayMap.get(d);
          if (r) return STATUS_ABBREV[r.status];
          const dow = new Date(d + 'T00:00:00').getDay();
          return (dow === 0 || dow === 6) ? 'W' : '';
        }),
      ];

      const row = sheet.addRow(rowValues);
      row.height = 18;

      // Style fixed cells
      for (let c = 1; c <= FIXED_HEADERS.length; c++) {
        const cell = row.getCell(c);
        cell.font = { size: 10 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      }

      // Style per-date cells with status colour
      dates.forEach((d, idx) => {
        const cell = row.getCell(FIXED_HEADERS.length + idx + 1);
        const r = dayMap.get(d);
        const dow = new Date(d + 'T00:00:00').getDay();
        const isAutoWeekend = !r && (dow === 0 || dow === 6);
        cell.font = {
          size: 10,
          bold: false,
          color: r && STATUS_COLOR[r.status]
            ? { argb: STATUS_COLOR[r.status] }
            : isAutoWeekend
              ? { argb: 'FF808080' }
              : { argb: 'FF000000' },
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    }

    // 6. Column widths
    sheet.columns.forEach((col, idx) => {
      col.width = idx < FIXED_HEADERS.length ? 14 : 10;
    });
    // Name column wider
    sheet.getColumn(6).width = 20;

    // 7. Freeze header row and first 7 columns
    sheet.views = [{ state: 'frozen', xSplit: FIXED_HEADERS.length, ySplit: 1 }];

    // 8. Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Attendance_Report_${startDate}_to_${endDate}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const isSuperAdmin = authUser?.role === Role.SUPER_ADMIN;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            fullWidth label="Start Date" type="date" value={startDate}
            onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField
            fullWidth label="End Date" type="date" value={endDate}
            onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth disabled={usersLoading}>
            <InputLabel>Employee (Optional)</InputLabel>
            <Select value={selectedUserId} label="Employee (Optional)" onChange={(e) => setSelectedUserId(e.target.value)}>
              <MenuItem value=""><em>All Employees</em></MenuItem>
              {users?.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name} ({u.employeeId})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Button fullWidth variant="contained" onClick={() => refetch()} disabled={isLoading} sx={{ height: '56px' }}>
            {isLoading ? <CircularProgress size={24} /> : 'Generate'}
          </Button>
        </Grid>
      </Grid>

      {usersError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={onRefetchUsers}>Retry</Button>}>
          Failed to load users. Employee filters may be incomplete.
        </Alert>
      )}

      {summary && (
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Summary</Typography>
          <Grid container spacing={2}>
            {[
              { label: 'Total Records', value: summary.total, color: 'primary', bg: isDark ? 'background.paper' : 'grey.100', filter: null },
              { label: 'Present', value: summary.present, color: 'success.main', bg: isDark ? 'rgba(34,197,94,0.1)' : 'success.50', filter: AttendanceStatus.PRESENT },
              { label: 'Absent', value: summary.absent, color: 'error.main', bg: isDark ? 'rgba(239,68,68,0.12)' : 'error.50', filter: AttendanceStatus.ABSENT },
              { label: 'Half Day', value: summary.halfDay, color: 'warning.main', bg: isDark ? 'rgba(251,191,36,0.12)' : 'warning.50', filter: AttendanceStatus.HALF_DAY },
              { label: 'Casual Leave', value: summary.casualLeave, color: 'info.main', bg: isDark ? 'rgba(59,130,246,0.12)' : 'info.50', filter: AttendanceStatus.CASUAL_LEAVE },
              { label: 'Weekend/Holiday', value: summary.weekend + summary.holiday, color: 'text.primary', bg: isDark ? 'background.paper' : 'grey.100', filter: 'WEEKEND_HOLIDAY' },
            ].map((s) => {
              const isActive = statusFilter === s.filter;
              return (
                <Grid key={s.label} size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper
                    elevation={isActive ? 3 : 0}
                    onClick={() => setStatusFilter(isActive ? null : s.filter as AttendanceStatus | 'WEEKEND_HOLIDAY' | null)}
                    sx={{
                      p: { xs: 1, sm: 2 }, textAlign: 'center', bgcolor: s.bg,
                      cursor: 'pointer',
                      border: isActive ? '2px solid' : '2px solid transparent',
                      borderColor: isActive ? s.color : 'transparent',
                      borderRadius: 2,
                      transition: 'all 0.15s',
                      '&:hover': { elevation: 2, transform: 'translateY(-2px)', boxShadow: 3 },
                    }}
                  >
                    <Typography
                      color={s.color}
                      sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' }, fontWeight: 700, lineHeight: 1.2 }}
                    >
                      {s.value}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>{s.label}</Typography>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {data && data.length > 0 ? (
        <Box>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            flexWrap="wrap"
            gap={1}
            mb={2}
          >
            <Typography variant="h6">
              Attendance Records ({filteredData?.length ?? 0}{statusFilter ? ` of ${data.length}` : ''})
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {isSuperAdmin && (
                <Button variant="contained" onClick={() => setCreateDialog((p) => ({ ...p, open: true }))}>
                  Add Manual Entry
                </Button>
              )}
              <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
                Export to Excel
              </Button>
            </Box>
          </Box>
          <ResponsiveTable
            rows={filteredData ?? []}
            rowKey={(r) => r.id}
            maxHeight={500}
            columns={[
              { header: 'Date', render: (r) => new Date(r.date).toLocaleDateString('en-IN') },
              {
                header: 'Employee',
                render: (r) => (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{r.user?.name ?? 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.user?.employeeId}</Typography>
                  </Box>
                ),
              },
              {
                header: 'Status',
                render: (r) => (
                  <Chip
                    label={r.status.replace('_', ' ')} size="small"
                    color={r.status === AttendanceStatus.PRESENT ? 'success' : r.status === AttendanceStatus.ABSENT ? 'error' : r.status === AttendanceStatus.HALF_DAY ? 'warning' : 'default'}
                  />
                ),
              },
              { header: 'First In', render: (r) => formatTime(r.firstInTime) },
              { header: 'Last Out', render: (r) => formatTime(r.lastOutTime) },
              { header: 'Duration (H:MM)', render: (r) => formatDuration(r.totalDuration) },
            ]}
            actions={
              isSuperAdmin
                ? (r) => (
                    <Button
                      size="small" variant="text"
                      onClick={() => setEditDialog({ open: true, record: r, newStatus: r.status as AttendanceStatus })}
                    >
                      Edit
                    </Button>
                  )
                : undefined
            }
          />
        </Box>
      ) : data?.length === 0 ? (
        <Alert severity="info">No attendance records found for the selected criteria</Alert>
      ) : null}

      {/* Edit attendance dialog */}
      <ResponsiveDialog
        open={editDialog.open}
        onClose={() => setEditDialog({ open: false, record: null, newStatus: '' })}
        maxWidth="xs" fullWidth
      >
        <DialogTitle>Edit Attendance</DialogTitle>
        <DialogContent>
          {editDialog.record && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {editDialog.record.user?.name} ({editDialog.record.user?.employeeId})
              </Typography>
              <Typography variant="body2" gutterBottom>
                Date: {new Date(editDialog.record.date).toLocaleDateString('en-IN')}
              </Typography>
              <FormControl fullWidth margin="normal">
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status" value={editDialog.newStatus}
                  onChange={(e) => setEditDialog((p) => ({ ...p, newStatus: e.target.value as AttendanceStatus }))}
                >
                  {Object.values(AttendanceStatus).map((s) => (
                    <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, record: null, newStatus: '' })}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!editDialog.record || !editDialog.newStatus || updateMutation.isPending}
            onClick={() => {
              if (!editDialog.record || !editDialog.newStatus) return;
              updateMutation.mutate({ id: editDialog.record.id, status: editDialog.newStatus });
            }}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      {/* Create manual attendance dialog */}
      <ResponsiveDialog
        open={createDialog.open}
        onClose={() => setCreateDialog((p) => ({ ...p, open: false }))}
        maxWidth="xs" fullWidth
      >
        <DialogTitle>Manual Attendance Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <FormControl fullWidth margin="normal" disabled={usersLoading}>
              <InputLabel>Employee</InputLabel>
              <Select
                label="Employee" value={createDialog.userId}
                onChange={(e) => setCreateDialog((p) => ({ ...p, userId: e.target.value }))}
              >
                {users?.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.name} ({u.employeeId})</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth margin="normal" label="Date" type="date"
              value={createDialog.date}
              onChange={(e) => setCreateDialog((p) => ({ ...p, date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status" value={createDialog.status}
                onChange={(e) => setCreateDialog((p) => ({ ...p, status: e.target.value as AttendanceStatus }))}
              >
                {Object.values(AttendanceStatus).map((s) => (
                  <MenuItem key={s} value={s}>{s.replace('_', ' ')}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog((p) => ({ ...p, open: false }))}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!createDialog.userId || !createDialog.date || !createDialog.status || createMutation.isPending}
            onClick={() => createMutation.mutate({ userId: createDialog.userId, date: createDialog.date, status: createDialog.status })}
          >
            {createMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default AttendanceReportTab;
