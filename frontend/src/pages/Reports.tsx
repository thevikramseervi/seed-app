import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Card, CardContent, Tab, Tabs, Button, Alert } from '@mui/material';
import { Summarize } from '@mui/icons-material';
import { usersApi } from '../api/users';
import { QUERY_KEYS } from '../queryKeys';
import PageHeader from '../components/PageHeader';
import AttendanceReportTab from './reports/AttendanceReportTab';
import LeaveReportTab from './reports/LeaveReportTab';
import PayrollReportTab from './reports/PayrollReportTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`report-tabpanel-${index}`}
      aria-labelledby={`report-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: { xs: 1.5, sm: 3 } }}>{children}</Box>}
    </div>
  );
}

const Reports: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);

  const {
    data: users,
    isLoading: usersLoading,
    isError: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: QUERY_KEYS.usersAll,
    queryFn: () => usersApi.getAllPages(),
  });

  return (
    <Box>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Generate and export detailed attendance, leave, and payroll reports."
      />

      {usersError && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={() => refetchUsers()}>Retry</Button>}
        >
          Failed to load employee list. Some filters may be unavailable.
        </Alert>
      )}

      <Card elevation={2}>
        <CardContent sx={{ p: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab label="Attendance" icon={<Summarize />} iconPosition="start" />
            <Tab label="Leave" icon={<Summarize />} iconPosition="start" />
            <Tab label="Payroll" icon={<Summarize />} iconPosition="start" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <AttendanceReportTab
              users={users}
              usersLoading={usersLoading}
              usersError={usersError}
              onRefetchUsers={refetchUsers}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <LeaveReportTab users={users} usersLoading={usersLoading} />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <PayrollReportTab users={users} usersLoading={usersLoading} />
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Reports;
