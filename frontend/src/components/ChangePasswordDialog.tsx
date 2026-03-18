import React, { useState, useEffect } from 'react';
import {
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import ResponsiveDialog from './ResponsiveDialog';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { authApi } from '../api/auth';
import { getApiErrorMessage } from '../hooks/apiMessages';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({
  open,
  onClose,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setLoading(false);
    }
  }, [open]);

  const handleClose = () => {
    if (!loading) onClose();
  };

  const valid =
    currentPassword.trim() !== '' &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!valid) {
      if (newPassword.length > 0 && newPassword.length < 6) {
        setError('New password must be at least 6 characters');
      } else if (newPassword !== confirmPassword) {
        setError('New passwords do not match');
      } else {
        setError('Please fill all fields');
      }
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      handleClose();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = getApiErrorMessage(err, 'Failed to change password. Please try again.');
      if (status === 401 || msg?.toLowerCase().includes('current password')) {
        setError('Current password is incorrect');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Change password</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <TextField
            label="Current password"
            type={showCurrent ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            fullWidth
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={showCurrent ? 'Hide password' : 'Show password'}>
                    <IconButton
                      onClick={() => setShowCurrent((s) => !s)}
                      edge="end"
                      size="small"
                      aria-label={showCurrent ? 'Hide password' : 'Show password'}
                    >
                      {showCurrent ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="New password"
            type={showNew ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            required
            helperText="At least 6 characters"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={showNew ? 'Hide password' : 'Show password'}>
                    <IconButton
                      onClick={() => setShowNew((s) => !s)}
                      edge="end"
                      size="small"
                      aria-label={showNew ? 'Hide password' : 'Show password'}
                    >
                      {showNew ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Confirm new password"
            type={showConfirm ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
            fullWidth
            required
            error={confirmPassword.length > 0 && newPassword !== confirmPassword}
            helperText={
              confirmPassword.length > 0 && newPassword !== confirmPassword
                ? 'Passwords do not match'
                : ''
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={showConfirm ? 'Hide password' : 'Show password'}>
                    <IconButton
                      onClick={() => setShowConfirm((s) => !s)}
                      edge="end"
                      size="small"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      {showConfirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !valid}
          >
            {loading ? 'Updating…' : 'Change password'}
          </Button>
        </DialogActions>
      </form>
    </ResponsiveDialog>
  );
};

export default ChangePasswordDialog;
