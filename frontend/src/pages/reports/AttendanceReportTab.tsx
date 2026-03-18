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
import { attendanceApi } from '../../api/attendance';
import { Attendance, AttendanceStatus, Role } from '../../types';
import type { User } from '../../types';
import { QUERY_KEYS } from '../../queryKeys';
import { formatTime, formatDuration } from '../../utils/format';
import { downloadExcel } from '../../utils/excel';
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

  const handleExport = () => {
    if (!data?.length) return;
    downloadExcel(
      `Attendance_Report_${startDate}_to_${endDate}.xlsx`,
      [
        { header: 'Employee ID', value: (r: AttendanceReportRow) => r.user?.employeeId ?? 'N/A' },
        { header: 'Employee Name', value: (r) => r.user?.name ?? 'N/A' },
        { header: 'Date', value: (r) => new Date(r.date).toLocaleDateString('en-IN') },
        { header: 'Status', value: (r) => r.status },
        { header: 'First In', value: (r) => (r.firstInTime ? formatTime(r.firstInTime) : '-') },
        { header: 'Last Out', value: (r) => (r.lastOutTime ? formatTime(r.lastOutTime) : '-') },
        { header: 'Duration (H:MM)', value: (r) => formatDuration(r.totalDuration) },
      ],
      data,
    );
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
              { label: 'Total Records', value: summary.total, color: 'primary', bg: isDark ? 'background.paper' : 'grey.100' },
              { label: 'Present', value: summary.present, color: 'success.main', bg: isDark ? 'rgba(34,197,94,0.1)' : 'success.50' },
              { label: 'Absent', value: summary.absent, color: 'error.main', bg: isDark ? 'rgba(239,68,68,0.12)' : 'error.50' },
              { label: 'Half Day', value: summary.halfDay, color: 'warning.main', bg: isDark ? 'rgba(251,191,36,0.12)' : 'warning.50' },
              { label: 'Casual Leave', value: summary.casualLeave, color: 'info.main', bg: isDark ? 'rgba(59,130,246,0.12)' : 'info.50' },
              { label: 'Weekend/Holiday', value: summary.weekend + summary.holiday, color: 'text.primary', bg: isDark ? 'background.paper' : 'grey.100' },
            ].map((s) => (
              <Grid key={s.label} size={{ xs: 6, sm: 4, md: 2 }}>
                <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, textAlign: 'center', bgcolor: s.bg }}>
                  <Typography
                    color={s.color}
                    sx={{ fontSize: { xs: '1.5rem', sm: '2.125rem' }, fontWeight: 700, lineHeight: 1.2 }}
                  >
                    {s.value}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.25 }}>{s.label}</Typography>
                </Paper>
              </Grid>
            ))}
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
            <Typography variant="h6">Attendance Records ({data.length})</Typography>
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
            rows={data}
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
