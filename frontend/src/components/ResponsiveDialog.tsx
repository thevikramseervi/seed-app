import React from 'react';
import { Dialog, DialogProps, useTheme, useMediaQuery } from '@mui/material';

/**
 * Dialog that goes fullScreen on small viewports (mobile) for better usability.
 * Forwards all other Dialog props.
 */
const ResponsiveDialog: React.FC<DialogProps> = ({ fullScreen: fullScreenProp, ...rest }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const fullScreen = fullScreenProp ?? isMobile;

  return <Dialog fullScreen={fullScreen} {...rest} />;
};

export default ResponsiveDialog;
