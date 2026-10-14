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
  DialogContentText,
  TextField,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  CircularProgress,
  Paper,
} from '@mui/material';
import { Add, Campaign, Delete, History } from '@mui/icons-material';
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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
    queryKey: [QUERY_KEYS.announcements, showDeleted],
    queryFn: () => isAdmin ? announcementsApi.getAllAdmin(showDeleted) : announcementsApi.getAll(),
  });

  const {
    data: announcementHistory,
    isLoading: historyLoading,
    isError: historyError,
  } = useQuery({
    queryKey: [QUERY_KEYS.announcements, 'history'],
    queryFn: () => announcementsApi.getHistory(),
    enabled: historyOpen,
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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
      setDeleteTarget(null);
      showSuccess('Announcement deleted!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to delete announcement'));
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
          <Box display="flex" alignItems="center" gap={2}>
            {isAdmin && (
              <FormControlLabel
                control={
                  <Switch
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    color="error"
                  />
                }
                label="Show Deleted"
              />
            )}
            {isAdmin && (
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<History />}
                onClick={() => setHistoryOpen(true)}
              >
                History
              </Button>
            )}
            {isAdmin && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
                New Announcement
              </Button>
            )}
          </Box>
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
          <Card
            key={announcement.id}
            elevation={2}
            sx={{
              mb: 2,
              opacity: announcement.isActive ? 1 : 0.65,
              border: announcement.isActive ? 'none' : '1px dashed #d32f2f',
              backgroundColor: announcement.isActive
                ? 'background.paper'
                : (theme) => theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.05)' : 'rgba(211, 47, 47, 0.02)',
            }}
          >
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
                  <Campaign color={announcement.isActive ? 'primary' : 'disabled'} sx={{ flexShrink: 0 }} />
                  <Typography
                    variant="h6"
                    fontWeight="bold"
                    sx={{
                      wordBreak: 'break-word',
                      textDecoration: announcement.isActive ? 'none' : 'line-through',
                      color: announcement.isActive ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    {announcement.title}
                  </Typography>
                </Box>
                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" flexShrink={0}>
                  {!announcement.isActive && (
                    <Chip label="Deleted" color="error" size="small" variant="filled" sx={{ fontWeight: 'bold' }} />
                  )}
                  <Chip
                    label={announcement.priority}
                    color={getPriorityColor(announcement.priority)}
                    size="small"
                  />
                  {announcement.isPinned && (
                    <Chip label="Pinned" color="info" size="small" variant="outlined" />
                  )}
                  {isAdmin && announcement.isActive && (
                    <>
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
                      <Tooltip title="Delete announcement">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget({ id: announcement.id, title: announcement.title })}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </Box>
              </Box>
              <Typography
                variant="body1"
                sx={{
                  mb: 2,
                  whiteSpace: 'pre-wrap',
                  color: announcement.isActive ? 'text.primary' : 'text.secondary',
                }}
              >
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

      {/* Delete Confirmation Dialog */}
      <ResponsiveDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Delete Announcement</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            color="error"
            variant="contained"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      {/* History Dialog */}
      <ResponsiveDialog
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History color="primary" />
          <Typography variant="h6" fontWeight="bold" component="span" sx={{ flexGrow: 1 }}>
            Deleted Announcements History
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {historyLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : historyError ? (
            <Alert severity="error">Failed to load history.</Alert>
          ) : announcementHistory && announcementHistory.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {announcementHistory.map((hist) => (
                <Paper
                  key={hist.id}
                  variant="outlined"
                  sx={{
                    p: 2.5,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }}
                >
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1} flexWrap="wrap" gap={1}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {hist.title}
                    </Typography>
                    <Box display="flex" gap={1}>
                      <Chip label={hist.priority} size="small" />
                      <Chip label={hist.targetAudience} size="small" variant="outlined" />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                    {hist.content}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} pt={1.5} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary">
                      Created by <strong>{hist.creatorName}</strong> on {new Date(hist.createdAt).toLocaleString('en-IN')}
                    </Typography>
                    <Typography variant="caption" color="error.main" fontWeight="medium">
                      Deleted by <strong>{hist.deleterName}</strong> on {new Date(hist.deletedAt).toLocaleString('en-IN')}
                    </Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          ) : (
            <Alert severity="info">No deleted history available.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default Announcements;
