import React from 'react';
import { Box, Card, CardContent, Typography, Divider, Alert } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { authApi, type MeResponse } from '../api/auth';
import { Role } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import AdminSecurity2faCard from '../components/admin/AdminSecurity2faCard';
import { useSnackbar } from '../contexts/SnackbarContext';
import PageLoading from '../components/PageLoading';
import PageHeader from '../components/PageHeader';

const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
};

const Profile: React.FC = () => {
  const { showSuccess, showError } = useSnackbar();
  const { data: me, isLoading, error } = useQuery<MeResponse>({
    queryKey: QUERY_KEYS.me,
    queryFn: authApi.me,
  });

  if (isLoading) return <PageLoading />;

  if (error || !me) {
    return (
      <Box>
        <Alert severity="error">Unable to load profile. Please try signing in again.</Alert>
      </Box>
    );
  }

  const employmentStatus = me.status ?? 'ACTIVE';

  return (
    <Box>
      <PageHeader
        title="My Profile"
        subtitle="Your account and employment details."
      />

      <Box
        sx={{
          maxWidth: 720,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Card
          elevation={2}
          sx={{
            borderRadius: 3,
            overflow: 'hidden',
          }}
        >
          <CardContent
            sx={{
              p: { xs: 2, sm: 3 },
            }}
          >
          {/* Personal information block, styled similar to SalarySlipView employee details */}
          <Box
            sx={{
              mb: 2.5,
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: { xs: 1.5, sm: 2 },
                py: 1,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.100',
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}
              >
                PERSONAL INFORMATION
              </Typography>
            </Box>
            <Box
              sx={{
                px: { xs: 1.5, sm: 2 },
                py: 1.5,
                fontSize: '0.95rem',
              }}
            >
              {/* Mobile: stacked rows like SalarySlipView */}
              <Box
                sx={{
                  display: { xs: 'block', sm: 'none' },
                  '& > div': {
                    py: 0.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                  '& > div:last-of-type': {
                    borderBottom: 'none',
                  },
                }}
              >
                {[
                  ['Full Name', me.name],
                  ['Email', me.email],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 500, wordBreak: 'break-word', textAlign: 'right' }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Desktop: label/value grid */}
              <Box
                sx={{
                  display: { xs: 'none', sm: 'grid' },
                  gridTemplateColumns: '180px 1fr',
                  rowGap: 1,
                  columnGap: 3,
                  '& > *:nth-of-type(odd)': { color: 'text.secondary' },
                  '& > *:nth-of-type(even)': { fontWeight: 500 },
                }}
              >
                <Typography variant="body2">Full Name</Typography>
                <Typography variant="body1">{me.name}</Typography>

                <Typography variant="body2">Email</Typography>
                <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>
                  {me.email}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Employment details block, mirroring SalarySlipView's grid style */}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: { xs: 1.5, sm: 2 },
                py: 1,
                bgcolor: (theme) =>
                  theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'grey.100',
              }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}
              >
                EMPLOYMENT DETAILS
              </Typography>
            </Box>
            <Box
              sx={{
                px: { xs: 1.5, sm: 2 },
                py: 1.5,
                fontSize: '0.95rem',
              }}
            >
              {/* Mobile: stacked rows like SalarySlipView */}
              <Box
                sx={{
                  display: { xs: 'block', sm: 'none' },
                  '& > div': {
                    py: 0.75,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  },
                  '& > div:last-of-type': {
                    borderBottom: 'none',
                  },
                }}
              >
                {[
                  ['Employee ID', me.employeeId],
                  ['Employee Number', me.employeeNumber !== undefined ? me.employeeNumber : '—'],
                  ['Role', me.role.replace('_', ' ')],
                  ['Designation', me.designation],
                  ['Date of Joining', formatDate(me.dateOfJoining)],
                  ['Employment Status', employmentStatus],
                  [
                    'Base Salary',
                    me.baseSalary !== undefined
                      ? `₹${Number(me.baseSalary).toLocaleString()}`
                      : '—',
                  ],
                ].map(([label, value]) => (
                  <Box
                    key={label}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 1,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {label}
                    </Typography>
                    <Typography
                      variant="body1"
                      sx={{ fontWeight: 500, wordBreak: 'break-word', textAlign: 'right' }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Desktop: label/value grid */}
              <Box
                sx={{
                  display: { xs: 'none', sm: 'grid' },
                  gridTemplateColumns: '180px 1fr',
                  rowGap: 1,
                  columnGap: 3,
                  '& > *:nth-of-type(odd)': { color: 'text.secondary' },
                  '& > *:nth-of-type(even)': { fontWeight: 500 },
                }}
              >
                <Typography variant="body2">Employee ID</Typography>
                <Typography variant="body1">{me.employeeId}</Typography>

                <Typography variant="body2">Employee Number</Typography>
                <Typography variant="body1">
                  {me.employeeNumber !== undefined ? me.employeeNumber : '—'}
                </Typography>

                <Typography variant="body2">Role</Typography>
                <Typography variant="body1">{me.role.replace('_', ' ')}</Typography>

                <Typography variant="body2">Designation</Typography>
                <Typography variant="body1">{me.designation}</Typography>

                <Typography variant="body2">Date of Joining</Typography>
                <Typography variant="body1">{formatDate(me.dateOfJoining)}</Typography>

                <Typography variant="body2">Employment Status</Typography>
                <Typography variant="body1">{employmentStatus}</Typography>

                <Typography variant="body2">Base Salary</Typography>
                <Typography variant="body1">
                  {me.baseSalary !== undefined
                    ? `₹${Number(me.baseSalary).toLocaleString()}`
                    : '—'}
                </Typography>
              </Box>
            </Box>
          </Box>
          </CardContent>
        </Card>

        {(me.role === Role.LAB_ADMIN || me.role === Role.SUPER_ADMIN) && (
          <AdminSecurity2faCard
            onMessage={(message, severity) =>
              severity === 'success' ? showSuccess(message) : showError(message)
            }
          />
        )}
      </Box>
    </Box>
  );
};

export default Profile;

