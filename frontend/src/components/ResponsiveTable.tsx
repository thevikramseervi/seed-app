import React from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MobileTableCard from './MobileTableCard';

export interface ResponsiveColumn<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  /** Text value used as the MobileTableCard label value (falls back to render). */
  mobileLabel?: string;
  align?: 'left' | 'right' | 'center';
  /** If true this column is shown only in the desktop table, not mobile cards. */
  desktopOnly?: boolean;
}

export interface ResponsiveTableProps<T> {
  columns: ResponsiveColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Optional action cell content for each row. */
  actions?: (row: T) => React.ReactNode;
  /** Limit the table height and enable scrolling. */
  maxHeight?: number;
}

function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  actions,
  maxHeight,
}: ResponsiveTableProps<T>): React.ReactElement {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {rows.map((row) => (
          <MobileTableCard
            key={rowKey(row)}
            items={columns
              .filter((col) => !col.desktopOnly)
              .map((col) => ({
                label: col.mobileLabel ?? col.header,
                value: col.render(row),
              }))}
            actions={actions?.(row)}
          />
        ))}
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        ...(maxHeight ? { maxHeight } : {}),
      }}
    >
      <Table sx={{ minWidth: 400 }} stickyHeader={!!maxHeight}>
        <TableHead>
          <TableRow>
            {columns.map((col) => (
              <TableCell key={col.header} align={col.align}>
                <strong>{col.header}</strong>
              </TableCell>
            ))}
            {actions && (
              <TableCell align="center">
                <strong>Actions</strong>
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)} hover>
              {columns.map((col) => (
                <TableCell key={col.header} align={col.align}>
                  {col.render(row)}
                </TableCell>
              ))}
              {actions && (
                <TableCell align="center">{actions(row)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ResponsiveTable;
