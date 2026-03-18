import React from 'react';
import { Box, CircularProgress } from '@mui/material';

const PageLoading: React.FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="60vh"
    aria-busy="true"
    aria-label="Loading"
  >
    <CircularProgress />
  </Box>
);

export default PageLoading;
