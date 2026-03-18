import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { Add, Campaign } from '@mui/icons-material';
import { announcementsApi } from '../api/announcements';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { QUERY_KEYS } from '../queryKeys';
import SectionCard from '../components/SectionCard';
import PageHeader from '../components/PageHeader';
import { useSnackbar } from '../contexts/SnackbarContext';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { getApiErrorMessage } from '../hooks/apiMessages';
import PageLoading from '../components/PageLoading';

const Announcements: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const isAdmin = user?.role === Role.SUPER_ADMIN || user?.role === Role.LAB_ADMIN;
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    priority: 'MEDIUM',
    targetAudience: 'ALL',
  });

  const {
    data: announcements,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: QUERY_KEYS.announcements,
    queryFn: () => announcementsApi.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: announcementsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
      setOpen(false);
      setFormData({ title: '', content: '', priority: 'MEDIUM', targetAudience: 'ALL' });
      showSuccess('Announcement created!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to create announcement'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{ isPinned: boolean }>;
    }) => announcementsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
    },
  });

  const handleSubmit = () => {
    createMutation.mutate(formData);
  };

  const getPriorityColor = (
    priority: string,
  ): 'default' | 'error' | 'warning' | 'primary' | 'info' | 'success' => {
    switch (priority) {
      case 'HIGH': return 'error';
      case 'MEDIUM': return 'warning';
      case 'LOW': return 'default';
      default: return 'default';
    }
  };

  if (isLoading) return <PageLoading />;

  return (
    <Box>
      <PageHeader
        title="Announcements"
        subtitle="Company announcements and updates."
        actions={
          isAdmin && (
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
              New Announcement
            </Button>
          )
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
          {getApiErrorMessage(error, 'Failed to load announcements. Please try again.')}
        </Alert>
      )}

      {!isError && announcements && announcements.length > 0 ? (
        announcements.map((announcement) => (
          <Card key={announcement.id} elevation={2} sx={{ mb: 2 }}>
            <CardContent>
              <Box
                display="flex"
                alignItems="flex-start"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={1}
                mb={1}
              >
                <Box display="flex" alignItems="center" gap={1} minWidth={0} flex="1 1 auto">
                  <Campaign color="primary" sx={{ flexShrink: 0 }} />
                  <Typography variant="h6" fontWeight="bold" sx={{ wordBreak: 'break-word' }}>
                    {announcement.title}
                  </Typography>
                </Box>
                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" flexShrink={0}>
                  <Chip
                    label={announcement.priority}
                    color={getPriorityColor(announcement.priority)}
                    size="small"
                  />
                  {announcement.isPinned && (
                    <Chip label="Pinned" color="info" size="small" variant="outlined" />
                  )}
                  {isAdmin && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() =>
                        updateMutation.mutate({
                          id: announcement.id,
                          data: { isPinned: !announcement.isPinned },
                        })
                      }
                    >
                      {announcement.isPinned ? 'Unpin' : 'Pin'}
                    </Button>
                  )}
                </Box>
              </Box>
              <Typography variant="body1" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {announcement.content}
              </Typography>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
              >
                <Typography variant="caption" color="text.secondary">
                  By {announcement.creator?.name} &bull;{' '}
                  {new Date(announcement.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Typography>
                <Chip label={announcement.targetAudience} size="small" variant="outlined" />
              </Box>
            </CardContent>
          </Card>
        ))
      ) : !isError ? (
        <SectionCard>
          <Alert severity="info">No announcements available</Alert>
        </SectionCard>
      ) : null}

      {/* Create Announcement Dialog */}
      <ResponsiveDialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Announcement</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              margin="normal"
              required
            />
            <TextField
              label="Content"
              fullWidth
              multiline
              rows={4}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              margin="normal"
              required
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Priority</InputLabel>
              <Select
                value={formData.priority}
                label="Priority"
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              >
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Target Audience</InputLabel>
              <Select
                value={formData.targetAudience}
                label="Target Audience"
                onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="EMPLOYEES">Employees Only</MenuItem>
                <MenuItem value="ADMINS">Admins Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createMutation.isPending || !formData.title || !formData.content}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default Announcements;
