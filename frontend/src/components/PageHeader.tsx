import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  align?: 'left' | 'center';
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions, align = 'left' }) => {
  const isCenter = align === 'center';

  return (
    <Box mb={3}>
      <Stack
        direction={isCenter ? 'column' : { xs: 'column', sm: 'row' }}
        spacing={isCenter ? 1 : { xs: 1, sm: 2 }}
        alignItems={isCenter ? 'center' : { xs: 'flex-start', sm: 'flex-start' }}
        justifyContent="space-between"
      >
        <Box textAlign={isCenter ? 'center' : 'left'}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box
            display="flex"
            alignItems="center"
            gap={1}
            flexWrap="wrap"
            sx={{ flexShrink: 0 }}
          >
            {actions}
          </Box>
        )}
      </Stack>
    </Box>
  );
};

export default PageHeader;

