import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
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
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from '@mui/material';
import { CheckCircle, Download } from '@mui/icons-material';
import { payrollApi } from '../../api/payroll';
import { Payroll, PaymentStatus, Role } from '../../types';
import type { User } from '../../types';
import { QUERY_KEYS } from '../../queryKeys';
import { MONTHS } from '../../utils/slipUtils';
import { downloadExcel } from '../../utils/excel';
import ResponsiveDialog from '../../components/ResponsiveDialog';
import ResponsiveTable from '../../components/ResponsiveTable';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { getApiErrorMessage } from '../../hooks/apiMessages';

interface PayrollReportTabProps {
  users: User[] | undefined;
  usersLoading: boolean;
}

const PayrollReportTab: React.FC<PayrollReportTabProps> = ({ users, usersLoading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { user: authUser } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const [payrollYear, setPayrollYear] = useState(currentYear);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [markPaidDialog, setMarkPaidDialog] = useState<{
    open: boolean;
    payroll: Payroll | null;
  }>({ open: false, payroll: null });

  const { data, isLoading, refetch } = useQuery<Payroll[]>({
    queryKey: QUERY_KEYS.payrollReport(payrollYear, payrollMonth, selectedUserId),
    queryFn: () =>
      payrollApi.getAll({ year: payrollYear, month: payrollMonth, userId: selectedUserId || undefined }),
    enabled: false,
  });

  const markAsPaidMutation = useMutation({
    mutationFn: (id: string) => payrollApi.markAsPaid(id),
    onSuccess: () => {
      setMarkPaidDialog({ open: false, payroll: null });
      showSuccess('Payroll marked as paid');
      refetch();
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to mark payroll as paid'));
    },
  });

  const summary = React.useMemo(() => {
    if (!data) return null;
    const s = { total: data.length, totalGross: 0, totalNet: 0, paid: 0, pending: 0, draft: 0 };
    data.forEach((p) => {
      s.totalGross += Number(p.grossEarnings);
      s.totalNet += Number(p.netSalary);
      if (p.paymentStatus === PaymentStatus.PAID) s.paid++;
      else if (p.paymentStatus === PaymentStatus.PROCESSED) s.pending++;
      else if (p.paymentStatus === PaymentStatus.DRAFT) s.draft++;
    });
    return s;
  }, [data]);

  const handleExport = () => {
    if (!data?.length) return;
    downloadExcel(
      `Payroll_Report_${payrollMonth}_${payrollYear}.xlsx`,
      [
        { header: 'Employee Number', value: (p: Payroll) => p.user?.employeeNumber ?? 'N/A' },
        { header: 'Employee ID', value: (p) => p.user?.employeeId ?? 'N/A' },
        { header: 'Employee Name', value: (p) => p.user?.name ?? 'N/A' },
        { header: 'Month', value: (p) => p.month },
        { header: 'Year', value: (p) => p.year },
        { header: 'Base Salary', value: (p) => p.baseSalary },
        { header: 'Working Days', value: (p) => p.workingDays },
        { header: 'Present Days', value: (p) => p.presentDays },
        { header: 'Casual Leave', value: (p) => p.casualLeaveDays },
        { header: 'Half Days', value: (p) => p.halfDays },
        { header: 'LOP Days', value: (p) => p.lossOfPayDays },
        { header: 'Total Pay Days', value: (p) => p.totalPayDays },
        { header: 'Gross Earnings', value: (p) => p.grossEarnings },
        { header: 'Deductions', value: (p) => p.deductions },
        { header: 'Reimbursements', value: (p) => p.reimbursements },
        { header: 'Net Salary', value: (p) => p.netSalary },
        { header: 'Status', value: (p) => p.paymentStatus },
      ],
      data,
    );
  };

  const isSuperAdmin = authUser?.role === Role.SUPER_ADMIN;

  return (
    <Box>
      <Grid container spacing={2} mb={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Month</InputLabel>
            <Select value={payrollMonth} label="Month" onChange={(e) => setPayrollMonth(e.target.value as number)}>
              {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Year</InputLabel>
            <Select value={payrollYear} label="Year" onChange={(e) => setPayrollYear(e.target.value as number)}>
              {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </Select>
          </FormControl>
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
              { label: 'Total Records', value: summary.total, color: 'primary', bg: isDark ? 'background.paper' : 'grey.100' },
              { label: 'Total Gross', value: `₹${summary.totalGross.toLocaleString('en-IN')}`, color: 'info.main', bg: isDark ? 'rgba(59,130,246,0.12)' : 'info.50' },
              { label: 'Total Net', value: `₹${summary.totalNet.toLocaleString('en-IN')}`, color: 'success.main', bg: isDark ? 'rgba(34,197,94,0.1)' : 'success.50' },
              { label: 'Paid', value: summary.paid, color: 'success.dark', bg: isDark ? 'rgba(22,163,74,0.16)' : 'success.100' },
              { label: 'Pending/Draft', value: summary.pending + summary.draft, color: 'warning.main', bg: isDark ? 'rgba(251,191,36,0.12)' : 'warning.50' },
            ].map((s) => (
              <Grid key={s.label} size={{ xs: 6, md: 2.4 }}>
                <Paper elevation={0} sx={{ p: { xs: 1, sm: 2 }, textAlign: 'center', bgcolor: s.bg }}>
                  <Typography
                    color={s.color}
                    sx={{
                      fontSize: typeof s.value === 'string'
                        ? { xs: '0.9rem', sm: '1.5rem' }
                        : { xs: '1.5rem', sm: '2.125rem' },
                      fontWeight: 700,
                      lineHeight: 1.2,
                      wordBreak: 'break-word',
                    }}
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
            <Typography variant="h6">Payroll Records ({data.length})</Typography>
            <Button variant="outlined" startIcon={<Download />} onClick={handleExport}>
              Export to Excel
            </Button>
          </Box>
          <ResponsiveTable
            rows={data}
            rowKey={(p) => p.id}
            maxHeight={500}
            columns={[
              {
                header: 'Employee',
                render: (p) => (
                  <Box>
                    <Typography variant="body2" fontWeight="bold">{p.user?.name ?? 'N/A'}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.user?.employeeId}</Typography>
                  </Box>
                ),
              },
              {
                header: 'Month/Year',
                render: (p) => `${MONTHS[p.month - 1]} ${p.year}`,
              },
              { header: 'Working Days', align: 'right', render: (p) => p.workingDays },
              { header: 'Pay Days', align: 'right', render: (p) => Number(p.totalPayDays).toFixed(1) },
              { header: 'Gross', align: 'right', render: (p) => `₹${Number(p.grossEarnings).toLocaleString()}` },
              {
                header: 'Net Salary',
                align: 'right',
                render: (p) => <strong>₹{Number(p.netSalary).toLocaleString()}</strong>,
              },
              {
                header: 'Status',
                render: (p) => (
                  <Chip
                    label={p.paymentStatus} size="small"
                    color={p.paymentStatus === PaymentStatus.PAID ? 'success' : p.paymentStatus === PaymentStatus.PROCESSED ? 'warning' : 'default'}
                  />
                ),
              },
            ]}
            actions={
              isSuperAdmin
                ? (p) =>
                    p.paymentStatus !== PaymentStatus.PAID ? (
                      <Button
                        size="small" variant="outlined" color="success"
                        startIcon={<CheckCircle />}
                        onClick={() => setMarkPaidDialog({ open: true, payroll: p })}
                      >
                        Mark Paid
                      </Button>
                    ) : null
                : undefined
            }
          />
        </Box>
      ) : data?.length === 0 ? (
        <Alert severity="info">No payroll records found for the selected criteria</Alert>
      ) : null}

      {/* Mark as Paid dialog */}
      <ResponsiveDialog
        open={markPaidDialog.open}
        onClose={() => setMarkPaidDialog({ open: false, payroll: null })}
        maxWidth="xs" fullWidth
      >
        <DialogTitle>Confirm Payment</DialogTitle>
        <DialogContent>
          {markPaidDialog.payroll && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Mark the following payroll as <strong>PAID</strong>?
              </Typography>
              <Box mt={1.5} p={1.5} sx={{ bgcolor: isDark ? 'background.default' : 'grey.100', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>Employee:</strong> {markPaidDialog.payroll.user?.name} ({markPaidDialog.payroll.user?.employeeId})
                </Typography>
                <Typography variant="body2">
                  <strong>Period:</strong> {MONTHS[markPaidDialog.payroll.month - 1]} {markPaidDialog.payroll.year}
                </Typography>
                <Typography variant="body2">
                  <strong>Net Salary:</strong> ₹{Number(markPaidDialog.payroll.netSalary).toLocaleString()}
                </Typography>
              </Box>
              <Alert severity="info" sx={{ mt: 1.5 }}>
                This will record today's date as the payment date and cannot be undone.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMarkPaidDialog({ open: false, payroll: null })}>Cancel</Button>
          <Button
            variant="contained" color="success" startIcon={<CheckCircle />}
            disabled={markAsPaidMutation.isPending}
            onClick={() => { if (markPaidDialog.payroll) markAsPaidMutation.mutate(markPaidDialog.payroll.id); }}
          >
            {markAsPaidMutation.isPending ? 'Marking...' : 'Confirm Paid'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default PayrollReportTab;
