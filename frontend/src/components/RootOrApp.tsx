import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import Landing from '../pages/Landing';

/**
 * At path "/": show Landing when not authenticated, otherwise render nested
 * routes (protected app with DashboardLayout).
 */
const RootOrApp: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Landing />;
  }

  return <Outlet />;
};

export default RootOrApp;
