import React, { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton, Chip,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert,
  Tooltip, Divider, Avatar, Autocomplete, CircularProgress,
  DialogTitle, DialogContent, DialogActions, ToggleButtonGroup, ToggleButton,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper,
  Tabs, Tab,
} from '@mui/material';
import {
  Add, Edit, Delete, LaptopMac, Monitor, Storage, Cable, DevicesOther,
  ViewList, Person, AccessTime, History,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import PageLoading from '../components/PageLoading';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { assetsApi } from '../api/assets';
import { usersApi } from '../api/users';
import { Asset, AssetType, Role } from '../types';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';
import { useAuth } from '../contexts/AuthContext';
import { QUERY_KEYS } from '../queryKeys';
import AssetHistoryTab from './AssetHistoryTab';

const ASSET_ICONS: Record<AssetType, React.ReactNode> = {
  [AssetType.LAPTOP]:    <LaptopMac />,
  [AssetType.MONITOR]:   <Monitor />,
  [AssetType.HDD]:       <Storage />,
  [AssetType.CONNECTOR]: <Cable />,
  [AssetType.OTHER]:     <DevicesOther />,
};

const ASSET_LABELS: Record<AssetType, string> = {
  [AssetType.LAPTOP]:    'Laptop',
  [AssetType.MONITOR]:   'Monitor',
  [AssetType.HDD]:       'HDD',
  [AssetType.CONNECTOR]: 'Connector',
  [AssetType.OTHER]:     'Other',
};

const emptyForm = {
  assetName: '',
  assetType: AssetType.LAPTOP,
  assetNumber: '',
  serialNumber: '',
  userId: '',
};

type ViewMode = 'by-type' | 'by-employee';
type MainTab = 'assets' | 'history';

const Assets: React.FC = () => {
  const { user: me } = useAuth();
  const isSuperAdmin = me?.role === Role.SUPER_ADMIN;
  const { showSuccess, showError } = useSnackbar();
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<MainTab>('assets');
  const [open, setOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Asset | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<Asset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewMode, setViewMode] = useState<ViewMode>('by-type');
  const [employeeHistoryId, setEmployeeHistoryId] = useState<string | null>(null);

  const { data: assets = [], isLoading, isError } = useQuery({
    queryKey: QUERY_KEYS.assets,
    queryFn: () => assetsApi.getAll(),
  });

  const { data: refList } = useQuery({
    queryKey: QUERY_KEYS.assetReferenceList,
    queryFn: assetsApi.getReferenceList,
  });

  const usedNumbers = new Set(assets.map((a) => a.assetNumber).filter((n) => n !== form.assetNumber));

  const getAssetSuggestions = (type: AssetType): string[] => {
    const all = type === AssetType.LAPTOP ? (refList?.laptops ?? []) : type === AssetType.MONITOR ? (refList?.monitors ?? []) : [];
    return all.filter((n) => !usedNumbers.has(n));
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: QUERY_KEYS.allUsers,
    queryFn: () => usersApi.getAllPages(),
  });

  const createMutation = useMutation({
    mutationFn: assetsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assetHistory() });
      handleClose();
      showSuccess('Asset created!');
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, 'Failed to create asset')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof assetsApi.update>[1] }) =>
      assetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assetHistory() });
      handleClose();
      showSuccess('Asset updated!');
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, 'Failed to update asset')),
  });

  const deleteMutation = useMutation({
    mutationFn: assetsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.assetHistory() });
      setDeleteDialog(null);
      showSuccess('Asset deleted!');
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, 'Failed to delete asset')),
  });

  const handleOpen = (asset?: Asset) => {
    if (asset) {
      setEditAsset(asset);
      setForm({
        assetName: asset.assetName,
        assetType: asset.assetType,
        assetNumber: asset.assetNumber,
        serialNumber: asset.serialNumber ?? '',
        userId: asset.userId ?? '',
      });
    } else {
      setEditAsset(null);
      setForm(emptyForm);
    }
    setOpen(true);
  };

  const handleClose = () => { setOpen(false); setEditAsset(null); setForm(emptyForm); };

  const handleSubmit = () => {
    if (!form.assetName.trim()) { showError('Asset name is required'); return; }
    if (!form.assetNumber.trim()) { showError('Asset number is required'); return; }

    if (editAsset) {
      updateMutation.mutate({
        id: editAsset.id,
        data: {
          assetName: form.assetName,
          assetType: form.assetType,
          assetNumber: form.assetNumber,
          serialNumber: form.serialNumber || undefined,
          userId: form.userId || null,
        },
      });
    } else {
      createMutation.mutate({
        assetName: form.assetName,
        assetType: form.assetType,
        assetNumber: form.assetNumber,
        serialNumber: form.serialNumber || undefined,
        userId: form.userId || undefined,
      });
    }
  };

  // Build "by employee" grouping
  const byEmployee: { userId: string | null; name: string; employeeId: string; assets: Asset[] }[] = [];
  if (viewMode === 'by-employee') {
    const unassigned: Asset[] = [];
    const map = new Map<string, { userId: string; name: string; employeeId: string; assets: Asset[] }>();

    for (const asset of assets) {
      if (!asset.userId || !asset.user) {
        unassigned.push(asset);
      } else {
        if (!map.has(asset.userId)) {
          map.set(asset.userId, {
            userId: asset.userId,
            name: asset.user.name,
            employeeId: asset.user.employeeId,
            assets: [],
          });
        }
        map.get(asset.userId)!.assets.push(asset);
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    byEmployee.push(...sorted);
    if (unassigned.length > 0) {
      byEmployee.push({ userId: null, name: 'Unassigned', employeeId: '', assets: unassigned });
    }
  }

  // Group by type for display
  const grouped = Object.values(AssetType).reduce<Record<string, Asset[]>>((acc, type) => {
    acc[type] = assets.filter((a) => a.assetType === type);
    return acc;
  }, {});

  if (isLoading) return <PageLoading />;
  if (isError) return <Box mt={2}><Alert severity="error">Failed to load assets.</Alert></Box>;

  return (
    <Box>
      <PageHeader
        title="Assets"
        subtitle="Track and manage equipment assigned to employees"
        actions={
          mainTab === 'assets' ? (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              {isSuperAdmin && (
                <ToggleButtonGroup
                  size="small"
                  value={viewMode}
                  exclusive
                  onChange={(_, v) => v && setViewMode(v)}
                >
                  <ToggleButton value="by-type" aria-label="Group by type">
                    <Tooltip title="Group by asset type">
                      <ViewList fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                  <ToggleButton value="by-employee" aria-label="Group by employee">
                    <Tooltip title="Group by employee">
                      <Person fontSize="small" />
                    </Tooltip>
                  </ToggleButton>
                </ToggleButtonGroup>
              )}
              <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>
                Add Asset
              </Button>
            </Box>
          ) : null
        }
      />

      {/* Main tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}>
          <Tab label="Assets" value="assets" />
          <Tab label="Asset History" value="history" icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* ─── Assets tab ─── */}
      {mainTab === 'assets' && (
        <>
          {assets.length === 0 ? (
            <Alert severity="info">No assets found. Click "Add Asset" to get started.</Alert>
          ) : viewMode === 'by-employee' && isSuperAdmin ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {byEmployee.map((group) => (
                <Card key={group.userId ?? '__unassigned__'} elevation={2}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                      <Avatar sx={{ bgcolor: group.userId ? 'primary.main' : 'action.disabled', width: 36, height: 36 }}>
                        {group.userId ? group.name.charAt(0).toUpperCase() : '?'}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
                          {group.name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          {group.employeeId && (
                            <Typography variant="caption" color="text.secondary">{group.employeeId}</Typography>
                          )}
                          {group.assets.length > 0 && (() => {
                            const latest = new Date(Math.max(...group.assets.map((a) => new Date(a.updatedAt).getTime())));
                            return (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                <AccessTime sx={{ fontSize: 11, color: 'text.disabled' }} />
                                <Typography variant="caption" color="text.disabled">
                                  {latest.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                                  {', '}
                                  {latest.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Typography>
                              </Box>
                            );
                          })()}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip label={`${group.assets.length} asset${group.assets.length !== 1 ? 's' : ''}`} size="small" color="primary" />
                        {group.userId && (
                          <Tooltip title="View asset history for this employee">
                            <IconButton
                              size="small"
                              color="secondary"
                              onClick={() => {
                                setEmployeeHistoryId(group.userId);
                                setMainTab('history');
                              }}
                            >
                              <History fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 1.5 }} />
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Asset No.</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Serial No.</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {group.assets.map((asset) => (
                            <TableRow key={asset.id} hover>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                  <Box sx={{ color: 'primary.main', display: 'flex' }}>{ASSET_ICONS[asset.assetType]}</Box>
                                  <Typography variant="body2">{ASSET_LABELS[asset.assetType]}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2">{asset.assetName}</Typography>
                              </TableCell>
                              <TableCell>
                                <Chip label={asset.assetNumber} size="small" sx={{ fontWeight: 600 }} />
                              </TableCell>
                              <TableCell>
                                {asset.serialNumber
                                  ? <Typography variant="body2" color="text.secondary">{asset.serialNumber}</Typography>
                                  : <Typography variant="body2" color="text.disabled">—</Typography>
                                }
                              </TableCell>
                              <TableCell align="right">
                                <Tooltip title="Edit">
                                  <IconButton size="small" color="primary" onClick={() => handleOpen(asset)}>
                                    <Edit fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {isSuperAdmin && (
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error" onClick={() => setDeleteDialog(asset)}>
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Object.values(AssetType).map((type) => {
                const items = grouped[type];
                if (items.length === 0) return null;
                return (
                  <Card key={type} elevation={2}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                          {ASSET_ICONS[type]}
                        </Avatar>
                        <Typography variant="h6">{ASSET_LABELS[type]}</Typography>
                        <Chip label={items.length} size="small" color="primary" />
                      </Box>
                      <Divider sx={{ mb: 2 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {items.map((asset) => (
                          <Box
                            key={asset.id}
                            sx={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider',
                              flexWrap: 'wrap', gap: 1,
                            }}
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, minWidth: 160 }}>
                              <Typography variant="body2" fontWeight={600}>{asset.assetNumber}</Typography>
                              {asset.serialNumber && (
                                <Typography variant="caption" color="text.secondary">S/N: {asset.serialNumber}</Typography>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {asset.user ? (
                                <Chip
                                  size="small"
                                  label={`${asset.user.name} (${asset.user.employeeId})`}
                                  color="success"
                                  variant="outlined"
                                />
                              ) : (
                                <Chip size="small" label="Unassigned" variant="outlined" />
                              )}
                              <Tooltip title="Edit">
                                <IconButton size="small" color="primary" onClick={() => handleOpen(asset)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {isSuperAdmin && (
                                <Tooltip title="Delete">
                                  <IconButton size="small" color="error" onClick={() => setDeleteDialog(asset)}>
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </>
      )}

      {/* ─── History tab ─── */}
      {mainTab === 'history' && (
        <Box>
          {employeeHistoryId && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'primary.light', bgcolor: 'action.selected' }}>
              <History color="primary" fontSize="small" />
              <Typography variant="body2">
                Showing history for: <strong>{allUsers.find((u) => u.id === employeeHistoryId)?.name ?? employeeHistoryId}</strong>
              </Typography>
              <Button
                size="small"
                variant="text"
                sx={{ ml: 'auto' }}
                onClick={() => setEmployeeHistoryId(null)}
              >
                Show All
              </Button>
            </Box>
          )}
          <AssetHistoryTab filterUserId={employeeHistoryId ?? undefined} />
        </Box>
      )}

      {/* Add / Edit Dialog */}
      <ResponsiveDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>{editAsset ? 'Edit Asset' : 'Add New Asset'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Asset Type</InputLabel>
                <Select
                  value={form.assetType}
                  label="Asset Type"
                  onChange={(e) => setForm({ ...form, assetType: e.target.value as AssetType })}
                >
                  {Object.values(AssetType).map((t) => (
                    <MenuItem key={t} value={t}>{ASSET_LABELS[t]}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Asset Name"
                value={form.assetName}
                onChange={(e) => setForm({ ...form, assetName: e.target.value })}
                required
              />
              <Autocomplete
                freeSolo
                options={getAssetSuggestions(form.assetType)}
                value={form.assetNumber}
                onInputChange={(_, val) => setForm({ ...form, assetNumber: val })}
                renderInput={(params) => (
                  <TextField {...params} label="Asset Number" required placeholder="Select or type" />
                )}
              />
              <TextField
                label="Serial Number"
                value={form.serialNumber}
                onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
              />
            </Box>
            <Autocomplete
              options={allUsers}
              getOptionLabel={(u) => `${u.name} (${u.employeeId})`}
              value={allUsers.find((u) => u.id === form.userId) ?? null}
              onChange={(_, val) => setForm({ ...form, userId: val?.id ?? '' })}
              renderInput={(params) => <TextField {...params} label="Assign to Employee (optional)" />}
              clearOnEscape
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending ? <CircularProgress size={20} /> : editAsset ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      {/* Delete Confirm Dialog */}
      <ResponsiveDialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Asset</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteDialog?.assetNumber}</strong>? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button
            variant="contained" color="error"
            disabled={deleteMutation.isPending}
            onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog.id)}
          >
            Delete
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default Assets;
