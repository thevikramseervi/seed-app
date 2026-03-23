import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  TextField,
  Divider,
  Paper,
  LinearProgress,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { CloudUpload, Sync, CheckCircle, Warning } from '@mui/icons-material';
import ResponsiveDialog from '../ResponsiveDialog';
import { useApiMutation } from '../../hooks';
import api from '../../api/axios';
import { QUERY_KEYS } from '../../queryKeys';

export interface AdminBiometricCardProps {
  onMessage: (message: string, severity: 'success' | 'error') => void;
  /** 'upload' | 'sync' | 'both' — which card(s) to render. Default 'both'. */
  section?: 'upload' | 'sync' | 'both';
}

type UploadPhase = 'idle' | 'uploading' | 'processing' | 'done';

const AdminBiometricCard: React.FC<AdminBiometricCardProps> = ({ onMessage, section = 'both' }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const processingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [syncStartDate, setSyncStartDate] = useState(
    () => new Date(Date.now() - 86400000).toISOString().split('T')[0]
  );
  const [syncEndDate, setSyncEndDate] = useState(
    () => new Date(Date.now() - 86400000).toISOString().split('T')[0]
  );

  // --- Confirmation dialog ---
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // --- Progress tracking ---
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');

  const stopProcessingTimer = useCallback(() => {
    if (processingTimer.current) {
      clearInterval(processingTimer.current);
      processingTimer.current = null;
    }
  }, []);

  /** Start simulating processing progress (40% → 95%) after file is sent to server */
  const startProcessingPhase = useCallback(() => {
    setUploadPhase('processing');
    setUploadProgress(40);
    stopProcessingTimer();
    processingTimer.current = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 95) { stopProcessingTimer(); return 95; }
        // Slow down as it gets higher for a natural feel
        const increment = prev < 60 ? 3 : prev < 80 ? 1.5 : 0.5;
        return Math.min(prev + increment, 95);
      });
    }, 400);
  }, [stopProcessingTimer]);

  const finishUpload = useCallback(() => {
    stopProcessingTimer();
    setUploadProgress(100);
    setUploadPhase('done');
    // Reset after 3 seconds
    setTimeout(() => { setUploadPhase('idle'); setUploadProgress(0); }, 3000);
  }, [stopProcessingTimer]);

  const resetUpload = useCallback(() => {
    stopProcessingTimer();
    setUploadProgress(0);
    setUploadPhase('idle');
  }, [stopProcessingTimer]);

  // Cleanup on unmount
  useEffect(() => () => stopProcessingTimer(), [stopProcessingTimer]);

  const syncBiometricMutation = useApiMutation({
    mutationFn: (params: { startDate: string; endDate: string }) =>
      api.post<{ processed?: number }>(
        `/biometric/sync-range?startDate=${params.startDate}&endDate=${params.endDate}`,
      ),
    successMessage: (res: { data?: { processed?: number } }) =>
      `Biometric sync completed! Processed: ${res.data?.processed ?? 0}`,
    errorMessage: 'Failed to sync biometric data',
    invalidateKeys: [
      ['my-attendance-monthly'],
      [ ...QUERY_KEYS.attendanceDashboard ],
    ],
    onMessage,
  });

  const uploadBiometricMutation = useApiMutation({
    mutationFn: async (params: { file: File; confirmOverride?: boolean }) => {
      const formData = new FormData();
      formData.append('file', params.file);

      setUploadPhase('uploading');
      setUploadProgress(0);

      const axiosConfig = {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e: { loaded: number; total?: number }) => {
          if (e.total) {
            // Upload phase covers 0% → 40%
            const pct = Math.round((e.loaded / e.total) * 40);
            setUploadProgress(pct);
          }
        },
      };

      try {
        const { data } = await api.post(
          `/biometric/upload${params.confirmOverride ? '?confirmOverride=true' : ''}`,
          formData,
          axiosConfig,
        );
        // File sent — now server is processing
        startProcessingPhase();
        return data;
      } catch (err: any) {
        const status = err?.response?.status;
        const body = err?.response?.data;
        if (
          status === 409 &&
          body?.requiresConfirmation &&
          body?.month &&
          !params.confirmOverride
        ) {
          const existingLogs = body?.existing?.biometricLogs ?? 'some';
          const month = body.month;
          const ok = window.confirm(
            `Biometric data already exists for ${month}. Uploading will override the existing biometric records for that month (existing logs: ${existingLogs}).\n\nDo you want to continue?`,
          );
          if (!ok) {
            resetUpload();
            throw new Error('Upload cancelled');
          }
          setUploadProgress(5);
          const { data } = await api.post(
            `/biometric/upload?confirmOverride=true`,
            formData,
            axiosConfig,
          );
          startProcessingPhase();
          return data;
        }
        resetUpload();
        throw err;
      }
    },
    successMessage: (data: { logsCreated?: number; datesProcessed?: unknown[] }) =>
      `Import complete: ${data.logsCreated ?? 0} logs created, ${data.datesProcessed?.length ?? 0} dates synced`,
    errorMessage: 'Failed to upload biometric file',
    invalidateKeys: [
      ['my-attendance-monthly'],
      [...QUERY_KEYS.attendanceDashboard],
      ['attendance-report'],
    ],
    onMessage,
    onSuccess: () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
      finishUpload();
      queryClient.refetchQueries({ queryKey: ['my-attendance-monthly'] });
      queryClient.removeQueries({ queryKey: ['attendance-report'] });
    },
    onError: () => {
      resetUpload();
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      onMessage('Only .xlsx files are supported. Convert .xls to .xlsx first.', 'error');
      return;
    }
    setPendingFile(file);
    setConfirmOpen(true);
  };

  const handleConfirmUpload = () => {
    if (!pendingFile) return;
    setConfirmOpen(false);
    uploadBiometricMutation.mutate({ file: pendingFile, confirmOverride: false });
    setPendingFile(null);
  };

  const handleCancelUpload = () => {
    setConfirmOpen(false);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isUploading = uploadPhase !== 'idle';

  const showUpload = section === 'upload' || section === 'both';
  const showSync = section === 'sync' || section === 'both';

  return (
    <>
      {showUpload && (
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <CloudUpload sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Upload Biometric File
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Upload Device Log Duration Report (.xlsx) from biometric device
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            component="label"
            startIcon={<CloudUpload />}
            disabled={isUploading}
            sx={{ mt: 1 }}
          >
            {isUploading ? 'Processing...' : 'Choose & Upload Biometric Excel'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileSelect}
              hidden
            />
          </Button>

          {/* ── Progress indicator ── */}
          {isUploading && (
            <Box sx={{ mt: 2 }}>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" fontWeight={600} color="text.secondary">
                  {uploadPhase === 'uploading' && 'Uploading file...'}
                  {uploadPhase === 'processing' && 'Processing & syncing attendance...'}
                  {uploadPhase === 'done' && 'Complete!'}
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  color={uploadPhase === 'done' ? 'success.main' : 'primary.main'}
                >
                  {Math.round(uploadProgress)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{
                  height: 10,
                  borderRadius: 5,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 5,
                    bgcolor: uploadPhase === 'done' ? 'success.main' : 'primary.main',
                    transition: 'transform 0.4s ease',
                  },
                }}
              />
              {uploadPhase === 'done' && (
                <Box display="flex" alignItems="center" gap={0.5} mt={1}>
                  <CheckCircle fontSize="small" color="success" />
                  <Typography variant="body2" color="success.main" fontWeight={600}>
                    Biometric data imported successfully!
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {!isUploading && (
          <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: 'success.50', border: 1, borderColor: 'success.200' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Workflow:</strong> Download the Device Log Duration Report from your
              biometric device, convert to .xlsx if needed, then upload here. The system will
              import logs and auto-sync all dates to attendance.
            </Typography>
          </Paper>
          )}
        </CardContent>
      </Card>
      )}

      {showSync && (
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Sync sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Biometric Sync
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manually sync biometric data to attendance
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <TextField
            fullWidth
            label="Start Date"
            type="date"
            value={syncStartDate}
            onChange={(e) => setSyncStartDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            fullWidth
            label="End Date"
            type="date"
            value={syncEndDate}
            onChange={(e) => setSyncEndDate(e.target.value)}
            margin="normal"
            InputLabelProps={{ shrink: true }}
            helperText="Sync biometric data for all dates in this range (inclusive)"
          />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            startIcon={<Sync />}
            onClick={() =>
              syncBiometricMutation.mutate({
                startDate: syncStartDate,
                endDate: syncEndDate,
              })
            }
            disabled={
              syncBiometricMutation.isPending ||
              !syncStartDate ||
              !syncEndDate
            }
            sx={{ mt: 2 }}
          >
            {syncBiometricMutation.isPending ? 'Syncing...' : 'Sync Biometric Data'}
          </Button>

          <Paper elevation={0} sx={{ mt: 2, p: 2, bgcolor: 'warning.50', border: 1, borderColor: 'warning.200' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>How it works:</strong> The system will process unprocessed biometric
              logs for the selected date and create/update attendance records. Attendance
              status will be automatically determined based on total hours worked.
            </Typography>
          </Paper>

          <Box mt={3}>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Attendance Rules:
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              • ≥8 hours 30 minutes = Present
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              • ≥3 hours 45 minutes and &lt;8 hours 30 minutes = Half Day
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              • &lt;3 hours 45 minutes = Absent (LOP)
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              • Weekends & holidays are automatically marked
            </Typography>
          </Box>
        </CardContent>
      </Card>
      )}

      {/* Override confirmation dialog */}
      <ResponsiveDialog open={confirmOpen} onClose={handleCancelUpload}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Override Biometric Data?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Uploading <strong>{pendingFile?.name}</strong> will replace any existing biometric
            records and attendance data for the dates found in this file. This action cannot be
            undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCancelUpload}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirmUpload}
            startIcon={<CloudUpload />}
          >
            Confirm Override
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </>
  );
};

export default AdminBiometricCard;
