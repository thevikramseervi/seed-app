import React from 'react';
import { Paper, Box, Typography } from '@mui/material';

export interface MobileTableCardItem {
  label: string;
  value: React.ReactNode;
}

export interface MobileTableCardProps {
  /** Label-value pairs shown in the card (stacked on mobile). */
  items: MobileTableCardItem[];
  /** Optional actions (e.g. icon buttons) at the bottom. */
  actions?: React.ReactNode;
}

/**
 * Single card for one "row" of data on mobile. Use with useMediaQuery(breakpoints.down('sm'))
 * to replace tables with a vertical stack of these cards on small screens.
 */
const MobileTableCard: React.FC<MobileTableCardProps> = ({ items, actions }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 1.5,
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {items.map(({ label, value }, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ flexShrink: 0, pt: '2px' }}
            >
              {label}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              {typeof value === 'string' || typeof value === 'number' ? (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{ fontWeight: 500, wordBreak: 'break-word' }}
                >
                  {value}
                </Typography>
              ) : (
                value
              )}
            </Box>
          </Box>
        ))}
        {actions != null && (
          <Box sx={{ mt: 0.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            {actions}
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default MobileTableCard;
