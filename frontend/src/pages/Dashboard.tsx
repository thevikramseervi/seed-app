import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Grid, Card, CardContent, Typography, Box, CircularProgress, Alert, Paper, Chip,
  Dialog, DialogContent, DialogActions, Button, IconButton,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  CheckCircle, Cancel, Timelapse, EventAvailable,
  LaptopMac, Monitor, Cable, Storage,
  InfoOutlined, Close, NotificationsActive, Campaign,
} from '@mui/icons-material';
import { attendanceApi } from '../api/attendance';
import { leaveApi } from '../api/leave';
import { announcementsApi } from '../api/announcements';
import { notificationsApi } from '../api/notifications';
import { assetsApi } from '../api/assets';
import { AssetType, LeaveStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { QUERY_KEYS } from '../queryKeys';

const POPUP_STORAGE_KEY = 'notif_popup_seen';
function getSeenState(): { announcementId: string | null; clId: string | null; clStatus: string | null } {
  try { return JSON.parse(sessionStorage.getItem(POPUP_STORAGE_KEY) || 'null') ?? { announcementId: null, clId: null, clStatus: null }; }
  catch { return { announcementId: null, clId: null, clStatus: null }; }
}
function saveSeenState(announcementId: string | null, clId: string | null, clStatus: string | null) {
  sessionStorage.setItem(POPUP_STORAGE_KEY, JSON.stringify({ announcementId, clId, clStatus }));
}
import PageHeader from '../components/PageHeader';

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200, delay = 0) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const t = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return value;
}

// ─── Ring Chart ───────────────────────────────────────────────────────────────

function RingChart({ present, total, size = 150, color }: { present: number; total: number; size?: number; color: string }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    let raf: number;
    let start: number | null = null;
    const t = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 1400, 1);
        setProgress(1 - Math.pow(1 - p, 3));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, 200);
    return () => { clearTimeout(t); cancelAnimationFrame(raf); };
  }, []);

  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? present / total : 0;
  const filled = circ * pct * progress;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.15)" strokeWidth={14} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={14}
        strokeLinecap="round" strokeDasharray={`${filled} ${circ}`} />
    </svg>
  );
}

// ─── Animated Bar ─────────────────────────────────────────────────────────────

function AnimBar({ pct, color, delay = 0 }: { pct: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), delay + 100);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <Box sx={{ height: 8, bgcolor: 'action.hover', borderRadius: 99, overflow: 'hidden' }}>
      <Box sx={{
        height: '100%', borderRadius: 99, bgcolor: color,
        width: `${width}%`,
        transition: `width 1.3s ${delay}ms cubic-bezier(.16,1,.3,1)`,
      }} />
    </Box>
  );
}

// ─── Attendance Progress Card ─────────────────────────────────────────────────

function AttendanceProgressCard({ stats }: { stats: { presentDays: number; halfDays: number; casualLeaves: number; totalWorkingDays: number } }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Helper to count Mon-Fri workdays between two dates
  const countWorkDays = (start: Date, end: Date) => {
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++; // 0=Sun, 6=Sat
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  const calculatedWorkingDays = countWorkDays(startOfMonth, endOfMonth);

  // Calculate hours (9h per working day)
  const totalWorkingDays = stats.totalWorkingDays || calculatedWorkingDays;
  const presentDays = stats.presentDays || 0;
  const halfDays = stats.halfDays || 0;
  const casualLeaves = stats.casualLeaves || 0;

  const totalHours = totalWorkingDays * 9;
  const presentHours = Math.round((presentDays + halfDays * 0.5 + casualLeaves) * 9);
  const neededHours = Math.max(0, totalHours - presentHours);
  const pct = totalHours > 0 ? Math.round((presentHours / totalHours) * 100) : 0;
  const animatedPct = useCountUp(pct, 1200, 200);
  const cDays = Math.round((presentDays + halfDays * 0.5 + casualLeaves) * 10) / 10;

  return (
    <Card elevation={0} sx={{ border: 1, borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: 2.5 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>Attendance Progress</Typography>
        <Box display="flex" alignItems="center" justifyContent="space-between" mt={2} mb={3}>
          <Box position="relative">
            <RingChart present={presentHours} total={totalHours} color={theme.palette.primary.main} />
            <Box sx={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
            }}>
              <Typography variant="h4" fontWeight={800} color="primary.main">{animatedPct}%</Typography>
            </Box>
          </Box>
          <Box sx={{ ml: 4, flexGrow: 1 }}>
            <Box mb={2}>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">Present Hours</Typography>
                <Typography variant="body2" fontWeight={600}>{presentHours}h</Typography>
              </Box>
              <AnimBar pct={pct} color={theme.palette.primary.main} delay={100} />
            </Box>
            <Box>
              <Box display="flex" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2" color="text.secondary">Days Attended</Typography>
                <Typography variant="body2" fontWeight={600}>{cDays} / {totalWorkingDays} days</Typography>
              </Box>
              <AnimBar pct={totalWorkingDays > 0 ? (cDays / totalWorkingDays) * 100 : 0} color={theme.palette.success.main} delay={200} />
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

  const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    const { data: dashboardStats, isLoading: statsLoading, isError: statsError, failureCount: statsFailures } = useQuery({
      queryKey: QUERY_KEYS.attendanceDashboard,
      queryFn: () => attendanceApi.getDashboard(),
    });

    const { data: leaveBalance, isLoading: leaveLoading, isError: leaveError, failureCount: leaveFailures } = useQuery({
      queryKey: QUERY_KEYS.leaveBalance,
      queryFn: () => leaveApi.getBalance(),
    });

    const { data: announcements, isLoading: announcementsLoading, isError: announcementsError, failureCount: announcementsFailures } = useQuery({
      queryKey: QUERY_KEYS.announcements,
      queryFn: () => announcementsApi.getAll(),
    });

    const { data: myAssets, isLoading: assetsLoading } = useQuery({
      queryKey: QUERY_KEYS.myAssets,
      queryFn: () => assetsApi.getMy(),
    });

    const { data: myLeaveApps } = useQuery({
      queryKey: QUERY_KEYS.myLeaveApplications,
      queryFn: () => leaveApi.getMyApplications(),
    });

    const queryClient = useQueryClient();
    const [notifOpen, setNotifOpen] = useState(false);

    const markAllMutation = useMutation({
      mutationFn: async () => {
        await notificationsApi.markAllAsRead();
        if (latestAnnouncement && !latestAnnouncement.isRead) {
          await announcementsApi.markAsRead(latestAnnouncement.id);
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationsUnreadCount });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.announcements });
        dismissPopup();
      },
    });

    const laptopAsset = myAssets?.find((a) => a.assetType === AssetType.LAPTOP) ?? null;
    const monitorAsset = myAssets?.find((a) => a.assetType === AssetType.MONITOR) ?? null;
    const honeywellAsset = myAssets?.find((a) => a.assetType === AssetType.CONNECTOR) ?? null;
    const hddAsset = myAssets?.find((a) => a.assetType === AssetType.HDD) ?? null;

    const assetRows = [
      { label: 'Laptop', asset: laptopAsset, icon: <LaptopMac fontSize="small" sx={{ color: 'primary.main' }} /> },
      { label: 'Monitor', asset: monitorAsset, icon: <Monitor fontSize="small" sx={{ color: 'info.main' }} /> },
      { label: 'Honeywell', asset: honeywellAsset, icon: <Cable fontSize="small" sx={{ color: 'success.main' }} /> },
      { label: 'HDD', asset: hddAsset, icon: <Storage fontSize="small" sx={{ color: 'warning.main' }} /> },
    ];

    // Compute notification content
    const latestCL = myLeaveApps
      ?.filter((a) => a.leaveType === 'CASUAL_LEAVE')
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())[0];

    const latestAnnouncement = announcements
      ?.filter((a) => !a.isRead)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      ?? announcements?.[0];

    const clStatusColor =
      latestCL?.status === LeaveStatus.APPROVED ? 'success.main' :
      latestCL?.status === LeaveStatus.REJECTED ? 'error.main' : 'warning.main';

    const clStatusLabel =
      latestCL?.status === LeaveStatus.APPROVED ? 'Approved ✓' :
      latestCL?.status === LeaveStatus.REJECTED ? 'Rejected ✗' : 'Pending…';

    const dismissPopup = () => {
      saveSeenState(
        latestAnnouncement?.id ?? null,
        latestCL?.id ?? null,
        latestCL?.status ?? null,
      );
      setNotifOpen(false);
    };

    // Open popup only when there's real content and something new since last dismissal
    useEffect(() => {
      const hasUnreadAnnouncement = !!(latestAnnouncement && !latestAnnouncement.isRead);
      const hasCLDecision = !!(latestCL && (latestCL.status === LeaveStatus.APPROVED || latestCL.status === LeaveStatus.REJECTED));
      if (!hasUnreadAnnouncement && !hasCLDecision) return;

      const seen = getSeenState();
      const announcementIsNew = hasUnreadAnnouncement && latestAnnouncement!.id !== seen.announcementId;
      const clIsNew = hasCLDecision && (latestCL!.id !== seen.clId || latestCL!.status !== seen.clStatus);
      if (announcementIsNew || clIsNew) setNotifOpen(true);
    }, [latestAnnouncement?.id, latestAnnouncement?.isRead, latestCL?.id, latestCL?.status]);

    const isRetrying = (statsLoading && statsFailures > 0) || (leaveLoading && leaveFailures > 0) || (announcementsLoading && announcementsFailures > 0);

    if (statsLoading || leaveLoading || announcementsLoading || assetsLoading) {
      return (
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh" gap={2}>
          <CircularProgress sx={{ color: 'primary.main' }} />
          {isRetrying && (
            <Alert severity="info" sx={{ maxWidth: 420 }}>
              Server is warming up — this can take up to 60 seconds on first load. Please wait…
            </Alert>
          )}
        </Box>
      );
    }

    if (statsError || leaveError || announcementsError) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to load dashboard data. The server may be unavailable — please refresh the page or try again in a moment.
        </Alert>
      );
    }

    const statCards = [
      { title: 'Present Days', value: dashboardStats?.presentDays || 0, icon: <CheckCircle sx={{ fontSize: 40, color: 'success.main' }} />, color: 'success.light' },
      { title: 'Absent Days', value: dashboardStats?.absentDays || 0, icon: <Cancel sx={{ fontSize: 40, color: 'error.main' }} />, color: 'error.light' },
      { title: 'Half Days', value: dashboardStats?.halfDays || 0, icon: <Timelapse sx={{ fontSize: 40, color: 'warning.main' }} />, color: 'warning.light' },
      { title: 'Casual Leaves', value: dashboardStats?.casualLeaves || 0, icon: <EventAvailable sx={{ fontSize: 40, color: 'info.main' }} />, color: 'info.light' },
    ];

    return (
      <Box>
        <PageHeader
          title={user ? `Welcome back, ${user.name}!` : 'Dashboard'}
          subtitle="Here's an overview of your attendance and updates for this month."
        />
        <Grid container spacing={3}>
          {/* Stat cards */}
          {statCards.map((card, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
              <Card elevation={0} onClick={() => navigate('/attendance')} sx={{
                border: 1, borderColor: 'divider', cursor: 'pointer',
                transition: 'box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease',
                '&:hover': { boxShadow: '0 4px 20px rgb(0 0 0 / 0.08)', borderColor: 'primary.light', transform: 'translateY(-2px)' },
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box display="flex" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography color="text.secondary" variant="body2" fontWeight={600} gutterBottom>{card.title}</Typography>
                      <Typography variant="h4" fontWeight={700}>{card.value}</Typography>
                    </Box>
                    <Box sx={{ bgcolor: card.color, p: 1.5, borderRadius: 2 }}>{card.icon}</Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}

          {/* Attendance Progress (animated) */}
          <Grid size={{ xs: 12, md: 6 }}>
            {dashboardStats && (
              <AttendanceProgressCard stats={{
                presentDays: dashboardStats.presentDays,
                halfDays: dashboardStats.halfDays,
                casualLeaves: dashboardStats.casualLeaves,
                totalWorkingDays: dashboardStats.totalWorkingDays,
              }} />
            )}
          </Grid>

          {/* Assets — read-only for employees */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} onClick={() => navigate('/my-assets')} sx={{
              border: 1, borderColor: 'divider', height: '100%', cursor: 'pointer',
              transition: 'box-shadow 0.2s, border-color 0.2s',
              '&:hover': { boxShadow: 4, borderColor: 'primary.main' },
            }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>My Assets</Typography>
                <Box mt={2}>
                  <Box display="grid" gridTemplateColumns="1fr 1fr" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Asset</Typography>
                    </Box>
                    <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Asset Number</Typography>
                    </Box>
                    {assetRows.map(({ label, asset, icon }, index) => (
                      <React.Fragment key={label}>
                        <Box sx={{
                          px: 2, py: 1.5,
                          borderBottom: index < assetRows.length - 1 ? 1 : 0,
                          borderColor: 'divider', bgcolor: 'background.paper',
                          display: 'flex', alignItems: 'center', gap: 1,
                        }}>
                          {icon}
                          <Typography variant="body2" fontWeight={600}>{label}</Typography>
                        </Box>
                        <Box sx={{
                          px: 2, py: 1.5,
                          borderBottom: index < assetRows.length - 1 ? 1 : 0,
                          borderColor: 'divider', bgcolor: 'background.paper',
                        }}>
                          {asset ? (
                            <Typography variant="body2">{asset.assetNumber}</Typography>
                          ) : (
                            <Typography variant="body2" color="text.disabled" fontStyle="italic">—</Typography>
                          )}
                        </Box>
                      </React.Fragment>
                    ))}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Leave Balance */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={0} onClick={() => navigate('/leave')} sx={{
              border: 1, borderColor: 'divider', height: '100%', cursor: 'pointer',
              transition: 'box-shadow 0.2s, border-color 0.2s',
              '&:hover': { boxShadow: 4, borderColor: 'primary.main' },
            }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Leave Balance</Typography>
                <Box mt={2}>
                  {[
                    { label: 'Total Leaves', value: leaveBalance?.totalLeaves ?? 0, color: undefined },
                    { label: 'Used', value: leaveBalance?.usedLeaves ?? 0, color: 'error.main' },
                    { label: 'Pending', value: leaveBalance?.pendingLeaves ?? 0, color: 'warning.main' },
                  ].map(({ label, value, color }) => (
                    <Box key={label} display="flex" justifyContent="space-between" mb={1.5}>
                      <Typography variant="body2" color="text.secondary">{label}</Typography>
                      <Typography variant="body2" fontWeight={600} sx={color ? { color } : {}}>{value}</Typography>
                    </Box>
                  ))}
                  <Box display="flex" justifyContent="space-between" sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" fontWeight={700}>Available</Typography>
                    <Typography variant="body2" color="success.main" fontWeight={700}>{leaveBalance?.availableLeaves ?? 0}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Announcements */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card elevation={0} onClick={() => navigate('/announcements')} sx={{
              border: 1, borderColor: 'divider', height: '100%', cursor: 'pointer',
              transition: 'box-shadow 0.2s, border-color 0.2s',
              '&:hover': { boxShadow: 4, borderColor: 'primary.main' },
            }}>
              <CardContent sx={{ p: 2.5 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>Recent Announcements</Typography>
                <Box mt={2}>
                  {announcements && announcements.length > 0 ? (
                    announcements.slice(0, 5).map((announcement) => (
                      <Paper key={announcement.id} elevation={0} sx={{
                        p: 2, mb: 1.5, borderRadius: 2,
                        bgcolor: (theme) =>
                          announcement.isRead
                            ? theme.palette.action.selected
                            : alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08),
                        border: 1,
                        borderColor: announcement.isRead ? 'divider' : 'primary.200',
                      }}>
                        <Box display="flex" alignItems="center" mb={0.5}>
                          <Typography variant="subtitle2" fontWeight={600} sx={{ flexGrow: 1 }}>
                            {announcement.title}
                          </Typography>
                          <Chip
                            label={announcement.priority} size="small"
                            color={
                              announcement.priority === 'URGENT' || announcement.priority === 'HIGH' ? 'error'
                                : announcement.priority === 'MEDIUM' ? 'warning' : 'default'
                            }
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary">{announcement.content}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          By {announcement.creator?.name ?? 'Unknown'} • {new Date(announcement.createdAt).toLocaleDateString()}
                        </Typography>
                      </Paper>
                    ))
                  ) : (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>No announcements available</Alert>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* ── Centered Notification Modal ─────────────────────────────── */}
        <Dialog
          open={notifOpen}
          onClose={dismissPopup}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              overflow: 'hidden',
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'linear-gradient(135deg, #1a1f2e 0%, #16213e 100%)'
                  : 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 100%)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
            },
          }}
        >
          {/* Coloured top bar */}
          <Box sx={{
            height: 6,
            background: 'linear-gradient(90deg, #6366f1, #3b82f6, #06b6d4)',
          }} />

          <DialogContent sx={{ pt: 3, pb: 1, px: 3 }}>
            {/* Close button */}
            <IconButton
              onClick={dismissPopup}
              size="small"
              sx={{ position: 'absolute', top: 14, right: 14, color: 'text.secondary' }}
            >
              <Close fontSize="small" />
            </IconButton>

            {/* Header */}
            <Box display="flex" alignItems="center" gap={1.5} mb={2.5}>
              <Box sx={{
                width: 44, height: 44, borderRadius: 2,
                background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <NotificationsActive sx={{ color: '#fff', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
                  Notifications
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  CL status & latest announcements
                </Typography>
              </Box>
            </Box>

            {/* CL Status section */}
            {latestCL ? (
              <Paper elevation={0} sx={{
                p: 2, mb: 2, borderRadius: 2,
                border: 1, borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06),
              }}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <InfoOutlined sx={{ fontSize: 16, color: 'primary.main' }} />
                  <Typography variant="caption" fontWeight={700} color="primary.main" textTransform="uppercase" letterSpacing={0.5}>
                    CL Approval Status
                  </Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {new Date(latestCL.fromDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' – '}
                      {new Date(latestCL.toDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {latestCL.reason.length > 50 ? latestCL.reason.slice(0, 50) + '…' : latestCL.reason}
                    </Typography>
                  </Box>
                  <Chip
                    label={clStatusLabel}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      color: clStatusColor,
                      border: 1,
                      borderColor: clStatusColor,
                      bgcolor: 'transparent',
                      ml: 1,
                    }}
                  />
                </Box>
              </Paper>
            ) : (
              <Paper elevation={0} sx={{
                p: 2, mb: 2, borderRadius: 2, border: 1, borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.action.hover, 1),
              }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  No casual leave applications found.
                </Typography>
              </Paper>
            )}

            {/* Latest Announcement section */}
            {latestAnnouncement && (
              <Paper elevation={0} sx={{
                p: 2, borderRadius: 2,
                border: 1, borderColor: 'divider',
                bgcolor: (theme) => alpha(theme.palette.info.main, 0.06),
              }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Campaign sx={{ fontSize: 16, color: 'info.main' }} />
                  <Typography variant="caption" fontWeight={700} color="info.main" textTransform="uppercase" letterSpacing={0.5}>
                    Latest Announcement
                  </Typography>
                  {!latestAnnouncement.isRead && (
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'error.main', ml: 'auto' }} />
                  )}
                </Box>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  {latestAnnouncement.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {latestAnnouncement.content.length > 100
                    ? latestAnnouncement.content.slice(0, 100) + '…'
                    : latestAnnouncement.content}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                  By {latestAnnouncement.creator?.name} · {new Date(latestAnnouncement.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Typography>
              </Paper>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 2.5, pt: 1, gap: 0.5, flexWrap: 'wrap' }}>
            <Button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              size="small"
              sx={{ borderRadius: 2, color: 'text.secondary', mr: 'auto' }}
            >
              {markAllMutation.isPending ? 'Marking…' : 'Mark all as read'}
            </Button>
            <Button
              onClick={() => { dismissPopup(); navigate('/leave'); }}
              variant="outlined"
              size="small"
              sx={{ borderRadius: 2 }}
            >
              View Leave
            </Button>
            <Button
              onClick={() => { dismissPopup(); navigate('/announcements'); }}
              variant="contained"
              size="small"
              sx={{
                borderRadius: 2,
                background: 'linear-gradient(90deg, #6366f1, #3b82f6)',
                '&:hover': { background: 'linear-gradient(90deg, #4f46e5, #2563eb)' },
              }}
            >
              View All Announcements
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };

  export default Dashboard;
