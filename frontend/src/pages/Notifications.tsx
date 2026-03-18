import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import SectionCard from '../components/SectionCard';
import { notificationsApi } from '../api/notifications';
import { QUERY_KEYS } from '../queryKeys';
import PageLoading from '../components/PageLoading';
import PageHeader from '../components/PageHeader';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';

const Notifications: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { showError } = useSnackbar();

  const {
    data: notifications,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: notificationsApi.getAll,
    staleTime: 60_000,
  });

  const markAllMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationsUnreadCount });
    },
    onError: (err: unknown) => {
      showError(getApiErrorMessage(err, 'Failed to mark all as read'));
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationsUnreadCount });
    },
    onError: (err: unknown) => {
      showError(getApiErrorMessage(err, 'Failed to mark notification as read'));
    },
  });

  if (isLoading) return <PageLoading />;

  const hasUnread = (notifications || []).some((n) => !n.readAt);
  const markOnePending = markOneMutation.isPending;

  return (
    <Box>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your leave requests and other actions."
        actions={
          <Button
            variant="outlined"
            disabled={!hasUnread || markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            {markAllMutation.isPending ? 'Marking...' : 'Mark all as read'}
          </Button>
        }
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
          {getApiErrorMessage(error, 'Failed to load notifications. Please try again.')}
        </Alert>
      )}

      {!isError && notifications && notifications.length > 0 ? (
        notifications.map((notification) => {
          const isUnread = !notification.readAt;
          return (
            <Card
              key={notification.id}
              elevation={2}
              sx={{ mb: 2, opacity: isUnread ? 1 : 0.7 }}
              component="article"
              aria-label={`Notification: ${notification.title}`}
            >
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" fontWeight={isUnread ? 'bold' : 'normal'}>
                    {notification.title}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    {isUnread && <Chip label="New" color="primary" size="small" />}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(notification.createdAt).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  {notification.body}
                </Typography>
                {notification.type === 'LEAVE_REQUEST' && (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={markOnePending}
                    onClick={() => {
                      if (!notification.readAt) {
                        markOneMutation.mutate(notification.id);
                      }
                      navigate('/leave-approval');
                    }}
                  >
                    Review leave requests
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })
      ) : !isError ? (
        <SectionCard>
          <Alert severity="info">You have no notifications yet.</Alert>
        </SectionCard>
      ) : null}
    </Box>
  );
};

export default Notifications;
