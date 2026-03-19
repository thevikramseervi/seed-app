import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Chip,
  Container,
  Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  CalendarMonth,
  ListAlt,
  BeachAccess,
  Receipt,
  Campaign,
  People,
  EventNote,
  Settings,
  Lock,
  Logout,
  Notifications,
  AssignmentTurnedIn,
  Assessment,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useThemeMode } from '../contexts/ThemeModeContext';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications';
import { QUERY_KEYS } from '../queryKeys';
import ChangePasswordDialog from '../components/ChangePasswordDialog';
import { Role } from '../types';

const drawerWidthExpanded = 260;
const drawerWidthCollapsed = 88;

interface NavItem {
  title: string;
  path: string;
  icon: React.ReactElement;
  roles?: Role[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'MAIN',
    items: [
      { title: 'Dashboard', path: '/', icon: <Dashboard /> },
      { title: 'Attendance', path: '/attendance', icon: <CalendarMonth /> },
      { title: 'Activity Report', path: '/activity', icon: <ListAlt /> },
      { title: 'Leave', path: '/leave', icon: <BeachAccess /> },
      { title: 'Salary Slips', path: '/salary-slips', icon: <Receipt /> },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { title: 'Announcements', path: '/announcements', icon: <Campaign /> },
      { title: 'Holidays', path: '/holidays', icon: <EventNote /> },
      {
        title: 'Leave Approval',
        path: '/leave-approval',
        icon: <AssignmentTurnedIn />,
        roles: [Role.LAB_ADMIN, Role.SUPER_ADMIN],
      },
      {
        title: 'Reports',
        path: '/reports',
        icon: <Assessment />,
        roles: [Role.LAB_ADMIN, Role.SUPER_ADMIN],
      },
      {
        title: 'Users',
        path: '/users',
        icon: <People />,
        roles: [Role.LAB_ADMIN, Role.SUPER_ADMIN],
      },
      {
        title: 'Admin',
        path: '/admin',
        icon: <Settings />,
        roles: [Role.LAB_ADMIN, Role.SUPER_ADMIN],
      },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

/* Theme-aware sidebar palette */
const sidebarPalettes = {
  dark: {
    bg: '#0B1120',
    text: '#94A3B8',
    textActive: '#FFFFFF',
    hover: 'rgba(148,163,184,0.08)',
    activeBg: 'rgba(99,102,241,0.18)',
    sectionLabel: '#475569',
    brandText: '#F1F5F9',
    divider: 'rgba(148,163,184,0.12)',
  },
  light: {
    bg: '#1E293B',
    text: '#94A3B8',
    textActive: '#FFFFFF',
    hover: 'rgba(255,255,255,0.06)',
    activeBg: 'rgba(99,102,241,0.25)',
    sectionLabel: '#64748B',
    brandText: '#F1F5F9',
    divider: 'rgba(255,255,255,0.08)',
  },
};

const DashboardLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const sp = sidebarPalettes[mode];

  const { data: unreadData } = useQuery({
    queryKey: QUERY_KEYS.notificationsUnreadCount,
    queryFn: notificationsApi.getUnreadCount,
    staleTime: 60_000,
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDesktopSidebarToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isPathActive = (itemPath: string) => {
    if (itemPath === '/') {
      return location.pathname === '/';
    }
    return location.pathname === itemPath || location.pathname.startsWith(`${itemPath}/`);
  };

  useEffect(() => {
    const activeTitle =
      allNavItems.find((item) => isPathActive(item.path))?.title ?? 'Dashboard';
    document.title = `SEED LAB– ${activeTitle}`;
  }, [location.pathname]);

  const effectiveDrawerWidth = sidebarCollapsed ? drawerWidthCollapsed : drawerWidthExpanded;

  const filteredSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles) return true;
        if (!user) return false;
        return item.roles.includes(user.role as Role);
      }),
    }))
    .filter((section) => section.items.length > 0);

  const unreadCount = unreadData?.unreadCount ?? 0;

  const drawer = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: sp.bg,
        color: sp.text,
        overflow: 'hidden',
      }}
    >
      {/* Brand / Logo — click to toggle sidebar */}
      <Box
        onClick={handleDesktopSidebarToggle}
        sx={{
          px: sidebarCollapsed ? 1.5 : 2.5,
          py: 2.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
          cursor: 'pointer',
          userSelect: 'none',
          borderRadius: 2,
          mx: 1,
          transition: 'background-color 0.15s',
          '&:hover': { bgcolor: sp.hover },
        }}
      >
        <Avatar
          src="/seed-logo.png"
          alt="SEED LAB"
          variant="circular"
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            bgcolor: '#fff',
            border: '2px solid',
            borderColor: 'rgba(99,102,241,0.4)',
            p: '4px',
            '& img': { objectFit: 'contain' },
          }}
        />
        {!sidebarCollapsed && (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h6"
              noWrap
              fontWeight={700}
              sx={{ color: sp.brandText, letterSpacing: -0.3, lineHeight: 1.2 }}
            >
              SEED LAB
            </Typography>
            <Typography
              variant="caption"
              noWrap
              sx={{
                color: sp.sectionLabel,
                fontWeight: 600,
                letterSpacing: 1.5,
                fontSize: '0.6rem',
              }}
            >
              WORKSPACE
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation sections */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pb: 2 }}>
        {filteredSections.map((section) => (
          <Box key={section.label}>
            {!sidebarCollapsed && (
              <Typography
                variant="caption"
                sx={{
                  px: 1,
                  pt: 2.5,
                  pb: 1,
                  display: 'block',
                  color: sp.sectionLabel,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  fontSize: '0.65rem',
                }}
              >
                {section.label}
              </Typography>
            )}
            {sidebarCollapsed && (
              <Divider sx={{ my: 1.5, borderColor: sp.divider }} />
            )}
            <List disablePadding>
              {section.items.map((item) => {
                const isActive = isPathActive(item.path);
                const showBadge = item.path === '/announcements' && unreadCount > 0;
                return (
                  <ListItem key={item.title} disablePadding sx={{ mb: 0.25 }}>
                    <ListItemButton
                      onClick={() => {
                        navigate(item.path);
                        setMobileOpen(false);
                      }}
                      sx={{
                        borderRadius: 2,
                        py: 1,
                        px: sidebarCollapsed ? 1.25 : 1.5,
                        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                        color: isActive ? sp.textActive : sp.text,
                        bgcolor: isActive ? sp.activeBg : 'transparent',
                        '&:hover': {
                          bgcolor: isActive ? sp.activeBg : sp.hover,
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          color: isActive ? sp.textActive : sp.text,
                          minWidth: sidebarCollapsed ? 0 : 36,
                          mr: sidebarCollapsed ? 0 : 1.5,
                          justifyContent: 'center',
                          '& .MuiSvgIcon-root': { fontSize: 20 },
                        }}
                      >
                        {showBadge ? (
                          <Badge
                            color="primary"
                            variant="dot"
                            sx={{ '& .MuiBadge-dot': { width: 8, height: 8, borderRadius: '50%' } }}
                          >
                            {item.icon}
                          </Badge>
                        ) : (
                          item.icon
                        )}
                      </ListItemIcon>
                      {!sidebarCollapsed && (
                        <ListItemText
                          primary={item.title}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: isActive ? 600 : 400,
                          }}
                        />
                      )}
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${effectiveDrawerWidth}px)` },
          ml: { sm: `${effectiveDrawerWidth}px` },
          transition: (theme) => theme.transitions.create(['margin', 'width']),
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar>
          {/* Mobile-only hamburger (sidebar is toggled via logo click on desktop) */}
          <Tooltip title="Open menu">
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { xs: 'inline-flex', sm: 'none' } }}
              aria-label="Open menu"
            >
              <MenuIcon />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {allNavItems.find((item) => isPathActive(item.path))?.title || 'Dashboard'}
          </Typography>

          <Tooltip title="Notifications">
            <IconButton
              color="inherit"
              sx={{ mr: 1 }}
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
            >
              <Badge badgeContent={unreadData?.unreadCount ?? 0} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              color="inherit"
              onClick={toggleMode}
              sx={{ mr: 1 }}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {mode === 'dark' ? <Brightness7 /> : <Brightness4 />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Account menu">
            <IconButton onClick={handleMenuOpen} sx={{ p: 0 }} aria-label="Account menu">
              <Avatar
                sx={{
                  bgcolor: 'primary.main',
                  width: 40,
                  height: 40,
                }}
              >
                {user?.name.charAt(0).toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <Box sx={{ px: 2, py: 1, minWidth: 200 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {user?.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
              <Chip
                label={user?.role.replace('_', ' ')}
                size="small"
                color="primary"
                sx={{ mt: 1 }}
              />
            </Box>
            <Divider />
            <MenuItem
              onClick={() => {
                navigate('/profile');
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <Settings fontSize="small" />
              </ListItemIcon>
              My profile
            </MenuItem>
            <MenuItem
              onClick={() => {
                setChangePasswordOpen(true);
                handleMenuClose();
              }}
            >
              <ListItemIcon>
                <Lock fontSize="small" />
              </ListItemIcon>
              Change password
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
          <ChangePasswordDialog
            open={changePasswordOpen}
            onClose={() => setChangePasswordOpen(false)}
          />
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { sm: effectiveDrawerWidth },
          flexShrink: { sm: 0 },
          overflow: 'hidden',
          transition: (theme) => theme.transitions.create('width'),
        }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 260,
              bgcolor: sp.bg,
              border: 'none',
              borderRadius: 0,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: effectiveDrawerWidth,
              bgcolor: sp.bg,
              border: 'none',
              borderRadius: 0,
              transition: (theme) =>
                theme.transitions.create('width', {
                  duration: theme.transitions.duration.standard,
                }),
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${effectiveDrawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          minWidth: 0,
          overflowX: 'hidden',
          transition: (theme) => theme.transitions.create('width'),
        }}
      >
        <Toolbar />
        <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 3 } }}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
};

export default DashboardLayout;
