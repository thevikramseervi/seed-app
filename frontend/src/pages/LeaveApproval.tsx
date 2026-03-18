import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Typography,
  Badge,
} from '@mui/material';
import SectionCard from '../components/SectionCard';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { CheckCircle, Cancel, Replay } from '@mui/icons-material';
import { leaveApi } from '../api/leave';
import { LeaveApplication, LeaveStatus, LeaveType, Role } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import { canReviewLeave } from '../utils/leave';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';
import PageLoading from '../components/PageLoading';
import PageHeader from '../components/PageHeader';
import ResponsiveTable from '../components/ResponsiveTable';
import { useAuth } from '../contexts/AuthContext';

const ClAppliedBadge: React.FC<{ userId?: string; children: React.ReactNode }> = ({ userId, children }) => {
  const { data } = useQuery({
    queryKey: ['cl-usage', userId ?? ''],
    queryFn: () => leaveApi.getClUsage({ userId }),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
  const days = data?.appliedDays ?? 0;
  return (
    <Badge
      color="info"
      badgeContent={days}
      invisible={!userId || days <= 0}
      overlap="rectangular"
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      {children as any}
    </Badge>
  );
};

const LeaveApproval: React.FC = () => {
  const { showSuccess, showError } = useSnackbar();
  const { user: currentUser } = useAuth();
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    application: LeaveApplication | null;
    action: 'approve' | 'reject' | null;
  }>({ open: false, application: null, action: null });
  const [comments, setComments] = useState('');
  const queryClient = useQueryClient();

  const {
    data: pendingApplications,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.pendingLeaveApplications,
    queryFn: () => leaveApi.getPending(),
  });

  const { data: reviewedApplications, refetch: refetchReviewed } = useQuery({
    queryKey: [...QUERY_KEYS.pendingLeaveApplications, 'reviewed'],
    queryFn: () =>
      leaveApi.getReport().then((apps) =>
        apps.filter(
          (a) => a.status === LeaveStatus.APPROVED || a.status === LeaveStatus.REJECTED,
        ),
      ),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: string) => leaveApi.reopen(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingLeaveApplications });
      refetchReviewed();
      showSuccess('Leave application reopened for review.');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to reopen leave application'));
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      leaveApi.approve(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingLeaveApplications });
      handleCloseActionDialog();
      showSuccess('Leave approved successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to approve leave'));
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      leaveApi.reject(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pendingLeaveApplications });
      handleCloseActionDialog();
      showSuccess('Leave rejected successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to reject leave'));
    },
  });

  const handleOpenActionDialog = (
    application: LeaveApplication,
    action: 'approve' | 'reject'
  ) => {
    setActionDialog({ open: true, application, action });
    setComments('');
  };

  const handleCloseActionDialog = () => {
    setActionDialog({ open: false, application: null, action: null });
    setComments('');
  };

  const handleSubmitAction = () => {
    if (!actionDialog.application) return;

    if (!canReviewLeave(actionDialog.application.user?.role, currentUser?.role)) {
      showError('Only SUPER_ADMIN can approve or reject leave for LAB_ADMIN or SUPER_ADMIN users');
      return;
    }

    if (actionDialog.action === 'approve') {
      approveMutation.mutate({
        id: actionDialog.application.id,
        comments: comments || undefined,
      });
    } else if (actionDialog.action === 'reject') {
      if (!comments.trim()) {
        showError('Comments are required when rejecting a leave application');
        return;
      }
      rejectMutation.mutate({ id: actionDialog.application.id, comments });
    }
  };

  if (isLoading) return <PageLoading />;

  const canReview = (application: LeaveApplication) =>
    canReviewLeave(application.user?.role, currentUser?.role);

  return (
    <Box>
      <PageHeader
        title="Leave Approval"
        subtitle="Review and approve/reject leave applications"
      />

      {isError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        >
          {getApiErrorMessage(error, 'Failed to load leave applications. Please try again.')}
        </Alert>
      )}

      {!isError && (
      <SectionCard>
          {pendingApplications && pendingApplications.length > 0 ? (
            <ResponsiveTable
              rows={pendingApplications}
              rowKey={(app) => app.id}
              columns={[
                {
                  header: 'Type',
                  render: (app) => app.leaveType === LeaveType.UNPAID_LEAVE ? 'Unpaid' : 'Casual',
                },
                {
                  header: 'Employee',
                  render: (app) => (
                    <ClAppliedBadge userId={app.userId}>
                      <Box>
                        <Typography variant="body2" fontWeight="bold">{app.user?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {app.user?.designation}
                        </Typography>
                      </Box>
                    </ClAppliedBadge>
                  ),
                },
                {
                  header: 'Employee ID',
                  render: (app) => app.user?.employeeId ?? '—',
                  desktopOnly: true,
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
                {
                  header: 'Reason',
                  render: (app) => (
                    <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                      {app.reason}
                    </Typography>
                  ),
                },
                {
                  header: 'Applied On',
                  render: (app) => new Date(app.appliedAt).toLocaleDateString('en-IN'),
                },
              ]}
              actions={(application) => (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip
                    title={canReview(application) ? 'Approve' : 'Only SUPER_ADMIN can approve admin leave'}
                  >
                    <span>
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => canReview(application) && handleOpenActionDialog(application, 'approve')}
                        aria-label="Approve leave"
                        disabled={!canReview(application)}
                      >
                        <CheckCircle />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip
                    title={canReview(application) ? 'Reject' : 'Only SUPER_ADMIN can reject admin leave'}
                  >
                    <span>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => canReview(application) && handleOpenActionDialog(application, 'reject')}
                        aria-label="Reject leave"
                        disabled={!canReview(application)}
                      >
                        <Cancel />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              )}
            />
          ) : (
            <Alert severity="info">No pending leave applications</Alert>
          )}
      </SectionCard>
      )}

      {/* Reviewed Applications — Super Admin can reopen */}
      {currentUser?.role === Role.SUPER_ADMIN && (
        <SectionCard sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Reviewed Applications
          </Typography>
          {reviewedApplications && reviewedApplications.length > 0 ? (
            <ResponsiveTable
              rows={reviewedApplications}
              rowKey={(app) => app.id}
              columns={[
                {
                  header: 'Type',
                  render: (app) => app.leaveType === LeaveType.UNPAID_LEAVE ? 'Unpaid' : 'Casual',
                },
                {
                  header: 'Employee',
                  render: (app) => (
                    <Box>
                      <Typography variant="body2" fontWeight="bold">{app.user?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {app.user?.employeeId}
                      </Typography>
                    </Box>
                  ),
                },
                {
                  header: 'From',
                  render: (app) => new Date(app.fromDate).toLocaleDateString('en-IN'),
                },
                {
                  header: 'To',
                  render: (app) => new Date(app.toDate).toLocaleDateString('en-IN'),
                  desktopOnly: true,
                },
                { header: 'Days', render: (app) => app.totalDays },
                {
                  header: 'Status',
                  render: (app) => (
                    <Chip
                      label={app.status}
                      size="small"
                      color={app.status === LeaveStatus.APPROVED ? 'success' : 'error'}
                    />
                  ),
                },
                {
                  header: 'Reviewed By',
                  render: (app) => app.reviewer?.name ?? '—',
                  desktopOnly: true,
                },
              ]}
              actions={(application) => (
                <Tooltip title="Reopen for review">
                  <span>
                    <IconButton
                      size="small"
                      color="warning"
                      onClick={() => reopenMutation.mutate(application.id)}
                      aria-label="Reopen leave"
                      disabled={reopenMutation.isPending}
                    >
                      <Replay />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            />
          ) : (
            <Alert severity="info">No reviewed applications</Alert>
          )}
        </SectionCard>
      )}

      {/* Approve/Reject Dialog */}
      <ResponsiveDialog open={actionDialog.open} onClose={handleCloseActionDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {actionDialog.action === 'approve' ? 'Approve Leave' : 'Reject Leave'}
        </DialogTitle>
        <DialogContent>
          {actionDialog.application && (
            <Box>
              <Box
                mb={2}
                p={2}
                borderRadius={2}
                sx={(theme) => ({
                  bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.100',
                  color: theme.palette.mode === 'dark' ? 'text.primary' : 'inherit',
                  border: '1px solid',
                  borderColor: 'divider',
                })}
              >
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Employee:</strong> {actionDialog.application.user?.name}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Type:</strong>{' '}
                  {actionDialog.application.leaveType === LeaveType.UNPAID_LEAVE
                    ? 'Unpaid Leave (LOP)'
                    : 'Casual Leave (paid)'}
                </Typography>
                <Typography variant="body2" gutterBottom>
                  <strong>Duration:</strong>{' '}
                  {new Date(actionDialog.application.fromDate).toLocaleDateString('en-IN')} to{' '}
                  {new Date(actionDialog.application.toDate).toLocaleDateString('en-IN')} (
                  {actionDialog.application.totalDays} days)
                </Typography>
                <Typography variant="body2">
                  <strong>Reason:</strong> {actionDialog.application.reason}
                </Typography>
              </Box>

              <TextField
                label={actionDialog.action === 'reject' ? 'Comments (Required)' : 'Comments (Optional)'}
                multiline
                rows={4}
                fullWidth
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                margin="normal"
                required={actionDialog.action === 'reject'}
                helperText={
                  actionDialog.action === 'reject'
                    ? 'Please provide a reason for rejection'
                    : 'Optional comments for the employee'
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseActionDialog}>Cancel</Button>
          <Button
            onClick={handleSubmitAction}
            variant="contained"
            color={actionDialog.action === 'approve' ? 'success' : 'error'}
            disabled={approveMutation.isPending || rejectMutation.isPending}
          >
            {approveMutation.isPending || rejectMutation.isPending
              ? 'Processing...'
              : actionDialog.action === 'approve'
              ? 'Approve'
              : 'Reject'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default LeaveApproval;
