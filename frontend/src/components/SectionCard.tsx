import React from 'react';
import { Card, CardContent, Box, Typography, CardProps } from '@mui/material';

export interface SectionCardProps extends CardProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  headerRight,
  children,
  ...cardProps
}) => {
  return (
    <Card elevation={2} {...cardProps}>
      <CardContent>
        {(title || subtitle || headerRight) && (
          <Box
            mb={subtitle ? 2 : 1}
            display="flex"
            alignItems="flex-start"
            justifyContent="space-between"
            gap={2}
          >
            <Box>
              {title && (
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {headerRight && (
              <Box display="flex" alignItems="center" gap={1}>
                {headerRight}
              </Box>
            )}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
};

export default SectionCard;

