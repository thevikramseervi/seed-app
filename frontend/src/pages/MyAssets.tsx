import React, { useState } from 'react';
import {
  Box, Card, Typography, Button, IconButton, Chip,
  TextField, Divider, CircularProgress, DialogTitle,
  DialogContent, DialogActions, Autocomplete, Tabs, Tab,
} from '@mui/material';
import {
  Edit, SaveOutlined, LaptopMac, Monitor, Storage, Cable,
  DevicesOther, AccessTime, AddCircleOutline, History,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../components/PageHeader';
import PageLoading from '../components/PageLoading';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { assetsApi } from '../api/assets';
import { useAuth } from '../contexts/AuthContext';
import { Asset, AssetType, Role } from '../types';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';
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
  [AssetType.LAPTOP]:    'Laptop (Yellow Sticker)',
  [AssetType.MONITOR]:   'Monitor (Orange Sticker)',
  [AssetType.HDD]:       'HDD (Green Sticker)',
  [AssetType.CONNECTOR]: 'Honeywell',
  [AssetType.OTHER]:     'Other',
};

const DISPLAY_TYPES = [AssetType.LAPTOP, AssetType.MONITOR, AssetType.HDD, AssetType.CONNECTOR];

type RowDraft = { assetNumber: string; serialNumber: string };
type MainTab = 'assets' | 'history';

const MyAssets: React.FC = () => {
  const { user } = useAuth();
  const canEdit = user?.role !== Role.EMPLOYEE;
  const { showSuccess, showError } = useSnackbar();
  const queryClient = useQueryClient();

  const [mainTab, setMainTab] = useState<MainTab>('assets');

  // Dialog state (for assigned assets edit)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');
  const [assetNumberInput, setAssetNumberInput] = useState('');
  const [serialInput, setSerialInput] = useState('');

  // Inline drafts for unassigned rows
  const [drafts, setDrafts] = useState<Partial<Record<AssetType, RowDraft>>>({});

  const { data: assets = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.myAssets,
    queryFn: assetsApi.getMy,
  });

  const { data: refList } = useQuery({
    queryKey: QUERY_KEYS.assetReferenceList,
    queryFn: assetsApi.getReferenceList,
  });

  const usedNumbers = new Set(assets.map((a) => a.assetNumber));

  const getSuggestions = (type: AssetType | undefined, excludeOwn?: string): string[] => {
    if (!type) return [];
    const all = type === AssetType.LAPTOP ? (refList?.laptops ?? []) : type === AssetType.MONITOR ? (refList?.monitors ?? []) : [];
    return all.filter((n) => n === excludeOwn || !usedNumbers.has(n));
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, assetNumber, serialNumber }: { id: string; assetNumber: string; serialNumber: string | null }) =>
      assetsApi.updateMy(id, { assetNumber, serialNumber: serialNumber ?? undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myAssets }),
    onError: (e: unknown) => showError(getApiErrorMessage(e, 'Failed to update asset')),
  });

  const createMutation = useMutation({
    mutationFn: assetsApi.createMy,
    onSuccess: (_saved, vars) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myAssets });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myAssetHistory });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[vars.assetType as AssetType];
        return next;
      });
      showSuccess('Asset saved!');
    },
    onError: (e: unknown) => showError(getApiErrorMessage(e, 'Failed to save asset')),
  });

  const openEditDialog = (asset: Asset) => {
    setSelectedAssetId(asset.id);
    setAssetNumberInput(asset.assetNumber);
    setSerialInput(asset.serialNumber ?? '');
    setEditDialogOpen(true);
  };

  const handleDialogUpdate = () => {
    if (!selectedAssetId) return;
    updateMutation.mutate(
      { id: selectedAssetId, assetNumber: assetNumberInput.trim(), serialNumber: serialInput.trim() || null },
      {
        onSuccess: () => {
          setEditDialogOpen(false);
          showSuccess('Asset updated!');
        },
      },
    );
  };

  const handleSaveDraft = (type: AssetType) => {
    const draft = drafts[type];
    if (!draft?.assetNumber.trim()) { showError('Asset number is required'); return; }
    createMutation.mutate({
      assetType: type,
      assetNumber: draft.assetNumber.trim(),
      serialNumber: draft.serialNumber.trim() || undefined,
    });
  };

  const handleSaveAll = () => {
    const types = DISPLAY_TYPES.filter((t) => drafts[t]?.assetNumber.trim());
    if (types.length === 0) { showSuccess('No pending changes.'); return; }
    types.forEach(handleSaveDraft);
  };

  const assetByType = assets.reduce<Partial<Record<AssetType, Asset>>>((acc, a) => {
    acc[a.assetType] = a;
    return acc;
  }, {});

  const lastUpdated = assets.length > 0
    ? new Date(Math.max(...assets.map((a) => new Date(a.updatedAt).getTime())))
    : null;

  const selectedAsset = assets.find((a) => a.id === selectedAssetId);

  if (isLoading) return <PageLoading />;

  return (
    <Box>
      <PageHeader
        title="Assets Data"
        subtitle="View and update your assigned equipment"
        actions={
          mainTab === 'assets' && canEdit ? (
            <Button variant="contained" startIcon={<SaveOutlined />} onClick={handleSaveAll}>
              Save All
            </Button>
          ) : null
        }
      />

      {/* Main tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)}>
          <Tab label="My Assets" value="assets" />
          <Tab label="History" value="history" icon={<History sx={{ fontSize: 16 }} />} iconPosition="start" />
        </Tabs>
      </Box>

      {/* ─── My Assets tab ─── */}
      {mainTab === 'assets' && (
        <Card elevation={2} sx={{ overflow: 'hidden' }}>
          {DISPLAY_TYPES.map((type, idx) => {
            const assigned = assetByType[type];
            const draft = drafts[type] ?? { assetNumber: '', serialNumber: '' };

            return (
              <React.Fragment key={type}>
                {idx > 0 && <Divider />}

                <Box sx={{ px: 2.5, pt: 2, pb: 2.5 }}>
                  {/* Top row: icon + name + edit/add button */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 42, height: 42, borderRadius: 2.5,
                        bgcolor: (theme) =>
                          theme.palette.mode === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, color: 'primary.main', '& svg': { fontSize: 22 },
                      }}
                    >
                      {ASSET_ICONS[type]}
                    </Box>

                    <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
                      {ASSET_LABELS[type]}
                    </Typography>

                    {canEdit && (
                      assigned ? (
                        <IconButton size="small" onClick={() => openEditDialog(assigned)} sx={{ color: 'primary.main' }}>
                          <Edit sx={{ fontSize: 18 }} />
                        </IconButton>
                      ) : (
                        <IconButton
                          size="small"
                          onClick={() => handleSaveDraft(type)}
                          sx={{ color: 'primary.main' }}
                          disabled={createMutation.isPending}
                        >
                          {createMutation.isPending ? <CircularProgress size={16} /> : <AddCircleOutline sx={{ fontSize: 18 }} />}
                        </IconButton>
                      )
                    )}
                  </Box>

                  {/* Detail rows */}
                  <Box sx={{ ml: '54px', display: 'flex', flexDirection: 'column' }}>
                    {/* Asset Number */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.75rem' }}>
                        Asset Number
                      </Typography>
                      {assigned ? (
                        <Chip
                          label={assigned.assetNumber}
                          size="small"
                          sx={{
                            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.06)',
                            fontWeight: 600, fontSize: '0.72rem', height: 24, border: 'none', color: 'text.primary',
                          }}
                        />
                      ) : (
                        canEdit ? (
                          <Autocomplete
                            freeSolo
                            size="small"
                            options={getSuggestions(type)}
                            value={draft.assetNumber}
                            onInputChange={(_, val) => setDrafts((p) => ({ ...p, [type]: { ...draft, assetNumber: val } }))}
                            sx={{ width: 200 }}
                            renderInput={(params) => (
                              <TextField {...params} placeholder="Select or type asset no." />
                            )}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )
                      )}
                    </Box>

                    <Divider />

                    {/* Serial Number */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.75rem' }}>
                        Serial Number
                      </Typography>
                      {assigned ? (
                        assigned.serialNumber ? (
                          <Chip
                            label={assigned.serialNumber}
                            size="small"
                            sx={{
                              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(148,163,184,0.12)' : 'rgba(0,0,0,0.06)',
                              fontWeight: 600, fontSize: '0.72rem', height: 24, border: 'none', color: 'text.primary',
                            }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )
                      ) : (
                        canEdit ? (
                          <TextField
                            size="small"
                            placeholder="e.g. C02XM45NJG5H"
                            value={draft.serialNumber}
                            onChange={(e) => setDrafts((p) => ({ ...p, [type]: { ...draft, serialNumber: e.target.value } }))}
                            sx={{ width: 180 }}
                            slotProps={{ input: { style: { fontSize: '0.78rem', padding: '4px 8px' } } }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )
                      )}
                    </Box>
                  </Box>
                </Box>
              </React.Fragment>
            );
          })}

          {/* Footer */}
          {lastUpdated && (
            <>
              <Divider />
              <Box sx={{ px: 2.5, py: 1.25, display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <AccessTime sx={{ fontSize: 14, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled" sx={{ letterSpacing: 0.3 }}>
                  LAST UPDATED:{' '}
                  {lastUpdated.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}
                  {', '}
                  {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
            </>
          )}
        </Card>
      )}

      {/* ─── History tab ─── */}
      {mainTab === 'history' && (
        <AssetHistoryTab isMine />
      )}

      {/* Edit Dialog */}
      <ResponsiveDialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Edit Asset Details
          {selectedAsset && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box component="span" sx={{ display: 'inline-flex', verticalAlign: 'middle', mr: 0.5, color: 'primary.main', '& svg': { fontSize: 16 } }}>
                {ASSET_ICONS[selectedAsset.assetType]}
              </Box>
              {ASSET_LABELS[selectedAsset.assetType]}
            </Typography>
          )}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ pt: 1.5, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Autocomplete
              freeSolo
              options={getSuggestions(selectedAsset?.assetType, selectedAsset?.assetNumber)}
              value={assetNumberInput}
              onInputChange={(_, val) => setAssetNumberInput(val)}
              renderInput={(params) => (
                <TextField {...params} label="Asset Number" placeholder="Select or type asset number" fullWidth />
              )}
            />

            <TextField
              label="Serial Number"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder="e.g. C02XM45NJG5H"
              fullWidth
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleDialogUpdate} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <CircularProgress size={20} /> : 'Update'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  );
};

export default MyAssets;
