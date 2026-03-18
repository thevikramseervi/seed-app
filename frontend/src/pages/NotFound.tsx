import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader title="Page not found" subtitle="The page you are looking for does not exist." />
      <Box
        sx={{
          textAlign: 'center',
          mt: 4,
        }}
      >
        <Typography variant="h1" component="p" sx={{ fontSize: '3rem', fontWeight: 800, mb: 1 }}>
          404
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          You might have followed an outdated link or mistyped the address.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/')}>
          Go to Dashboard
        </Button>
      </Box>
    </Box>
  );
};

export default NotFound;

