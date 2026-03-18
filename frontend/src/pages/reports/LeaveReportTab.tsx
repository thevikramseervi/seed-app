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
import { leaveApi } from '../../api/leave';
import { LeaveApplication, LeaveStatus, Role } from '../../types';
import type { User } from '../../types';
import { QUERY_KEYS } from '../../queryKeys';
import { downloadExcel } from '../../utils/excel';
import { canReviewLeave } from '../../utils/leave';
import ResponsiveDialog from '../../components/ResponsiveDialog';
import ResponsiveTable from '../../components/ResponsiveTable';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { getApiErrorMessage } from '../../hooks/apiMessages';

interface LeaveReportTabProps {
  users: User[] | undefined;
  usersLoading: boolean;
}

const LeaveReportTab: React.FC<LeaveReportTabProps> = ({ users, usersLoading }) => {
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

  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    application: LeaveApplication | null;
    action: 'approve' | 'reject' | null;
  }>({ open: false, application: null, action: null });
  const [comments, setComments] = useState('');

  const { data, isLoading, refetch } = useQuery<LeaveApplication[]>({
    queryKey: QUERY_KEYS.leaveReport(selectedUserId, startDate, endDate),
    queryFn: () => leaveApi.getReport({ userId: selectedUserId || undefined, fromDate: startDate, toDate: endDate }),
    enabled: false,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, c }: { id: string; c?: string }) => leaveApi.approve(id, c),
    onSuccess: () => {
      setActionDialog({ open: false, application: null, action: null });
      setComments('');
      showSuccess('Leave approved successfully');
      refetch();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveBalance });
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to approve leave'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, c }: { id: string; c: string }) => leaveApi.reject(id, c),
    onSuccess: () => {
      setActionDialog({ open: false, application: null, action: null });
      setComments('');
      showSuccess('Leave rejected');
      refetch();
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveBalance });
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to reject leave'));
    },
  });

  const summary = React.useMemo(() => {
    if (!data) return null;
    const s = { total: data.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    data.forEach((l) => {
      if (l.status === LeaveStatus.PENDING) s.pending++;
      else if (l.status === LeaveStatus.APPROVED) s.approved++;
      else if (l.status === LeaveStatus.REJECTED) s.rejected++;
      else if (l.status === LeaveStatus.CANCELLED) s.cancelled++;
    });
    return s;
  }, [data]);

  const handleExport = () => {
    if (!data?.length) return;
    downloadExcel(
      `Leave_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
      [
        { header: 'Employee ID', value: (l: LeaveApplication) => l.user?.employeeId ?? 'N/A' },
        { header: 'Employee Name', value: (l) => l.user?.name ?? 'N/A' },
        { header: 'From Date', value: (l) => new Date(l.fromDate).toLocaleDateString('en-IN') },
        { header: 'To Date', value: (l) => new Date(l.toDate).toLocaleDateString('en-IN') },
        { header: 'Total Days', value: (l) => l.totalDays },
        { header: 'Reason', value: (l) => l.reason },
        { header: 'Status', value: (l) => l.status },
        { header: 'Applied On', value: (l) => new Date(l.appliedAt).toLocaleString('en-IN') },
        { header: 'Reviewed On', value: (l) => l.reviewedAt ? new Date(l.reviewedAt).toLocaleString('en-IN') : '-' },
        { header: 'Comments', value: (l) => l.reviewNotes ?? '' },
      ],
      data,
    );
  };

  const isAdmin =
    authUser?.role === Role.LAB_ADMIN || authUser?.role === Role.SUPER_ADMIN;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField fullWidth label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <TextField fullWidth label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <FormControl fullWidth disabled={usersLoading}>
            <InputLabel>Employee (Optional)</InputLabel>
            <Select value={selectedUserId} label="Employee (Optional)" onChange={(e) => setSelectedUserId(e.target.value)}>
              <MenuItem value=""><em>All Employees</em></MenuItem>
              {users?.map((u) => <MenuItem key={u.id} value={u.id}>{u.name} ({u.employeeId})</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 2 }}>
          <Button fullWidth variant="contained" onClick={() => refetch()} disabled={isLoading} sx={{ height: '56px' }}>
            {isLoading ? <CircularProgress size={24} /> : 'Generate'}
          </Button>
        </Grid>
      </Grid>

      {summary && (
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>Summary</Typography>
          <Grid container spacing={2}>
            {[
              { label: 'Total Applications', value: summary.total, color: 'primary', bg: isDark ? 'background.paper' : 'grey.100' },
              { label: 'Pending', value: summary.pending, color: 'warning.main', bg: isDark ? 'rgba(251,191,36,0.12)' : 'warning.50' },
              { label: 'Approved', value: summary.approved, color: 'success.main', bg: isDark ? 'rgba(34,197,94,0.1)' : 'success.50' },
              { label: 'Rejected', value: summary.rejected, color: 'error.main', bg: isDark ? 'rgba(239,68,68,0.12)' : 'error.50' },
              { label: 'Cancelled', value: summary.cancelled, color: 'text.primary', bg: isDark ? 'background.paper' : 'grey.100' },
            ].map((s) => (
              <Grid key={s.label} size={{ xs: 6, md: 2.4 }}>
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
            <Typography variant="h6">Leave Applications ({data.length})</Typography>
            <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
              Export to Excel
            </Button>
          </Box>
          <ResponsiveTable
            rows={data}
            rowKey={(l) => l.id}
            maxHeight={500}
            columns={[
              {
                header: 'Employee',
                render: (l) => (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{l.user?.name ?? 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary">{l.user?.employeeId}</Typography>
                  </Box>
                ),
              },
              { header: 'From Date', render: (l) => new Date(l.fromDate).toLocaleDateString('en-IN'), mobileLabel: 'From – To' },
              { header: 'To Date', render: (l) => new Date(l.toDate).toLocaleDateString('en-IN'), desktopOnly: true },
              { header: 'Days', render: (l) => l.totalDays },
              { header: 'Reason', render: (l) => l.reason },
              {
                header: 'Status',
                render: (l) => (
                  <Chip
                    label={l.status} size="small"
                    color={l.status === LeaveStatus.APPROVED ? 'success' : l.status === LeaveStatus.REJECTED ? 'error' : l.status === LeaveStatus.PENDING ? 'warning' : 'default'}
                  />
                ),
              },
              { header: 'Applied On', render: (l) => new Date(l.appliedAt).toLocaleDateString('en-IN') },
            ]}
            actions={
              isAdmin
                ? (l) =>
                    l.status === LeaveStatus.PENDING ? (
                      <Box display="flex" gap={1}>
                        <Button
                          size="small" variant="text"
                          disabled={!canReviewLeave(l.user?.role, authUser?.role)}
                          onClick={() =>
                            canReviewLeave(l.user?.role, authUser?.role) &&
                            setActionDialog({ open: true, application: l, action: 'approve' })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="small" color="error" variant="text"
                          disabled={!canReviewLeave(l.user?.role, authUser?.role)}
                          onClick={() =>
                            canReviewLeave(l.user?.role, authUser?.role) &&
                            setActionDialog({ open: true, application: l, action: 'reject' })
                          }
                        >
                          Reject
                        </Button>
                      </Box>
                    ) : '—'
                : undefined
            }
          />
        </Box>
      ) : data?.length === 0 ? (
        <Alert severity="info">No leave applications found</Alert>
      ) : null}

      {/* Approve/Reject dialog */}
      <ResponsiveDialog
        open={actionDialog.open}
        onClose={() => { setActionDialog({ open: false, application: null, action: null }); setComments(''); }}
        maxWidth="sm" fullWidth
      >
        <DialogTitle>{actionDialog.action === 'approve' ? 'Approve Leave' : 'Reject Leave'}</DialogTitle>
        <DialogContent>
          {actionDialog.application && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Employee:</strong> {actionDialog.application.user?.name} ({actionDialog.application.user?.employeeId})
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Duration:</strong>{' '}
                {new Date(actionDialog.application.fromDate).toLocaleDateString('en-IN')} to{' '}
                {new Date(actionDialog.application.toDate).toLocaleDateString('en-IN')} ({actionDialog.application.totalDays} days)
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Reason:</strong> {actionDialog.application.reason}
              </Typography>
              <TextField
                fullWidth margin="normal"
                label={actionDialog.action === 'reject' ? 'Comments (required)' : 'Comments (optional)'}
                multiline rows={3} value={comments}
                onChange={(e) => setComments(e.target.value)}
                required={actionDialog.action === 'reject'}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setActionDialog({ open: false, application: null, action: null }); setComments(''); }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={actionDialog.action === 'approve' ? 'success' : 'error'}
            disabled={
              !actionDialog.application ||
              (!comments.trim() && actionDialog.action === 'reject') ||
              approveMutation.isPending || rejectMutation.isPending
            }
            onClick={() => {
              if (!actionDialog.application || !actionDialog.action) return;
              if (actionDialog.action === 'approve') {
                approveMutation.mutate({ id: actionDialog.application.id, c: comments.trim() || undefined });
              } else {
                rejectMutation.mutate({ id: actionDialog.application.id, c: comments.trim() });
              }
            }}
          >
            {approveMutation.isPending || rejectMutation.isPending
              ? 'Processing...'
              : actionDialog.action === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default LeaveReportTab;
