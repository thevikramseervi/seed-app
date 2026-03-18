import React, { useMemo, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  useTheme,
  useMediaQuery,
  Tooltip,
  Alert,
} from '@mui/material';
import { CalendarMonth, TableRows, ChevronLeft, ChevronRight } from '@mui/icons-material';
import { attendanceApi } from '../api/attendance';
import { holidaysApi } from '../api/holidays';
import { type Attendance, AttendanceStatus, type Holiday } from '../types';
import { QUERY_KEYS } from '../queryKeys';
import { formatTime, formatDuration } from '../utils/format';
import PageHeader from '../components/PageHeader';
import PageLoading from '../components/PageLoading';
import MobileTableCard from '../components/MobileTableCard';

type ViewMode = 'table' | 'calendar';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
}

/** Build a local-time YYYY-MM-DD key (no TZ shift). */
const formatKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** 6-week grid for the month (Mon-start). */
const buildMonthMatrix = (year: number, month: number): CalendarDay[] => {
  const firstOfMonth = new Date(year, month, 1);
  const startDay = (firstOfMonth.getDay() + 6) % 7; // Mon = 0 … Sun = 6
  const startDate = new Date(year, month, 1 - startDay);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return { date: d, isCurrentMonth: d.getMonth() === month };
  });
};

/** Derive a status for a calendar/table day when there is no attendance record. */
const deriveStatus = (
  key: string,
  date: Date,
  statusByDate: Map<string, AttendanceStatus>,
  holidayDateKeys: Set<string>,
): AttendanceStatus | undefined => {
  const recorded = statusByDate.get(key);
  if (recorded) return recorded;
  if (holidayDateKeys.has(key)) return AttendanceStatus.HOLIDAY;
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return AttendanceStatus.WEEKEND;
  return undefined;
};

const STATUS_COLOR: Record<AttendanceStatus, 'default' | 'error' | 'warning' | 'primary' | 'info' | 'success'> = {
  [AttendanceStatus.PRESENT]: 'success',
  [AttendanceStatus.ABSENT]: 'error',
  [AttendanceStatus.HALF_DAY]: 'warning',
  [AttendanceStatus.CASUAL_LEAVE]: 'info',
  [AttendanceStatus.WEEKEND]: 'default',
  [AttendanceStatus.HOLIDAY]: 'primary',
};

const STATUS_SHORT: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: 'P',
  [AttendanceStatus.ABSENT]: 'A',
  [AttendanceStatus.HALF_DAY]: 'H',
  [AttendanceStatus.CASUAL_LEAVE]: 'CL',
  [AttendanceStatus.WEEKEND]: 'W',
  [AttendanceStatus.HOLIDAY]: 'Hol',
};

const getCellBg = (
  status: AttendanceStatus | undefined,
  isCurrentMonth: boolean,
  isDark: boolean,
): string => {
  if (!isCurrentMonth) return isDark ? 'grey.900' : 'grey.50';
  switch (status) {
    case AttendanceStatus.PRESENT:    return isDark ? 'success.dark' : 'success.light';
    case AttendanceStatus.ABSENT:     return isDark ? 'error.dark'   : 'error.light';
    case AttendanceStatus.HALF_DAY:   return isDark ? 'warning.dark' : 'warning.light';
    case AttendanceStatus.CASUAL_LEAVE: return isDark ? 'info.dark'  : 'info.light';
    case AttendanceStatus.HOLIDAY:    return isDark ? 'primary.dark' : 'primary.light';
    default:                          return isDark ? 'grey.800'     : 'grey.100';
  }
};

// ─── Sub-components ──────────────────────────────────────────────────────────

interface SummaryCardProps {
  summary: {
    present: number;
    absent: number;
    halfDay: number;
    casualLeave: number;
    weekend: number;
    holiday: number;
    totalDays: number;
  };
}

const SummaryCard: React.FC<SummaryCardProps> = ({ summary }) => (
  <Card elevation={1} sx={{ mb: 2 }}>
    <CardContent>
      <Typography variant="subtitle2" gutterBottom fontWeight="bold">
        Month summary
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={1.5}>
        <Chip label={`Present: ${summary.present}`}        size="small" color="success" />
        <Chip label={`Absent: ${summary.absent}`}          size="small" color="error" />
        <Chip label={`Half day: ${summary.halfDay}`}       size="small" color="warning" />
        <Chip label={`Casual leave: ${summary.casualLeave}`} size="small" color="info" />
        <Chip label={`Weekend: ${summary.weekend}`}        size="small" variant="outlined" />
        <Chip label={`Holiday: ${summary.holiday}`}        size="small" color="primary" />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 0.5 }}>
          ({summary.totalDays} days in month)
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

// ─── Calendar view ───────────────────────────────────────────────────────────

interface CalendarViewProps {
  monthDays: CalendarDay[];
  recordByDateKey: Map<string, Attendance>;
  statusByDate: Map<string, AttendanceStatus>;
  holidayDateKeys: Set<string>;
  isMobile: boolean;
  isDark: boolean;
}

const CalendarView: React.FC<CalendarViewProps> = ({
  monthDays, recordByDateKey, statusByDate, holidayDateKeys, isMobile, isDark,
}) => {
  const dayNames = isMobile
    ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const todayKey = formatKey(new Date());

  return (
    <Card elevation={2} sx={{ mb: 3 }}>
      <CardContent
        sx={{
          p: { xs: 1, sm: 2 },
          '&:last-child': { pb: { xs: 1, sm: 2 } },
        }}
      >
        {/* No minWidth — grid stretches to fit any screen */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: { xs: '3px', sm: 1 },
          }}
        >
          {dayNames.map((day, i) => (
            <Box
              key={i}
              textAlign="center"
              sx={{
                fontWeight: 700,
                color: 'text.secondary',
                fontSize: { xs: '0.6rem', sm: '0.875rem' },
                pb: { xs: 0.5, sm: 1 },
              }}
            >
              {day}
            </Box>
          ))}

          {monthDays.map((day) => {
            const key = formatKey(day.date);
            const record = recordByDateKey.get(key);
            const status = deriveStatus(key, day.date, statusByDate, holidayDateKeys);
            const isToday = key === todayKey && day.isCurrentMonth;
            const bg = getCellBg(status, day.isCurrentMonth, isDark);

            const tooltipContent = record ? (
              <Box component="span" sx={{ display: 'block' }}>
                {(
                  [
                    ['First in', formatTime(record.firstInTime)],
                    ['Last out', formatTime(record.lastOutTime)],
                    ['Duration', formatDuration(record.totalDuration)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <Box key={label} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                    <Typography component="span" variant="caption" color="text.secondary">{label}</Typography>
                    <Typography component="span" variant="caption" fontWeight={600}>{value}</Typography>
                  </Box>
                ))}
              </Box>
            ) : 'No punch';

            return (
              <Tooltip key={key + String(day.isCurrentMonth)} title={tooltipContent} arrow placement="top">
                <Paper
                  elevation={0}
                  sx={{
                    p: { xs: '3px', sm: 1 },
                    minHeight: { xs: 38, sm: 64 },
                    bgcolor: bg,
                    opacity: day.isCurrentMonth ? 1 : 0.5,
                    borderRadius: { xs: 0.75, sm: 1.5 },
                    border: isToday ? 2 : 1,
                    borderColor: isToday ? 'primary.main' : 'divider',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Typography
                    variant="caption"
                    fontWeight="bold"
                    sx={{
                      color: 'text.primary',
                      fontSize: { xs: '0.7rem', sm: '0.875rem' },
                      lineHeight: 1.2,
                    }}
                  >
                    {day.date.getDate()}
                  </Typography>
                  {status && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: { xs: '0.55rem', sm: '0.7rem' },
                        fontWeight: 700,
                        lineHeight: 1.1,
                        color: 'text.primary',
                        textAlign: 'center',
                      }}
                    >
                      {isMobile
                        ? STATUS_SHORT[status]
                        : status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Typography>
                  )}
                </Paper>
              </Tooltip>
            );
          })}
        </Box>

        {/* Legend */}
        <Box
          sx={{
            mt: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center',
          }}
        >
          {isMobile ? (
            <Typography variant="caption" color="text.secondary" textAlign="center">
              P Present · A Absent · H Half · CL Leave · W Weekend · Hol Holiday
            </Typography>
          ) : (
            Object.entries(STATUS_SHORT).map(([statusKey, label]) => (
              <Chip
                key={statusKey}
                label={`${label} — ${statusKey.replace(/_/g, ' ').toLowerCase()}`}
                size="small"
                color={STATUS_COLOR[statusKey as AttendanceStatus]}
                variant="outlined"
                sx={{ fontSize: '0.65rem', height: 22 }}
              />
            ))
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

// ─── Table view ───────────────────────────────────────────────────────────────

interface TableViewProps {
  tableDays: CalendarDay[];
  recordByDateKey: Map<string, Attendance>;
  statusByDate: Map<string, AttendanceStatus>;
  holidayDateKeys: Set<string>;
  isMobile: boolean;
}

const TableView: React.FC<TableViewProps> = ({
  tableDays, recordByDateKey, statusByDate, holidayDateKeys, isMobile,
}) => {
  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {tableDays.map((day) => {
          const key = formatKey(day.date);
          const record = recordByDateKey.get(key);
          const status = deriveStatus(key, day.date, statusByDate, holidayDateKeys);
          return (
            <MobileTableCard
              key={key}
              items={[
                {
                  label: 'Date',
                  value: day.date.toLocaleDateString('en-IN', {
                    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                  }),
                },
                {
                  label: 'Status',
                  value: status ? (
                    <Chip
                      label={String(status).replace(/_/g, ' ')}
                      color={STATUS_COLOR[status]}
                      size="small"
                    />
                  ) : 'No record',
                },
                { label: 'First In',  value: record ? formatTime(record.firstInTime)      : '—' },
                { label: 'Last Out',  value: record ? formatTime(record.lastOutTime)       : '—' },
                { label: 'Duration',  value: record ? formatDuration(record.totalDuration) : '—' },
              ]}
            />
          );
        })}
      </Box>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}
    >
      <Table sx={{ minWidth: 320 }}>
        <TableHead>
          <TableRow>
            <TableCell><strong>Date</strong></TableCell>
            <TableCell><strong>Status</strong></TableCell>
            <TableCell><strong>First In</strong></TableCell>
            <TableCell><strong>Last Out</strong></TableCell>
            <TableCell><strong>Duration (H:MM)</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tableDays.map((day) => {
            const key = formatKey(day.date);
            const record = recordByDateKey.get(key);
            const status = deriveStatus(key, day.date, statusByDate, holidayDateKeys);
            return (
              <TableRow key={key} hover>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {day.date.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {day.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Typography>
                </TableCell>
                <TableCell>
                  {status ? (
                    <Chip
                      label={String(status).replace(/_/g, ' ')}
                      color={STATUS_COLOR[status]}
                      size="small"
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary">No record</Typography>
                  )}
                </TableCell>
                <TableCell>{record ? formatTime(record.firstInTime)      : '—'}</TableCell>
                <TableCell>{record ? formatTime(record.lastOutTime)       : '—'}</TableCell>
                <TableCell>{record ? formatDuration(record.totalDuration) : '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const Attendance: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isDark = theme.palette.mode === 'dark';
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1; // 1–12 for API

  const { data: monthlyData, isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.myAttendanceMonthly(year, month),
    queryFn:  () => attendanceApi.getMonthlyAttendance(year, month),
    placeholderData: keepPreviousData,
  });

  const { data: holidays } = useQuery<Holiday[]>({
    queryKey: QUERY_KEYS.holidays,
    queryFn:  () => holidaysApi.getAll(),
  });

  const attendance = monthlyData?.attendance ?? [];
  const summary    = monthlyData?.summary;

  const statusByDate = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    attendance.forEach((r) => map.set((r.date as string).split('T')[0], r.status as AttendanceStatus));
    return map;
  }, [attendance]);

  const holidayDateKeys = useMemo(() => {
    const set = new Set<string>();
    (holidays ?? []).forEach((h) => set.add((h.date as string).split('T')[0]));
    return set;
  }, [holidays]);

  const recordByDateKey = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendance.forEach((r) => map.set((r.date as string).split('T')[0], r));
    return map;
  }, [attendance]);

  const monthDays = useMemo(
    () => buildMonthMatrix(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth],
  );

  const tableDays = useMemo(
    () => monthDays.filter((d) => d.isCurrentMonth).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [monthDays],
  );

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return next;
    });
  };

  if (isLoading && !monthlyData) return <PageLoading />;

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">
          Failed to load attendance. Please try again.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="My Attendance"
        subtitle="View your daily attendance as a calendar or detailed table."
      />

      {/* Toolbar: view toggle + month navigator */}
      <Box
        display="flex"
        flexDirection={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        gap={2}
        mb={2}
      >
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
          fullWidth={isMobile}
        >
          <ToggleButton value="calendar">
            <CalendarMonth sx={{ mr: 1 }} fontSize="small" />
            Calendar
          </ToggleButton>
          <ToggleButton value="table">
            <TableRows sx={{ mr: 1 }} fontSize="small" />
            Table
          </ToggleButton>
        </ToggleButtonGroup>

        <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
          <Tooltip title="Previous month">
            <IconButton size="small" onClick={() => handleMonthChange('prev')} aria-label="Previous month">
              <ChevronLeft />
            </IconButton>
          </Tooltip>
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, textAlign: 'center', minWidth: { xs: 140, sm: 'auto' } }}
          >
            {currentMonth.toLocaleDateString('en-IN', {
              month: isMobile ? 'short' : 'long',
              year: 'numeric',
            })}
          </Typography>
          <Tooltip title="Next month">
            <IconButton size="small" onClick={() => handleMonthChange('next')} aria-label="Next month">
              <ChevronRight />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {viewMode === 'calendar' ? (
        <>
          <CalendarView
            monthDays={monthDays}
            recordByDateKey={recordByDateKey}
            statusByDate={statusByDate}
            holidayDateKeys={holidayDateKeys}
            isMobile={isMobile}
            isDark={isDark}
          />
          {summary && <SummaryCard summary={summary} />}
        </>
      ) : (
        <>
          {summary && <SummaryCard summary={summary} />}
          <Card elevation={2}>
            <CardContent sx={{ overflow: 'hidden' }}>
              <TableView
                tableDays={tableDays}
                recordByDateKey={recordByDateKey}
                statusByDate={statusByDate}
                holidayDateKeys={holidayDateKeys}
                isMobile={isMobile}
              />
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default Attendance;
