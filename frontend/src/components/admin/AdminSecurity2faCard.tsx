import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Button, TextField, CircularProgress, Alert, Divider, Paper, DialogTitle, DialogContent, DialogContentText, DialogActions } from '@mui/material';
import ResponsiveDialog from '../ResponsiveDialog';
import { Security, QrCode2 } from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import { authApi } from '../../api/auth';
import { useAuth } from '../../contexts/AuthContext';
import { useApiMutation, getApiErrorMessage } from '../../hooks';
import type { AuthUser } from '../../api/auth';

export interface AdminSecurity2faCardProps {
  onMessage: (message: string, severity: 'success' | 'error') => void;
}

const AdminSecurity2faCard: React.FC<AdminSecurity2faCardProps> = ({ onMessage }) => {
  const { user, refreshUser } = useAuth();
  const [twoFactorSetup, setTwoFactorSetup] = useState<{ otpauthUrl: string; secret: string } | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [disableDialogOpen, setDisableDialogOpen] = useState(false);

  const start2faSetup = async () => {
    try {
      const data = await authApi.setup2fa();
      setTwoFactorSetup(data);
      setTwoFactorCode('');
    } catch (err: unknown) {
      onMessage(getApiErrorMessage(err, 'Failed to start 2FA setup'), 'error');
    }
  };

  const enable2faMutation = useApiMutation({
    mutationFn: (code: string) => authApi.enable2fa(code),
    successMessage: 'Two-factor authentication enabled.',
    errorMessage: 'Failed to enable 2FA',
    onMessage,
    onSuccess: async () => {
      setTwoFactorSetup(null);
      setTwoFactorCode('');
      await refreshUser();
    },
  });

  const disable2faMutation = useApiMutation({
    mutationFn: () => authApi.disable2fa(),
    successMessage: 'Two-factor authentication disabled.',
    errorMessage: 'Failed to disable 2FA',
    onMessage,
    onSuccess: async () => {
      setDisableDialogOpen(false);
      await refreshUser();
    },
  });

  return (
    <>
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Security sx={{ fontSize: 40, color: 'secondary.main', mr: 2 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">Two-Factor Authentication</Typography>
              <Typography variant="body2" color="text.secondary">Add an extra layer of security for admin sign-in (e.g. Google Authenticator)</Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          {(user as AuthUser | null)?.twoFactorEnabled ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>Two-factor authentication is enabled for your account.</Alert>
              <Button variant="outlined" color="error" onClick={() => setDisableDialogOpen(true)} disabled={disable2faMutation.isPending}>Disable 2FA</Button>
            </Box>
          ) : twoFactorSetup ? (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>Scan this QR code with your authenticator app, then enter the 6-digit code below.</Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3, flexWrap: 'wrap', my: 2 }}>
                <Paper variant="outlined" sx={{ p: 2, display: 'inline-block' }}><QRCodeSVG value={twoFactorSetup.otpauthUrl} size={180} level="M" /></Paper>
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">Or enter this secret manually:</Typography>
                  <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all', mt: 0.5 }}>{twoFactorSetup.secret}</Typography>
                </Box>
              </Box>
              <TextField label="Verification code" placeholder="000000" value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputProps={{ maxLength: 6 }} sx={{ width: 200, display: 'block', mb: 2 }} />
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" onClick={() => enable2faMutation.mutate(twoFactorCode)} disabled={twoFactorCode.length !== 6 || enable2faMutation.isPending} startIcon={enable2faMutation.isPending ? <CircularProgress size={20} /> : <QrCode2 />}>{enable2faMutation.isPending ? 'Enabling…' : 'Verify and enable 2FA'}</Button>
                <Button variant="outlined" onClick={() => { setTwoFactorSetup(null); setTwoFactorCode(''); }} disabled={enable2faMutation.isPending}>Cancel</Button>
              </Box>
            </Box>
          ) : (
            <Button variant="contained" color="secondary" startIcon={<Security />} onClick={start2faSetup}>Enable two-factor authentication</Button>
          )}
        </CardContent>
      </Card>
      <ResponsiveDialog open={disableDialogOpen} onClose={() => !disable2faMutation.isPending && setDisableDialogOpen(false)}>
        <DialogTitle>Disable two-factor authentication?</DialogTitle>
        <DialogContent><DialogContentText>Your account will be protected only by your password. You can re-enable 2FA anytime from this page.</DialogContentText></DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableDialogOpen(false)} disabled={disable2faMutation.isPending}>Cancel</Button>
          <Button color="error" variant="contained" onClick={() => disable2faMutation.mutate()} disabled={disable2faMutation.isPending}>{disable2faMutation.isPending ? 'Disabling…' : 'Disable 2FA'}</Button>
        </DialogActions>
      </ResponsiveDialog>
    </>
  );
};

export default AdminSecurity2faCard;
