import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, Card, CardContent, Typography, Box, CircularProgress, Alert, Paper, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  CheckCircle,
  Cancel,
  Timelapse,
  BeachAccess,
} from '@mui/icons-material';
import { attendanceApi } from '../api/attendance';
import { leaveApi } from '../api/leave';
import { announcementsApi } from '../api/announcements';
import { useAuth } from '../contexts/AuthContext';
import { QUERY_KEYS } from '../queryKeys';
import PageHeader from '../components/PageHeader';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const { data: dashboardStats, isLoading: statsLoading, isError: statsError, failureCount: statsFailures } = useQuery({
    queryKey: QUERY_KEYS.attendanceDashboard,
    queryFn: () => attendanceApi.getDashboard(),
  });

  const { data: leaveBalance, isLoading: leaveLoading, isError: leaveError, failureCount: leaveFailures } = useQuery({
    queryKey: QUERY_KEYS.leaveBalance,
    queryFn: () => leaveApi.getBalance(),
  });

  const { data: announcements, isLoading: announcementsLoading, isError: announcementsError, failureCount: announcementsFailures } = useQuery({
    queryKey: QUERY_KEYS.announcements,
    queryFn: () => announcementsApi.getAll(),
  });

  const isRetrying = (statsLoading && statsFailures > 0) || (leaveLoading && leaveFailures > 0) || (announcementsLoading && announcementsFailures > 0);

  if (statsLoading || leaveLoading || announcementsLoading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2}>
        <CircularProgress sx={{ color: 'primary.main' }} />
        {isRetrying && (
          <Alert severity="info" sx={{ maxWidth: 420 }}>
            Server is warming up — this can take up to 60 seconds on first load. Please wait…
          </Alert>
        )}
      </Box>
    );
  }

  if (statsError || leaveError || announcementsError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load dashboard data. The server may be unavailable — please refresh the page or try again in a moment.
      </Alert>
    );
  }

  const statCards = [
    {
      title: 'Present Days',
      value: dashboardStats?.presentDays || 0,
      icon: <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />,
      color: 'success.light',
    },
    {
      title: 'Absent Days',
      value: dashboardStats?.absentDays || 0,
      icon: <Cancel sx={{ fontSize: 40, color: 'error.main' }} />,
      color: 'error.light',
    },
    {
      title: 'Half Days',
      value: dashboardStats?.halfDays || 0,
      icon: <Timelapse sx={{ fontSize: 40, color: 'warning.main' }} />,
      color: 'warning.light',
    },
    {
      title: 'Casual Leaves',
      value: dashboardStats?.casualLeaves || 0,
      icon: <BeachAccess sx={{ fontSize: 40, color: 'info.main' }} />,
      color: 'info.light',
    },
  ];

  return (
    <Box>
      <PageHeader
        title={user ? `Welcome back, ${user.name}!` : 'Dashboard'}
        subtitle="Here’s an overview of your attendance and updates for this month."
      />
      <Grid container spacing={3}>
        {statCards.map((card, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Card
              elevation={0}
              sx={{
                border: 1,
                borderColor: 'divider',
                transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 20px rgb(0 0 0 / 0.08)',
                  borderColor: 'primary.light',
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                >
                  <Box>
                    <Typography
                      color="text.secondary"
                      variant="body2"
                      fontWeight={600}
                      gutterBottom
                    >
                      {card.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={700}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: card.color,
                      p: 1.5,
                      borderRadius: 2,
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Leave Balance
              </Typography>
              <Box mt={2}>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Total Leaves
                  </Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {leaveBalance?.totalLeaves ?? 0}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Used
                  </Typography>
                  <Typography variant="body2" color="error.main" fontWeight={600}>
                    {leaveBalance?.usedLeaves ?? 0}
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" mb={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                  <Typography variant="body2" color="warning.main" fontWeight={600}>
                    {leaveBalance?.pendingLeaves ?? 0}
                  </Typography>
                </Box>
                <Box
                  display="flex"
                  justifyContent="space-between"
                  sx={{
                    pt: 1.5,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    Available
                  </Typography>
                  <Typography variant="body2" color="success.main" fontWeight={700}>
                    {leaveBalance?.availableLeaves ?? 0}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card
            elevation={0}
            sx={{
              border: 1,
              borderColor: 'divider',
              height: '100%',
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Recent Announcements
              </Typography>
              <Box mt={2}>
                {announcements && announcements.length > 0 ? (
                  announcements.slice(0, 5).map((announcement) => (
                    <Paper
                      key={announcement.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 1.5,
                        borderRadius: 2,
                        bgcolor: (theme) =>
                          announcement.isRead
                            ? theme.palette.action.selected
                            : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08),
                        border: 1,
                        borderColor: announcement.isRead ? 'divider' : 'primary.200',
                      }}
                    >
                      <Box display="flex" alignItems="center" mb={0.5}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          sx={{ flexGrow: 1 }}
                        >
                          {announcement.title}
                        </Typography>
                        <Chip
                          label={announcement.priority}
                          size="small"
                          color={
                            announcement.priority === 'URGENT' || announcement.priority === 'HIGH'
                              ? 'error'
                              : announcement.priority === 'MEDIUM'
                                ? 'warning'
                                : 'default'
                          }
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        {announcement.content}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        mt={1}
                      >
                        By {announcement.creator?.name ?? 'Unknown'} •{' '}
                        {new Date(announcement.createdAt).toLocaleDateString()}
                      </Typography>
                    </Paper>
                  ))
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    No announcements available
                  </Alert>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
