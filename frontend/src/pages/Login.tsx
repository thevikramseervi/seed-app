import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  InputAdornment,
  IconButton,
  useTheme,
  Tooltip,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeModeContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';

const SESSION_EXPIRED_KEY = 'showSessionExpired';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login, complete2fa } = useAuth();
  const { showError } = useSnackbar();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const successMessage = (location.state as { message?: string })?.message;
  const returnUrlEncoded = new URLSearchParams(location.search).get('returnUrl');
  let postLoginPath = '/';
  if (returnUrlEncoded) {
    try {
      const decoded = decodeURIComponent(returnUrlEncoded);
      if (decoded.startsWith('/')) postLoginPath = decoded;
    } catch {
      // ignore malformed returnUrl
    }
  }

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_EXPIRED_KEY)) {
        sessionStorage.removeItem(SESSION_EXPIRED_KEY);
        showError('Session expired. Please sign in again.');
      }
    } catch {
      // ignore
    }
  }, [showError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await login({ email, password });
      if ('requires2fa' in response && response.requires2fa) {
        setTwoFactorToken(response.twoFactorToken);
        setStep('2fa');
      } else {
        navigate(postLoginPath, { replace: true });
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await complete2fa(twoFactorToken, twoFactorCode);
      navigate(postLoginPath, { replace: true });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Invalid code. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setTwoFactorToken('');
    setTwoFactorCode('');
    setError('');
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: (theme) => (theme.palette.mode === 'light' ? '#F3F4F6' : 'background.default'),
        px: 2,
      }}
    >
      <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
        <IconButton
          onClick={toggleMode}
          aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          sx={{
            position: 'fixed',
            top: 16,
            right: 16,
            color: 'text.primary',
            bgcolor: 'rgba(15,23,42,0.5)',
            '&:hover': { bgcolor: 'rgba(15,23,42,0.8)' },
            zIndex: 10,
          }}
        >
          {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Tooltip>

      <Container maxWidth="md">
        <Card
          elevation={2}
          sx={{
            borderRadius: 4,
            overflow: 'hidden',
            bgcolor: (theme) =>
              theme.palette.mode === 'light'
                ? theme.palette.common.white
                : theme.palette.background.paper,
            border: (theme) =>
              theme.palette.mode === 'light'
                ? '1px solid #E5E7EB'
                : '1px solid rgba(148,163,184,0.3)',
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            minHeight: { md: 480 },
          }}
        >
          {/* Left image / brand panel */}
          <Box
            sx={{
              flex: { xs: '0 0 180px', md: '0 0 45%' },
              position: 'relative',
              backgroundImage: 'url("/login-hero.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(15,23,42,0.15)',
              }}
            />
            {/* Image-only panel; overlay handled by background + dark scrim */}
          </Box>

          {/* Right form panel */}
          <CardContent
            sx={{
              flex: 1,
              p: { xs: 3, sm: 4 },
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <Box sx={{ mb: 3 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                <LoginIcon sx={{ color: 'common.white' }} />
              </Box>
              <Typography variant="h4" fontWeight={700} gutterBottom>
                Welcome back
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to access your dashboard.
              </Typography>
            </Box>

            {successMessage && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                {successMessage}
              </Alert>
            )}
            {error && (
              <Alert
                severity="error"
                sx={{ mb: 2, borderRadius: 2 }}
                onClose={() => setError('')}
              >
                {error}
              </Alert>
            )}

            {step === '2fa' ? (
              <form onSubmit={handle2faSubmit}>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                  Enter the 6-digit code from your authenticator app.
                </Typography>
                <TextField
                  label="Verification code"
                  placeholder="000000"
                  fullWidth
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
                  margin="normal"
                  autoFocus
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || twoFactorCode.length !== 6}
                  startIcon={<LoginIcon />}
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.75,
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: `0 4px 14px 0 ${theme.palette.primary.main}40`,
                  }}
                >
                  {loading ? 'Verifying…' : 'Verify and sign in'}
                </Button>
                <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
                  <Typography
                    component="button"
                    type="button"
                    onClick={handleBackToLogin}
                    sx={{
                      color: 'primary.main',
                      textDecoration: 'none',
                      fontWeight: 600,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Back to sign in
                  </Typography>
                </Typography>
              </form>
            ) : (
              <form onSubmit={handleSubmit}>
                <TextField
                  label="Email address"
                  type="email"
                  fullWidth
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  margin="normal"
                  autoComplete="email"
                  autoFocus
                />
                <TextField
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  fullWidth
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  margin="normal"
                  autoComplete="current-password"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Tooltip title={showPassword ? 'Hide password' : 'Show password'}>
                          <IconButton
                            onClick={() => setShowPassword(!showPassword)}
                            edge="end"
                            size="small"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? (
                              <VisibilityOff fontSize="small" />
                            ) : (
                              <Visibility fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ),
                  }}
                />
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading}
                  startIcon={<LoginIcon />}
                  sx={{
                    mt: 3,
                    mb: 2,
                    py: 1.75,
                    borderRadius: 2,
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: `0 4px 14px 0 ${theme.palette.primary.main}40`,
                  }}
                >
                  {loading ? 'Signing in…' : 'Sign In'}
                </Button>
                <Typography variant="body2" sx={{ textAlign: 'right', mt: 1 }}>
                  <Link
                    to="/forgot-password"
                    style={{
                      color: theme.palette.primary.main,
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    Forgot password?
                  </Link>
                </Typography>
              </form>
            )}

          </CardContent>
        </Card>
      </Container>
    </Box>
  );
};

export default Login;
