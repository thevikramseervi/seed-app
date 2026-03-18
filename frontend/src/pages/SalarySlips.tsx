import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Chip, IconButton, Tooltip, Alert } from '@mui/material';
import SectionCard from '../components/SectionCard';
import { useNavigate } from 'react-router-dom';
import { PictureAsPdf, Description, Visibility } from '@mui/icons-material';
import { payrollApi } from '../api/payroll';
import { PaymentStatus } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import { MONTHS } from '../utils/slipUtils';
import { useSnackbar } from '../contexts/SnackbarContext';
import PageLoading from '../components/PageLoading';
import PageHeader from '../components/PageHeader';
import ResponsiveTable from '../components/ResponsiveTable';
import { formatCurrency } from '../utils/format';

const SalarySlips: React.FC = () => {
  const navigate = useNavigate();
  const { showError } = useSnackbar();
  const { data: salarySlipsRaw, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.mySalarySlips,
    queryFn: () => payrollApi.getMySalarySlips(),
  });
  // Ensure we always have an array, sorted by year desc then month desc (most recent first)
  const salarySlips = React.useMemo(() => {
    const list = Array.isArray(salarySlipsRaw) ? salarySlipsRaw : [];
    return [...list].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [salarySlipsRaw]);

  const getStatusColor = (
    status: PaymentStatus,
  ): 'default' | 'error' | 'warning' | 'primary' | 'info' | 'success' => {
    switch (status) {
      case PaymentStatus.PAID:
        return 'success';
      case PaymentStatus.PROCESSED:
        return 'warning';
      case PaymentStatus.DRAFT:
        return 'default';
      default:
        return 'default';
    }
  };

  const handleDownloadPDF = async (id: string) => {
    try {
      await payrollApi.downloadPDF(id);
    } catch {
      showError('Failed to download PDF. Please try again.');
    }
  };

  const handleDownloadExcel = async (id: string) => {
    try {
      await payrollApi.downloadExcel(id);
    } catch {
      showError('Failed to download Excel file. Please try again.');
    }
  };

  const getMonthName = (month: number): string => MONTHS[month - 1] ?? 'Unknown';

  if (isLoading) return <PageLoading />;

  if (isError) {
    return <Alert severity="error" sx={{ mt: 2 }}>Failed to load salary slips. Please refresh the page.</Alert>;
  }

  return (
    <Box>
      <PageHeader
        title="Salary Slips"
        subtitle="View and download your salary slips"
      />

      <SectionCard sx={{ overflow: 'hidden' }}>
        {salarySlips.length > 0 ? (
          <ResponsiveTable
            rows={salarySlips}
            rowKey={(slip) => slip.id}
            columns={[
              {
                header: 'Month',
                render: (slip) => getMonthName(slip.month),
              },
              {
                header: 'Year',
                render: (slip) => slip.year,
                mobileLabel: 'Month / Year',
              },
              {
                header: 'Gross Earnings',
                align: 'right',
                render: (slip) => <span>{formatCurrency(slip.grossEarnings)}</span>,
              },
              {
                header: 'Net Salary',
                align: 'right',
                render: (slip) => <strong>{formatCurrency(slip.netSalary)}</strong>,
              },
              {
                header: 'Status',
                render: (slip) => (
                  <Chip
                    label={slip.paymentStatus}
                    color={getStatusColor(slip.paymentStatus)}
                    size="small"
                  />
                ),
              },
            ]}
            actions={(slip) => (
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Tooltip title="View slip">
                  <IconButton
                    size="small"
                    aria-label="View salary slip"
                    onClick={() => navigate(`/salary-slips/view/${slip.id}`)}
                  >
                    <Visibility />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download PDF">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label="Download salary slip PDF"
                    onClick={() => handleDownloadPDF(slip.id)}
                  >
                    <PictureAsPdf />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download Excel">
                  <IconButton
                    size="small"
                    color="success"
                    aria-label="Download salary slip Excel"
                    onClick={() => handleDownloadExcel(slip.id)}
                  >
                    <Description />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No salary slips available
          </Typography>
        )}
      </SectionCard>
    </Box>
  );
};

export default SalarySlips;
