import React from 'react';
import {
  Popover, Box, Typography, IconButton, Divider, Button,
  CircularProgress, Tooltip,
} from '@mui/material';
import {
  CheckCircle, Cancel, Campaign, EventNote, HowToReg,
  NotificationsNone, DoneAll,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { QUERY_KEYS } from '../queryKeys';
import { Notification } from '../types';

const TYPE_META: Record<string, { icon: React.ReactElement; color: string }> = {
  LEAVE_APPROVED:        { icon: <CheckCircle fontSize="small" />, color: '#22c55e' },
  LEAVE_REJECTED:        { icon: <Cancel fontSize="small" />,      color: '#ef4444' },
  LEAVE_REQUEST:         { icon: <EventNote fontSize="small" />,   color: '#f59e0b' },
  LEAVE_REOPENED:        { icon: <HowToReg fontSize="small" />,    color: '#6366f1' },
  ANNOUNCEMENT:          { icon: <Campaign fontSize="small" />,    color: '#3b82f6' },
  ABSENT_NO_UNPAID_LEAVE:{ icon: <HowToReg fontSize="small" />,   color: '#f97316' },
};

const fallbackMeta = { icon: <NotificationsNone fontSize="small" />, color: '#94a3b8' };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface Props {
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const NotificationsDropdown: React.FC<Props> = ({ anchorEl, onClose }) => {
  const open = Boolean(anchorEl);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.notifications,
    queryFn: notificationsApi.getAll,
    staleTime: 30_000,
    enabled: open,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => notificationsApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationsUnreadCount });
    },
  });

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notificationsUnreadCount });
    },
  });

  const hasUnread = notifications.some((n) => !n.readAt);

  const handleItemClick = (n: Notification) => {
    if (!n.readAt) markOne.mutate(n.id);
    if (n.type === 'LEAVE_REQUEST') { navigate('/leave-approval'); onClose(); }
    else if (n.type === 'ANNOUNCEMENT') { navigate('/announcements'); onClose(); }
    else if (n.type.startsWith('LEAVE_')) { navigate('/leave'); onClose(); }
  };

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{
        paper: {
          sx: {
            width: 360,
            maxHeight: 480,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2,
            boxShadow: 8,
            mt: 0.5,
          },
        },
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Typography fontWeight={700} fontSize="0.95rem">Notifications</Typography>
        {hasUnread && (
          <Tooltip title="Mark all as read">
            <IconButton size="small" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              {markAll.isPending ? <CircularProgress size={16} /> : <DoneAll fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Divider />

      {/* List */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <NotificationsNone sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.disabled">No notifications yet</Typography>
          </Box>
        ) : (
          notifications.map((n) => {
            const meta = TYPE_META[n.type] ?? fallbackMeta;
            const unread = !n.readAt;
            return (
              <Box
                key={n.id}
                onClick={() => handleItemClick(n)}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  px: 2,
                  py: 1.25,
                  cursor: 'pointer',
                  bgcolor: unread
                    ? (t) => t.palette.mode === 'dark' ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.05)'
                    : 'transparent',
                  borderLeft: unread ? `3px solid ${meta.color}` : '3px solid transparent',
                  '&:hover': { bgcolor: (t) => t.palette.action.hover },
                  transition: 'background-color 0.15s',
                }}
              >
                {/* Icon */}
                <Box sx={{ mt: 0.25, color: meta.color, flexShrink: 0 }}>
                  {meta.icon}
                </Box>

                {/* Content */}
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    variant="body2"
                    fontWeight={unread ? 600 : 400}
                    sx={{ lineHeight: 1.35, mb: 0.25 }}
                  >
                    {n.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: 1.4,
                    }}
                  >
                    {n.body}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled', mt: 0.25, display: 'block' }}>
                    {timeAgo(n.createdAt)}
                  </Typography>
                </Box>

                {/* Unread dot */}
                {unread && (
                  <Box sx={{
                    width: 7, height: 7, borderRadius: '50%',
                    bgcolor: meta.color, flexShrink: 0, mt: 0.5,
                  }} />
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>
        <Button
          fullWidth
          size="small"
          onClick={() => { navigate('/notifications'); onClose(); }}
          sx={{ fontSize: '0.8rem' }}
        >
          View all notifications
        </Button>
      </Box>
    </Popover>
  );
};

export default NotificationsDropdown;
