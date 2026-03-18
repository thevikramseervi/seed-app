import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Typography,
  Stack,
  Paper,
  IconButton,
  useTheme,
  useMediaQuery,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle,
  Schedule,
  Receipt,
  Notifications,
  ArrowForward,
  Login,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useThemeMode } from '../contexts/ThemeModeContext';

const features = [
  {
    icon: <Schedule sx={{ fontSize: 32 }} />,
    title: 'Smart Attendance',
    description: 'Track clock-in, clock-out, and hours with a clear calendar view and status at a glance.',
  },
  {
    icon: <Receipt sx={{ fontSize: 32 }} />,
    title: 'Leave & Payroll',
    description: 'Apply for leave, get approvals, and access salary slips and reports in one place.',
  },
  {
    icon: <Notifications sx={{ fontSize: 32 }} />,
    title: 'Announcements',
    description: 'Stay updated with company news and important notices delivered in-app.',
  },
  {
    icon: <CheckCircle sx={{ fontSize: 32 }} />,
    title: 'One Dashboard',
    description: 'Employees and admins get a single, secure dashboard tailored to their role.',
  },
];

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { mode, toggleMode } = useThemeMode();
  const isSm = useMediaQuery(theme.breakpoints.up('sm'));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box
        component="header"
        sx={{
          py: 2,
          px: 2,
          position: 'sticky',
          top: 0,
          bgcolor: 'background.paper',
          backdropFilter: 'blur(12px)',
          borderBottom: 1,
          borderColor: 'divider',
          zIndex: 10,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography
              variant="h6"
              fontWeight={800}
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Attend Ease
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
                <IconButton
                  color="inherit"
                  onClick={toggleMode}
                  aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
                </IconButton>
              </Tooltip>
              <Button
              variant="contained"
              endIcon={<Login />}
              onClick={() => navigate('/login')}
              sx={{
                borderRadius: 3,
                px: 3,
                py: 1.25,
                textTransform: 'none',
                fontWeight: 700,
                boxShadow: `0 4px 14px 0 ${theme.palette.primary.main}40`,
              }}
            >
              Sign In
            </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Hero */}
      <Box sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Stack alignItems="center" textAlign="center" spacing={4}>
            <Typography
              component="h1"
              variant={isSm ? 'h2' : 'h4'}
              fontWeight={800}
              sx={{
                maxWidth: 720,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
              }}
            >
              Attendance and payroll,{' '}
              <Typography
                component="span"
                variant="inherit"
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                simplified
              </Typography>
            </Typography>
            <Typography
              variant="h6"
              color="text.secondary"
              fontWeight={500}
              sx={{ maxWidth: 560 }}
            >
              One platform for tracking time, managing leave, and accessing salary slips. Built for teams that value clarity and control.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForward />}
                onClick={() => navigate('/login')}
                sx={{
                  borderRadius: 3,
                  px: 4,
                  py: 1.75,
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: '1rem',
                  boxShadow: `0 4px 20px 0 ${theme.palette.primary.main}50`,
                }}
              >
                Get started
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/login')}
                sx={{
                  borderRadius: 3,
                  px: 4,
                  py: 1.75,
                  textTransform: 'none',
                  fontWeight: 700,
                  borderWidth: 2,
                  '&:hover': { borderWidth: 2 },
                }}
              >
                Sign In
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Features */}
      <Box sx={{ py: { xs: 6, md: 10 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            fontWeight={700}
            textAlign="center"
            gutterBottom
            sx={{ mb: 6 }}
          >
            Everything you need
          </Typography>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={3}
            useFlexGap
            flexWrap="wrap"
          >
            {features.map((f, i) => (
              <Paper
                key={i}
                elevation={0}
                sx={{
                  flex: { xs: '1 1 100%', md: '1 1 calc(50% - 12px)' },
                  p: 3,
                  borderRadius: 3,
                  border: 1,
                  borderColor: 'divider',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: 'primary.light',
                    boxShadow: `0 8px 24px ${theme.palette.primary.main}15`,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    bgcolor: 'primary.50',
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  {f.icon}
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {f.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {f.description}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA */}
      <Box sx={{ py: { xs: 8, md: 10 } }}>
        <Container maxWidth="md">
          <Paper
            elevation={0}
            sx={{
              p: 4,
              borderRadius: 4,
              textAlign: 'center',
              background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
              color: 'white',
            }}
          >
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Ready to get started?
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.95, mb: 3 }}>
              Sign in to access your dashboard and manage attendance, leave, and payroll.
            </Typography>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForward />}
              onClick={() => navigate('/login')}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                borderRadius: 3,
                px: 4,
                py: 1.5,
                textTransform: 'none',
                fontWeight: 700,
                '&:hover': { bgcolor: 'grey.100' },
              }}
            >
              Sign In
            </Button>
          </Paper>
        </Container>
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          py: 3,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
          >
            <Typography variant="body2" color="text.secondary">
              Attend Ease – Automated Attendance & Payroll System
            </Typography>
            <Button
              size="small"
              color="inherit"
              onClick={() => navigate('/login')}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Sign In
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
};

export default Landing;
