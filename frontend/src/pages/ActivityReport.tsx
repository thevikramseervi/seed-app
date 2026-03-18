import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  IconButton,
  CircularProgress,
  Chip,
  Tooltip,
  Alert,
} from '@mui/material';
import { Add, Delete, Save, Download } from '@mui/icons-material';
import ConfirmDialog from '../components/ConfirmDialog';
import ExcelJS from 'exceljs';
import { activityApi, type CreateActivityPayload } from '../api/activity';
import { usersApi } from '../api/users';
import { ActivityEntry, Role } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';

type EditableRow = {
  id?: string;
  /** Stable client-side id for new (unsaved) rows so delete/filter works correctly. */
  clientId?: string;
  date: string;
  userId: string;
  userName: string;
  employeeId: string;
  userStatus?: string;
  userType: string;
  project: string;
  task: string;
  subTask?: string;
  unit: string;
  nos: string;
  percentage: string;
  productivity: string;
  weightage: string;
  isNew?: boolean;
};

const toRow = (entry: ActivityEntry, fallbackUser?: { name: string; employeeId: string; status?: string }): EditableRow => {
  const user = entry.user ?? fallbackUser;
  return {
    id: entry.id,
    date: entry.date.split('T')[0],
    userId: entry.userId,
    userName: user?.name ?? '',
    employeeId: user?.employeeId ?? '',
    userStatus: user?.status,
    userType: entry.userType,
    project: entry.project,
    task: entry.task,
    subTask: entry.subTask,
    unit: entry.unit,
    nos: String(entry.nos ?? ''),
    percentage: String(entry.percentage ?? ''),
    productivity: String(entry.productivity ?? ''),
    weightage: String(entry.weightage ?? ''),
  };
};

const ActivityReport: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === Role.LAB_ADMIN || user?.role === Role.SUPER_ADMIN;

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id ?? '');
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<EditableRow | null>(null);

  const { data: users } = useQuery({
    queryKey: QUERY_KEYS.usersForActivity,
    queryFn: () => usersApi.getAllPages(),
    enabled: isAdmin,
  });

  const activitiesQuery = useQuery({
    queryKey: QUERY_KEYS.activities(isAdmin ? 'admin' : 'me', selectedUserId, selectedDate),
    queryFn: async () => {
      if (isAdmin) {
        if (!selectedUserId) return [];
        return activityApi.getReport({
          userId: selectedUserId,
          startDate: selectedDate,
          endDate: selectedDate,
        });
      }
      return activityApi.getMy({ date: selectedDate });
    },
    enabled: false,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateActivityPayload) => activityApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] }); // broad invalidation
      showSuccess('Activity saved successfully');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to save activity'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: Partial<CreateActivityPayload> }) =>
      activityApi.update(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      showSuccess('Activity updated successfully');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to update activity'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => activityApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      showSuccess('Activity deleted successfully');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to delete activity'));
    },
  });

  const isBusy = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const handleLoad = async () => {
    const data = await activitiesQuery.refetch();
    const list = data.data ?? [];

    const currentUserInfo = user
      ? {
          name: user.name,
          employeeId: user.employeeId,
        }
      : undefined;

    const selectedUser = users?.find((u) => u.id === selectedUserId);
    const fallbackUser = selectedUser
      ? { name: selectedUser.name, employeeId: selectedUser.employeeId, status: selectedUser.status }
      : currentUserInfo;

    setRows(list.map((a) => toRow(a, fallbackUser)));
  };

  const ensureContextUser = () => {
    if (isAdmin) {
      const userForRow = users?.find((u) => u.id === selectedUserId);
      if (!userForRow) {
        throw new Error('Please select an employee before adding rows');
      }
      return userForRow;
    }
    if (!user) {
      throw new Error('User context not available');
    }
    return {
      id: user.id,
      name: user.name,
      employeeId: user.employeeId,
      status: undefined as string | undefined,
    };
  };

  const handleAddRow = () => {
    try {
      const ctxUser = ensureContextUser();
      const defaultUserId = isAdmin ? selectedUserId : user!.id;

      const newRow: EditableRow = {
        clientId: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: selectedDate,
        userId: defaultUserId,
        userName: ctxUser.name,
        employeeId: ctxUser.employeeId,
        userStatus: ctxUser.status,
        userType: 'SEED',
        project: '',
        task: '',
        subTask: '',
        unit: '',
        nos: '',
        percentage: '',
        productivity: '',
        weightage: '',
        isNew: true,
      };

      setRows((prev) => [...prev, newRow]);
    } catch (err: unknown) {
      showError(getApiErrorMessage(err, 'Unable to add row'));
    }
  };

  const updateRowField = (index: number, field: keyof EditableRow, value: string) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveRow = async (row: EditableRow, index: number) => {
    const payload: CreateActivityPayload = {
      userId: isAdmin ? row.userId : undefined,
      date: row.date,
      userType: row.userType || 'SEED',
      project: row.project,
      task: row.task,
      subTask: row.subTask,
      unit: row.unit,
      nos: Number(row.nos || 0),
      percentage: Number(row.percentage || 0),
      productivity: Number(row.productivity || 0),
      weightage: Number(row.weightage || 0),
    };

    if (!row.project || !row.task || !row.unit) {
      showError('Project, Task and Unit are required');
      return;
    }

    if (row.id) {
      await updateMutation.mutateAsync({ id: row.id, payload });
    } else {
      const created = await createMutation.mutateAsync(payload);
      setRows((prev) => {
        const copy = [...prev];
        copy[index] = toRow(created, {
          name: row.userName,
          employeeId: row.employeeId,
          status: row.userStatus,
        });
        return copy;
      });
    }

    await activitiesQuery.refetch();
  };

  const rowKey = (r: EditableRow) => r.id ?? r.clientId;

  const handleDeleteRow = (row: EditableRow) => {
    if (row.id) {
      // Saved entry — ask for confirmation first
      setDeleteTarget(row);
    } else {
      // Unsaved new row — remove immediately, no server call needed
      setRows((prev) => prev.filter((r) => rowKey(r) !== rowKey(row)));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id!);
    setRows((prev) => prev.filter((r) => rowKey(r) !== rowKey(deleteTarget)));
    await activitiesQuery.refetch();
    setDeleteTarget(null);
  };

  const currentUserLabel = useMemo(() => {
    if (!user) return '';
    return `${user.name} (${user.employeeId})`;
  }, [user]);

  const handleExportExcel = async () => {
    if (rows.length === 0) {
      showError('No activity rows to export for this date');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Activity');

      worksheet.addRow([
        'Date',
        'Student Name',
        'User Type',
        'User Status',
        'Project',
        'Task',
        'Sub Task',
        'Unit',
        'Nos',
        'Percentage',
        'Productivity',
        'Weightage',
      ]);

      rows.forEach((row) => {
        worksheet.addRow([
          row.date,
          row.employeeId ? `${row.userName} - ${row.employeeId}` : row.userName,
          row.userType,
          row.userStatus ?? '',
          row.project,
          row.task,
          row.subTask ?? '',
          row.unit,
          Number(row.nos || 0),
          Number(row.percentage || 0),
          Number(row.productivity || 0),
          Number(row.weightage || 0),
        ]);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      const employeePart = isAdmin
        ? rows[0]?.employeeId || 'Employee'
        : user?.employeeId || 'Me';

      link.href = url;
      link.download = `Activity_Report_${selectedDate}_${employeePart}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      showError('Failed to export activity report to Excel');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Activity Report"
        subtitle="Enter and review daily activities in a format similar to the Excel report."
      />
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              mb: 2,
            }}
          >
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            {isAdmin ? (
              <FormControl fullWidth>
                <InputLabel>Employee</InputLabel>
                <Select
                  value={selectedUserId}
                  label="Employee"
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setRows([]);
                  }}
                >
                  <MenuItem value="">
                    <em>Select employee</em>
                  </MenuItem>
                  {users?.map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name} ({u.employeeId})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                label="Employee"
                value={currentUserLabel}
                InputProps={{ readOnly: true }}
              />
            )}

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2,
              }}
            >
              <Button
                fullWidth
                variant="outlined"
                onClick={handleLoad}
                disabled={activitiesQuery.isFetching}
              >
                {activitiesQuery.isFetching ? <CircularProgress size={24} /> : 'Load Activities'}
              </Button>

              <Button
                fullWidth
                variant="contained"
                onClick={handleAddRow}
                disabled={isBusy || (isAdmin && !selectedUserId)}
                startIcon={<Add />}
              >
                Add Row
              </Button>
            </Box>
          </Box>

          {activitiesQuery.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {getApiErrorMessage(activitiesQuery.error, 'Failed to load activities. Please try again.')}
            </Alert>
          )}

          <Box
            mb={2}
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="h6">Activity rows</Typography>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={handleExportExcel}
              disabled={rows.length === 0}
            >
              Export to Excel
            </Button>
          </Box>

          {rows.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No activity rows for this date. Click &quot;Add Row&quot; to get started.
              </Typography>
            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {rows.map((row, index) => (
                <Paper
                  key={row.id ?? row.clientId ?? index}
                  elevation={0}
                  sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}
                >
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '160px 1fr' },
                      rowGap: 1,
                      columnGap: 3,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Date
                    </Typography>
                    <TextField
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRowField(index, 'date', e.target.value)}
                      size="small"
                      aria-label="Activity date"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Student Name
                    </Typography>
                    <Box>
                      <TextField
                        value={row.userName}
                        size="small"
                        InputProps={{ readOnly: !isAdmin }}
                        onChange={(e) => updateRowField(index, 'userName', e.target.value)}
                        aria-label="Student name"
                      />
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.employeeId}
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      User Type
                    </Typography>
                    <TextField
                      value={row.userType}
                      onChange={(e) => updateRowField(index, 'userType', e.target.value)}
                      size="small"
                      aria-label="User type"
                    />

                    <Typography variant="body2" color="text.secondary">
                      User Status
                    </Typography>
                    <Box>
                      {row.userStatus ? (
                        <Chip label={row.userStatus} size="small" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                      Project
                    </Typography>
                    <TextField
                      value={row.project}
                      onChange={(e) => updateRowField(index, 'project', e.target.value)}
                      size="small"
                      aria-label="Project"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Task
                    </Typography>
                    <TextField
                      value={row.task}
                      onChange={(e) => updateRowField(index, 'task', e.target.value)}
                      size="small"
                      aria-label="Task"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Sub Task
                    </Typography>
                    <TextField
                      value={row.subTask ?? ''}
                      onChange={(e) => updateRowField(index, 'subTask', e.target.value)}
                      size="small"
                      aria-label="Sub task"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Unit
                    </Typography>
                    <TextField
                      value={row.unit}
                      onChange={(e) => updateRowField(index, 'unit', e.target.value)}
                      size="small"
                      aria-label="Unit"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Nos
                    </Typography>
                    <TextField
                      value={row.nos}
                      onChange={(e) => updateRowField(index, 'nos', e.target.value)}
                      size="small"
                      type="number"
                      inputProps={{ min: 0 }}
                      aria-label="Quantity"
                    />

                    <Typography variant="body2" color="text.secondary">
                      %
                    </Typography>
                    <TextField
                      value={row.percentage}
                      onChange={(e) => updateRowField(index, 'percentage', e.target.value)}
                      size="small"
                      type="number"
                      aria-label="Percentage"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Productivity
                    </Typography>
                    <TextField
                      value={row.productivity}
                      onChange={(e) => updateRowField(index, 'productivity', e.target.value)}
                      size="small"
                      type="number"
                      aria-label="Productivity"
                    />

                    <Typography variant="body2" color="text.secondary">
                      Weightage
                    </Typography>
                    <TextField
                      value={row.weightage}
                      onChange={(e) => updateRowField(index, 'weightage', e.target.value)}
                      size="small"
                      type="number"
                      aria-label="Weightage"
                    />
                  </Box>

                  <Box
                    mt={2}
                    display="flex"
                    justifyContent="flex-end"
                    gap={1}
                  >
                    <Tooltip title="Save row">
                      <IconButton
                        aria-label="save"
                        color="primary"
                        onClick={() => handleSaveRow(row, index)}
                        disabled={isBusy}
                        size="small"
                      >
                        <Save fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete row">
                      <IconButton
                        aria-label="delete"
                        color="error"
                        onClick={() => handleDeleteRow(row)}
                        disabled={isBusy}
                        size="small"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete activity entry"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.project || 'this entry'}" (${deleteTarget.task})? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="error"
        loading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </Box>
  );
};

export default ActivityReport;

