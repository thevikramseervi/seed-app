import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  TextField,
} from '@mui/material';
import { MonetizationOn } from '@mui/icons-material';
import { useApiMutation } from '../../hooks';
import { payrollApi } from '../../api/payroll';
import type { User } from '../../types';
import { QUERY_KEYS } from '../../queryKeys';
import { MONTHS } from '../../utils/slipUtils';

export interface AdminPayrollCardProps {
  users: User[] | undefined;
  onMessage: (message: string, severity: 'success' | 'error') => void;
}

const AdminPayrollCard: React.FC<AdminPayrollCardProps> = ({ users, onMessage }) => {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const [payrollYear, setPayrollYear] = useState(currentYear);
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');

  const generatePayrollMutation = useApiMutation({
    mutationFn: (data: { year: number; month: number; userId?: string; paymentDate?: string }) => payrollApi.generate(data),
    successMessage: (result: { success?: number; failed?: number }) =>
      result.success !== undefined
        ? `Payroll generated! Success: ${result.success}, Failed: ${result.failed}`
        : 'Payroll generated successfully!',
    errorMessage: 'Failed to generate payroll',
    invalidateKeys: [
      [ ...QUERY_KEYS.mySalarySlips ],
      [ ...QUERY_KEYS.payroll ],
    ],
    onMessage,
  });

  const handleGeneratePayroll = () => {
    const data: { year: number; month: number; userId?: string; paymentDate?: string } = { year: payrollYear, month: payrollMonth };
    if (selectedUserId) data.userId = selectedUserId;
    if (paymentDate) data.paymentDate = paymentDate;
    generatePayrollMutation.mutate(data);
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <MonetizationOn sx={{ fontSize: 40, color: 'success.main', mr: 2 }} />
          <Box>
            <Typography variant="h6" fontWeight="bold">Generate Payroll</Typography>
            <Typography variant="body2" color="text.secondary">Generate salary slips for employees</Typography>
          </Box>
        </Box>
        <Divider sx={{ my: 2 }} />
        <FormControl fullWidth margin="normal">
          <InputLabel>Month</InputLabel>
          <Select value={payrollMonth} label="Month" onChange={(e) => setPayrollMonth(Number(e.target.value))}>
            {MONTHS.map((month, index) => (
              <MenuItem key={index} value={index + 1}>{month}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Year</InputLabel>
          <Select value={payrollYear} label="Year" onChange={(e) => setPayrollYear(Number(e.target.value))}>
            {years.map((year) => (
              <MenuItem key={year} value={year}>{year}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl fullWidth margin="normal">
          <InputLabel>Employee (Optional)</InputLabel>
          <Select value={selectedUserId} label="Employee (Optional)" onChange={(e) => setSelectedUserId(e.target.value)}>
            <MenuItem value=""><em>All Employees</em></MenuItem>
            {users?.map((u) => (
              <MenuItem key={u.id} value={u.id}>{u.name} ({u.employeeId})</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          margin="normal"
          label="Pay Date (Optional)"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          helperText="Leave blank to use default (10th of following month)"
        />
        <Button
          fullWidth
          variant="contained"
          color="success"
          size="large"
          startIcon={<MonetizationOn />}
          onClick={handleGeneratePayroll}
          disabled={generatePayrollMutation.isPending}
          sx={{ mt: 2 }}
        >
          {generatePayrollMutation.isPending ? 'Generating...' : selectedUserId ? 'Generate for Selected Employee' : 'Generate for All Employees'}
        </Button>
        <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: 'info.50', border: 1, borderColor: 'info.200' }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Note:</strong> Generating payroll will create salary slips based on attendance records. If payroll already exists for this month/employee, the operation will be skipped.
          </Typography>
        </Paper>
      </CardContent>
    </Card>
  );
};

export default AdminPayrollCard;
