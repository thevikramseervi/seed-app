import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Typography,
  Badge,
  Card,
  CardContent,
  LinearProgress,
} from '@mui/material';
import SectionCard from '../components/SectionCard';
import { Add, Cancel as CancelIcon } from '@mui/icons-material';
import { leaveApi } from '../api/leave';
import { holidaysApi } from '../api/holidays';
import { LeaveStatus, LeaveType } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import PageHeader from '../components/PageHeader';
import ResponsiveDialog from '../components/ResponsiveDialog';
import ResponsiveTable from '../components/ResponsiveTable';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';
import PageLoading from '../components/PageLoading';

const Leave: React.FC = () => {
  const { showSuccess, showError } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>(LeaveType.CASUAL_LEAVE);
  const queryClient = useQueryClient();

  const {
    data: applications,
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEYS.myLeaveApplications,
    queryFn: () => leaveApi.getMyApplications(),
  });

  const { data: balance } = useQuery({
    queryKey: QUERY_KEYS.leaveBalance,
    queryFn: () => leaveApi.getBalance(),
  });

  // Derive the year(s) touched by the selected range for holiday lookup
  const fromYear = fromDate ? new Date(fromDate).getUTCFullYear() : new Date().getUTCFullYear();
  const toYear   = toDate   ? new Date(toDate).getUTCFullYear()   : fromYear;

  const { data: holidays } = useQuery({
    queryKey: QUERY_KEYS.holidays,
    queryFn: () => holidaysApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  // Build a Set of holiday date strings (YYYY-MM-DD) covering the selected years
  const holidaySet = useMemo(() => {
    const set = new Set<string>();
    (holidays ?? []).forEach((h) => {
      const y = new Date(h.date).getUTCFullYear();
      if (y >= fromYear && y <= toYear) {
        set.add(h.date.slice(0, 10));
      }
    });
    return set;
  }, [holidays, fromYear, toYear]);

  // Count working days in the selected range (excluding weekends and public holidays)
  const leaveSummary = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const from = new Date(fromDate);
    const to   = new Date(toDate);
    if (from > to) return null;
    let working = 0, weekendCount = 0, holidayCount = 0;
    const cur = new Date(from);
    while (cur <= to) {
      const dow = cur.getUTCDay();
      const key = cur.toISOString().slice(0, 10);
      if (dow === 0 || dow === 6) {
        weekendCount++;
      } else if (holidaySet.has(key)) {
        holidayCount++;
      } else {
        working++;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return { working, weekendCount, holidayCount };
  }, [fromDate, toDate, holidaySet]);

  const applyMutation = useMutation({
    mutationFn: leaveApi.apply,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myLeaveApplications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveBalance });
      setOpen(false);
      setFromDate('');
      setToDate('');
      setReason('');
      setLeaveType(LeaveType.CASUAL_LEAVE);
      showSuccess('Leave application submitted successfully.');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to apply for leave. Please try again.'));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myLeaveApplications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leaveBalance });
      showSuccess('Leave application cancelled.');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to cancel leave. Please try again.'));
    },
  });

  const handleSubmit = () => {
    if (!reason?.trim()) {
      showError('Please provide a reason for leave.');
      return;
    }
    applyMutation.mutate({ fromDate, toDate, reason, leaveType });
  };

  const getStatusColor = (
    status: LeaveStatus,
  ): 'default' | 'error' | 'warning' | 'primary' | 'info' | 'success' => {
    switch (status) {
      case LeaveStatus.APPROVED:
        return 'success';
      case LeaveStatus.REJECTED:
        return 'error';
      case LeaveStatus.PENDING:
        return 'warning';
      case LeaveStatus.CANCELLED:
        return 'default';
      default:
        return 'default';
    }
  };

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">
          Failed to load leave applications. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Leave Management"
        subtitle={`Available Leaves: ${balance?.availableLeaves ?? 0} / ${balance?.totalLeaves ?? 12}`}
        actions={
          (() => {
            const now = new Date();
            const nowYear = now.getUTCFullYear();
            const nowMonth = now.getUTCMonth(); // 0-based
            const clAppliedDays =
              (applications ?? [])
                .filter((a) => a.leaveType === LeaveType.CASUAL_LEAVE)
                .filter((a) => a.status === LeaveStatus.PENDING || a.status === LeaveStatus.APPROVED)
                .filter((a) => {
                  const d = new Date(a.fromDate);
                  return d.getUTCFullYear() === nowYear && d.getUTCMonth() <= nowMonth;
                })
                .reduce((sum, a) => sum + (a.totalDays ?? 0), 0) ?? 0;

            return (
              <Badge
                color="info"
                badgeContent={clAppliedDays}
                invisible={clAppliedDays <= 0}
                overlap="rectangular"
                anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setOpen(true)}
                >
                  Apply Leave
                </Button>
              </Badge>
            );
          })()
        }
      />

      {(() => {
        const total = balance?.totalLeaves ?? 12;
        const used = balance?.usedLeaves ?? 0;
        const pending = balance?.pendingLeaves ?? 0;
        const available = balance?.availableLeaves ?? 0;
        const usagePct = total > 0 ? Math.min(100, Math.max(0, ((used + pending) / total) * 100)) : 0;

        const stats = [
          { label: 'Total Leaves', value: total, color: '#64748B' },
          { label: 'Used', value: used, color: '#F59E0B' },
          { label: 'Pending', value: pending, color: '#F97316' },
          { label: 'Available', value: available, color: '#22C55E' },
        ];

        return (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 2,
              mt: 2,
              mb: 3,
            }}
          >
            {stats.map((s) => (
              <Card
                key={s.label}
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  borderLeft: 4,
                  borderLeftColor: s.color,
                  overflow: 'hidden',
                }}
              >
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Typography variant="h5" fontWeight={700} sx={{ color: s.color }}>
                    {s.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {s.label}
                  </Typography>
                </CardContent>
              </Card>
            ))}

            <Box sx={{ gridColumn: '1 / -1' }}>
              <Card elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <CardContent sx={{ py: 1.5, px: 2.5, '&:last-child': { pb: 1.5 } }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                    <Typography
                      variant="caption"
                      sx={{ letterSpacing: 0.8, fontWeight: 700, color: 'text.secondary' }}
                    >
                      USAGE
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">
                      {usagePct.toFixed(1)}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={usagePct}
                    sx={{
                      height: 8,
                      borderRadius: 99,
                      bgcolor: (theme) =>
                        theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.25)' : 'rgba(148,163,184,0.35)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 99,
                        backgroundColor: '#22C55E',
                      },
                    }}
                  />
                </CardContent>
              </Card>
            </Box>
          </Box>
        );
      })()}

      <SectionCard title="My Leave Applications">
          {applications && applications.length > 0 ? (
            <ResponsiveTable
              rows={applications}
              rowKey={(app) => app.id}
              columns={[
                {
                  header: 'Type',
                  render: (app) => app.leaveType === LeaveType.UNPAID_LEAVE ? 'Unpaid' : 'Casual',
                },
                {
                  header: 'From Date',
                  render: (app) => new Date(app.fromDate).toLocaleDateString('en-IN'),
                  mobileLabel: 'From – To',
                },
                {
                  header: 'To Date',
                  render: (app) => new Date(app.toDate).toLocaleDateString('en-IN'),
                  desktopOnly: true,
                },
                { header: 'Days', render: (app) => app.totalDays },
                { header: 'Reason', render: (app) => app.reason },
                {
                  header: 'Status',
                  render: (app) => (
                    <Chip label={app.status} color={getStatusColor(app.status)} size="small" />
                  ),
                },
                {
                  header: 'Applied On',
                  render: (app) => new Date(app.appliedAt).toLocaleString('en-IN'),
                },
                {
                  header: 'Reviewed On',
                  render: (app) =>
                    app.reviewedAt
                      ? new Date(app.reviewedAt).toLocaleString('en-IN')
                      : app.status === LeaveStatus.PENDING ? 'Pending' : '—',
                },
                {
                  header: 'Admin Comments',
                  render: (app) =>
                    app.reviewNotes
                      ? app.reviewNotes
                      : app.status === LeaveStatus.PENDING ? '—' : 'No comments',
                  desktopOnly: true,
                },
              ]}
              actions={(app) =>
                app.status === LeaveStatus.PENDING ? (
                  <Tooltip title="Cancel application">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => cancelMutation.mutate(app.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ) : null
              }
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No leave applications found
            </Typography>
          )}
      </SectionCard>

      {/* Apply Leave Dialog */}
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply for Leave</DialogTitle>
        <DialogContent>
          <Box display="flex" gap={2} mt={1}>
            <TextField
              label="Leave Type"
              select
              fullWidth
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              SelectProps={{ native: true }}
            >
              <option value={LeaveType.CASUAL_LEAVE}>Casual Leave (paid)</option>
              <option value={LeaveType.UNPAID_LEAVE}>Unpaid Leave (LOP)</option>
            </TextField>
          </Box>
          <Box display="flex" gap={2} alignItems="flex-start">
            <TextField
              label="From Date"
              type="date"
              fullWidth
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To Date"
              type="date"
              fullWidth
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              margin="normal"
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Live working-days feedback */}
          {fromDate && toDate && (
            fromDate > toDate ? (
              <Alert severity="error" sx={{ mt: 1 }}>
                "To Date" must be on or after "From Date".
              </Alert>
            ) : leaveSummary?.working === 0 ? (
              <Alert severity="warning" sx={{ mt: 1 }}>
                The selected range falls entirely on weekends or public holidays — no working days to deduct.
              </Alert>
            ) : leaveSummary ? (
              <Alert severity="info" sx={{ mt: 1 }}>
                <strong>{leaveSummary.working} working day{leaveSummary.working !== 1 ? 's' : ''}</strong> will be deducted
                {(leaveSummary.weekendCount > 0 || leaveSummary.holidayCount > 0) && (
                  <>
                    {' '}(excluding{' '}
                    {leaveSummary.weekendCount > 0 && (
                      <>{leaveSummary.weekendCount} weekend day{leaveSummary.weekendCount !== 1 ? 's' : ''}</>
                    )}
                    {leaveSummary.weekendCount > 0 && leaveSummary.holidayCount > 0 && ' + '}
                    {leaveSummary.holidayCount > 0 && (
                      <>{leaveSummary.holidayCount} public holiday{leaveSummary.holidayCount !== 1 ? 's' : ''}</>
                    )}
                    )
                  </>
                )}.
              </Alert>
            ) : null
          )}

          <TextField
            label="Reason"
            multiline
            rows={3}
            fullWidth
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={
              applyMutation.isPending ||
              !fromDate ||
              !toDate ||
              !reason?.trim() ||
              fromDate > toDate ||
              leaveSummary?.working === 0
            }
          >
            {applyMutation.isPending ? 'Submitting...' : 'Submit'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default Leave;
