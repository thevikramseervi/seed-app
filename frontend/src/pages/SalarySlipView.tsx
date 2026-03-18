import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { payrollApi } from '../api/payroll';
import {
  getPayPeriod,
  getPayDateFormatted,
  numberToWordsInr,
  formatCurrency,
  getMonthName,
} from '../utils/slipUtils';
import PageLoading from '../components/PageLoading';

const formatDate = (d: string | undefined) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const SalarySlipView: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: payroll, isLoading, error } = useQuery({
    queryKey: ['payroll', id],
    queryFn: () => payrollApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading || !id) return <PageLoading />;

  if (error || !payroll) {
    return (
      <Box>
        <Alert severity="error">Salary slip not found.</Alert>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/salary-slips')} sx={{ mt: 2 }}>
          Back to Salary Slips
        </Button>
      </Box>
    );
  }

  const monthName = getMonthName(payroll.month);
  const payPeriod = getPayPeriod(payroll.month, payroll.year);
  const payDateStr = getPayDateFormatted(
    payroll.month,
    payroll.year,
    payroll.paymentDate ?? null
  );
  const gross = Number(payroll.grossEarnings);
  const deductions = Number(payroll.deductions);
  const reimbursements = Number(payroll.reimbursements);
  const net = Number(payroll.netSalary);
  const presentDays = Number(payroll.presentDays);
  const halfDays = Number(payroll.halfDays);
  const totalPayDays = Number(payroll.totalPayDays);
  const userName = payroll.user?.name ?? '—';
  const userEmployeeId = payroll.user?.employeeId ?? '—';
  const userEmail = payroll.user?.email ?? '—';
  const userDesignation = payroll.user?.designation ?? '—';
  const userEmployeeNumber = payroll.user?.employeeNumber;
  const userDateOfJoining = payroll.user?.dateOfJoining;

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/salary-slips')}
        sx={{ mb: 2 }}
      >
        Back to Salary Slips
      </Button>

      {/*
        The salary slip is a printable document — it always renders on a white
        background with dark text regardless of the app's colour-scheme so that
        it looks identical on screen and when saved as PDF / Excel.
      */}
      <Paper
        elevation={2}
        sx={{
          maxWidth: 720,
          mx: 'auto',
          p: { xs: 2, sm: 3 },
          bgcolor: '#ffffff',
          color: '#1a1a1a',
          borderRadius: { xs: 2, sm: 3 },
          overflow: 'hidden',
          '& .MuiTypography-root': { color: '#1a1a1a' },
          '& .MuiTableCell-root': { color: '#1a1a1a', borderColor: '#d5d5d5' },
        }}
      >
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 3, pb: 2, borderBottom: '1px solid #e8e8e8' }}>
          <Typography
            variant="h6"
            fontWeight="bold"
            sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, color: '#1a1a1a' }}
          >
            Pay Slip — {monthName} {payroll.year}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: '#666' }}>
            Figures in INR
          </Typography>
        </Box>

        {/* Employee details */}
        {isMobile ? (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                EMPLOYEE DETAILS
              </Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 1.25, '& > div': { py: 0.75, borderBottom: '1px solid #eee' }, '& > div:last-of-type': { borderBottom: 'none' } }}>
              {[
                ['Employee ID', userEmployeeId],
                ['Email', userEmail],
                ['Name', userName],
                ['Designation', userDesignation ?? '—'],
                ['Emp. No.', String(userEmployeeNumber ?? '—')],
                ['Date of Joining', formatDate(userDateOfJoining)],
                ['Pay Period', payPeriod],
                ['Pay Date', payDateStr],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                  <Typography variant="body2" sx={{ color: '#666', flexShrink: 0 }}>{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-word', textAlign: 'right' }}>{value}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                EMPLOYEE DETAILS
              </Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.5, display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 24px', fontSize: '0.875rem', '& > *:nth-of-type(odd)': { color: '#666' }, '& > *:nth-of-type(even)': { fontWeight: 500 } }}>
              <Typography variant="body2">Employee ID</Typography><Typography variant="body2">{userEmployeeId}</Typography>
              <Typography variant="body2">Email</Typography><Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{userEmail}</Typography>
              <Typography variant="body2">Employee Name</Typography><Typography variant="body2">{userName}</Typography>
              <Typography variant="body2">Designation</Typography><Typography variant="body2">{userDesignation ?? '—'}</Typography>
              <Typography variant="body2">Employee Number</Typography><Typography variant="body2">{userEmployeeNumber ?? '—'}</Typography>
              <Typography variant="body2">Date of Joining</Typography><Typography variant="body2">{formatDate(userDateOfJoining)}</Typography>
              <Typography variant="body2">Pay Period</Typography><Typography variant="body2">{payPeriod}</Typography>
              <Typography variant="body2">Pay Date</Typography><Typography variant="body2">{payDateStr}</Typography>
            </Box>
          </Box>
        )}

        {/* Attendance */}
        {isMobile ? (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                ATTENDANCE SUMMARY
              </Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 1.25, '& > div': { py: 0.75, borderBottom: '1px solid #eee' }, '& > div:last-of-type': { borderBottom: 'none' } }}>
              {[
                ['Total Days', String(payroll.workingDays)],
                ['Weekend', String(payroll.weekendDays)],
                ['Holiday', String(payroll.holidayDays ?? 0)],
                ['Present', String(presentDays)],
                ['Casual Leave', String(payroll.casualLeaveDays)],
                ['Half Days', String(halfDays)],
                ['Loss of Pay', String(payroll.lossOfPayDays)],
                ['Total Pay Days', String(totalPayDays)],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#666' }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={500}>{value}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                ATTENDANCE SUMMARY
              </Typography>
            </Box>
            <Box sx={{ px: 2, py: 1.5, display: 'grid', gridTemplateColumns: '140px 1fr', gap: '4px 24px', fontSize: '0.875rem', '& > *:nth-of-type(odd)': { color: '#666' }, '& > *:nth-of-type(even)': { fontWeight: 500 } }}>
              <Typography variant="body2">Total Days</Typography><Typography variant="body2">{payroll.workingDays}</Typography>
              <Typography variant="body2">Weekend Days</Typography><Typography variant="body2">{payroll.weekendDays}</Typography>
              <Typography variant="body2">Holiday Days</Typography><Typography variant="body2">{payroll.holidayDays ?? 0}</Typography>
              <Typography variant="body2">Present Days</Typography><Typography variant="body2">{presentDays}</Typography>
              <Typography variant="body2">Casual Leave</Typography><Typography variant="body2">{payroll.casualLeaveDays}</Typography>
              <Typography variant="body2">Half Days</Typography><Typography variant="body2">{halfDays}</Typography>
              <Typography variant="body2">Loss of Pay</Typography><Typography variant="body2">{payroll.lossOfPayDays}</Typography>
              <Typography variant="body2">Total Pay Days</Typography><Typography variant="body2">{totalPayDays}</Typography>
            </Box>
          </Box>
        )}

        {/* Salary breakdown: on mobile stack Earnings and Deductions; on desktop card + table */}
        {isMobile ? (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555' }}>Earnings</Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">Salary and other Allowances</Typography>
              <Typography variant="body2" fontWeight={600}>{formatCurrency(gross)}</Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555' }}>Deductions</Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Withholding Tax</Typography>
              <Typography variant="body2">—</Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 0.75, display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">Professional Tax</Typography>
              <Typography variant="body2">—</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                SALARY BREAKDOWN
              </Typography>
            </Box>
            <TableContainer sx={{ '& .MuiTableCell-root': { borderColor: '#e8e8e8', color: '#1a1a1a', py: 1 } }}>
              <Table size="small" sx={{ '& td, & th': { borderColor: '#e8e8e8' } }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#fafafa' }}>
                    <TableCell sx={{ fontWeight: 700, color: '#555' }}>Earnings</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#555' }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#555' }}>Deductions</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: '#555' }}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>Salary and other Allowances</TableCell>
                    <TableCell align="right">{formatCurrency(gross)}</TableCell>
                    <TableCell>Withholding Tax</TableCell>
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell>Professional Tax</TableCell>
                    <TableCell align="right">—</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Reimbursements */}
        {isMobile ? (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555' }}>Reimbursements</Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ color: '#666' }}>Amount</Typography>
              <Typography variant="body2" fontWeight={600}>{reimbursements > 0 ? formatCurrency(reimbursements) : '—'}</Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                Reimbursements
              </Typography>
            </Box>
            <TableContainer sx={{ '& .MuiTableCell-root': { borderColor: '#e8e8e8', color: '#1a1a1a', py: 1 } }}>
              <Table size="small" sx={{ '& td, & th': { borderColor: '#e8e8e8' } }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: '#666' }}>Amount</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{reimbursements > 0 ? formatCurrency(reimbursements) : '—'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Summary */}
        {isMobile ? (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 1.5, py: 1, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555' }}>Summary</Typography>
            </Box>
            <Box sx={{ px: 1.5, py: 1.25, '& > div': { py: 0.75, borderBottom: '1px solid #eee' }, '& > div:last-of-type': { borderBottom: 'none', borderTop: '2px solid #1a1a1a', mt: 0.5, pt: 1 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#666' }}>Gross Earnings</Typography>
                <Typography variant="body2" fontWeight={500}>{formatCurrency(gross)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#666' }}>Total Deductions</Typography>
                <Typography variant="body2" fontWeight={500}>{formatCurrency(deductions)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ color: '#666' }}>Total Reimbursements</Typography>
                <Typography variant="body2" fontWeight={500}>{formatCurrency(reimbursements)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={700}>Net Payable</Typography>
                <Typography variant="body2" fontWeight={700}>{formatCurrency(net)}</Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mb: 2.5, border: '1px solid #e0e0e0', borderRadius: 1.5, overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.25, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#555', letterSpacing: '0.02em' }}>
                Summary
              </Typography>
            </Box>
            <TableContainer sx={{ '& .MuiTableCell-root': { borderColor: '#e8e8e8', color: '#1a1a1a', py: 1 } }}>
              <Table size="small" sx={{ '& td, & th': { borderColor: '#e8e8e8' } }}>
                <TableBody>
                  <TableRow>
                    <TableCell sx={{ color: '#666' }}>Gross Earnings</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(gross)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: '#666' }}>Total Deductions</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(deductions)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ color: '#666' }}>Total Reimbursements</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>{formatCurrency(reimbursements)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: '#fafafa', '& td': { borderTop: '2px solid #1a1a1a', pt: 1.25, fontWeight: 700 } }}>
                    <TableCell>Net Payable</TableCell>
                    <TableCell align="right">{formatCurrency(net)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        <Box sx={{ mt: 1, p: { xs: 1.25, sm: 1.5 }, bgcolor: '#fafafa', borderRadius: 1, border: '1px solid #eee' }}>
          <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 0.5, fontSize: { xs: '0.8125rem', sm: 'inherit' }, color: '#555' }}>
            Net Payable = Gross earnings − Total deductions
          </Typography>
          <Typography variant="body2" sx={{ fontSize: { xs: '0.8125rem', sm: 'inherit' } }}>
            <Box component="span" sx={{ color: '#555' }}>In words: </Box>
            {numberToWordsInr(net)}
          </Typography>
        </Box>

        <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid #e8e8e8', textAlign: 'center' }}>
          <Typography variant="caption" display="block" sx={{ color: '#888' }}>
            This is a computer-generated document. No signature is required.
          </Typography>
          <Typography variant="caption" display="block" sx={{ color: '#888', mt: 0.5 }}>
            Generated on {formatDate(new Date().toISOString())}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default SalarySlipView;
