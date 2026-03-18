import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Alert,
  Button,
  TextField,
  IconButton,
  Tooltip,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SectionCard from '../components/SectionCard';
import { holidaysApi } from '../api/holidays';
import { type Holiday, Role } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import PageLoading from '../components/PageLoading';
import ResponsiveTable from '../components/ResponsiveTable';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';
import { Add, Edit, Delete } from '@mui/icons-material';
import ConfirmDialog from '../components/ConfirmDialog';
import ResponsiveDialog from '../components/ResponsiveDialog';
import PageHeader from '../components/PageHeader';

const Holidays: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = !!user && (user.role === Role.LAB_ADMIN || user.role === Role.SUPER_ADMIN);
  const { showSuccess, showError } = useSnackbar();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editHoliday, setEditHoliday] = useState<Holiday | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; holiday: Holiday | null }>({
    open: false,
    holiday: null,
  });
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    description: '',
  });

  const { data: holidays, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.holidays,
    queryFn: () => holidaysApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: holidaysApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.holidays });
      handleClose();
      showSuccess('Holiday added successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to add holiday'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Holiday> }) =>
      holidaysApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.holidays });
      handleClose();
      showSuccess('Holiday updated successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to update holiday'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: holidaysApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.holidays });
      showSuccess('Holiday deleted successfully!');
      setDeleteConfirm({ open: false, holiday: null });
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to delete holiday'));
    },
  });

  const handleClose = () => {
    setOpen(false);
    setEditHoliday(null);
    setFormData({ date: '', name: '', description: '' });
  };

  const handleOpen = (holiday?: Holiday) => {
    if (holiday) {
      setEditHoliday(holiday);
      setFormData({
        date: holiday.date.split('T')[0],
        name: holiday.name,
        description: holiday.description || '',
      });
    }
    setOpen(true);
  };

  const isFormValid = !!formData.date?.trim() && !!formData.name?.trim();

  const handleSubmit = () => {
    if (!formData.date?.trim()) {
      showError('Please select a date.');
      return;
    }
    if (!formData.name?.trim()) {
      showError('Holiday name is required.');
      return;
    }
    if (editHoliday) {
      updateMutation.mutate({
        id: editHoliday.id,
        data: formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDeleteClick = (holiday: Holiday) => {
    setDeleteConfirm({ open: true, holiday });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm.holiday) {
      deleteMutation.mutate(deleteConfirm.holiday.id);
      setDeleteConfirm({ open: false, holiday: null });
    }
  };

  const handleDeleteConfirmClose = () => {
    setDeleteConfirm({ open: false, holiday: null });
  };

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <SectionCard>
        <Alert severity="error">Failed to load holidays. Please try again later.</Alert>
      </SectionCard>
    );
  }

  const sortedHolidays: Holiday[] = holidays
    ? [...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  // Group holidays by year
  const holidaysByYear = sortedHolidays.reduce((acc, holiday) => {
    const year = new Date(holiday.date).getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(holiday);
    return acc;
  }, {} as Record<number, Holiday[]>);

  return (
    <Box>
      <PageHeader
        title="Holiday Calendar"
        subtitle="View all configured holidays for the lab."
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>
              Add Holiday
            </Button>
          )
        }
      />

      {Object.keys(holidaysByYear).length === 0 ? (
        <SectionCard>
          <Alert severity="info">No holidays have been configured yet.</Alert>
        </SectionCard>
      ) : (
        Object.entries(holidaysByYear)
          .sort(([a], [b]) => parseInt(b, 10) - parseInt(a, 10))
          .map(([year, yearHolidays]) => (
            <SectionCard
              key={year}
              title={`${year} (${yearHolidays.length} holidays)`}
              sx={{ mb: 3 }}
            >
                <ResponsiveTable
                  rows={yearHolidays}
                  rowKey={(h) => h.id}
                  columns={[
                    {
                      header: 'Date',
                      render: (h) => new Date(h.date).toLocaleDateString('en-IN'),
                    },
                    {
                      header: 'Day',
                      render: (h) =>
                        new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long' }),
                    },
                    {
                      header: 'Holiday',
                      render: (h) => <strong>{h.name}</strong>,
                    },
                    {
                      header: 'Description',
                      render: (h) => h.description || '–',
                    },
                  ]}
                  actions={
                    isAdmin
                      ? (h) => (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title={`Edit ${h.name}`}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpen(h)}
                                aria-label={`Edit ${h.name}`}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Delete ${h.name}`}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteClick(h)}
                                aria-label={`Delete ${h.name}`}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )
                      : undefined
                  }
                />
            </SectionCard>
          ))
      )}
      <ConfirmDialog
        open={deleteConfirm.open}
        onClose={handleDeleteConfirmClose}
        title="Delete holiday?"
        message={
          deleteConfirm.holiday ? (
            <>
              Are you sure you want to delete <strong>{deleteConfirm.holiday.name}</strong> (
              {new Date(deleteConfirm.holiday.date).toLocaleDateString('en-IN')})? This cannot be
              undone.
            </>
          ) : (
            ''
          )
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmColor="error"
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      />

      <ResponsiveDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editHoliday ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              label="Date"
              type="date"
              fullWidth
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              margin="normal"
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Holiday Name"
              fullWidth
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              label="Description (Optional)"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={!isFormValid || createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : editHoliday
              ? 'Update'
              : 'Add Holiday'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default Holidays;
