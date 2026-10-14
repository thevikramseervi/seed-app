import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Tooltip,
  Checkbox,
  FormControlLabel,
  Divider,
  Autocomplete,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import PageHeader from '../components/PageHeader';
import { DataGrid, GridColDef, GridColumnVisibilityModel } from '@mui/x-data-grid';
import { Add, Edit, Block, CheckCircle, FileDownload } from '@mui/icons-material';
import { usersApi } from '../api/users';
import { assetsApi } from '../api/assets';
import { User, Role, UserStatus, AssetType, Asset } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { getApiErrorMessage } from '../hooks/apiMessages';
import PageLoading from '../components/PageLoading';
import MobileTableCard from '../components/MobileTableCard';
import ResponsiveDialog from '../components/ResponsiveDialog';
import { QUERY_KEYS } from '../queryKeys';

const Users: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user: authUser } = useAuth();
  const isSuperAdmin = authUser?.role === Role.SUPER_ADMIN;
  const { showSuccess, showError } = useSnackbar();
  const [open, setOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    mode: 'activate' | 'deactivate' | null;
    user: User | null;
    hasLeft: boolean;
    leavingDate: string;
  }>({ open: false, mode: null, user: null, hasLeft: true, leavingDate: '' });
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    employeeId: '',
    employeeNumber: '',
    name: '',
    email: '',
    password: '',
    designation: 'Annotator',
    role: Role.EMPLOYEE,
    dateOfJoining: '',
    dateOfLeaving: '',
    baseSalary: '22000',
  });

  const ASSET_OPTIONS: { type: AssetType; label: string; prefix: string }[] = [
    { type: AssetType.LAPTOP,    label: 'Laptop',     prefix: 'LT' },
    { type: AssetType.MONITOR,   label: 'Monitor',    prefix: 'MN' },
    { type: AssetType.HDD,       label: 'Hard Disk',  prefix: 'HD' },
    { type: AssetType.CONNECTOR, label: 'Connector',  prefix: 'CN' },
  ];

  const emptyAssetSelections = () =>
    Object.fromEntries(
      ASSET_OPTIONS.map(({ type }) => [type, { checked: false, assetNumber: '', serialNumber: '' }]),
    ) as Record<AssetType, { checked: boolean; assetNumber: string; serialNumber: string }>;

  const [assetSelections, setAssetSelections] = useState(emptyAssetSelections);

  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });

  const [columnVisibilityModel, setColumnVisibilityModel] = useState<GridColumnVisibilityModel>({
    // Asset columns hidden by default
    laptopAssetNo:    false,
    laptopSN:         false,
    monitorAssetNo:   false,
    monitorSN:        false,
    hddAssetNo:       false,
    hddSN:            false,
    connectorAssetNo: false,
    connectorSN:      false,
  });

  const exportToExcel = async () => {
    // Fetch all users + all assets for export
    const [allUsers, allAssets] = await Promise.all([
      usersApi.getAllPages(),
      assetsApi.getAll(),
    ]);

    const exportAssetMap = new Map<string, Asset[]>();
    for (const a of allAssets) {
      if (!a.userId) continue;
      if (!exportAssetMap.has(a.userId)) exportAssetMap.set(a.userId, []);
      exportAssetMap.get(a.userId)!.push(a);
    }

    type ExportRow = User & Record<string, string | number>;
    const rows: ExportRow[] = allUsers.map((u) => {
      const assets = exportAssetMap.get(u.id) ?? [];
      const byType = (t: AssetType) => assets.find((a) => a.assetType === t);
      return {
        ...u,
        laptopAssetNo:    byType(AssetType.LAPTOP)?.assetNumber    ?? '',
        laptopSN:         byType(AssetType.LAPTOP)?.serialNumber   ?? '',
        monitorAssetNo:   byType(AssetType.MONITOR)?.assetNumber   ?? '',
        monitorSN:        byType(AssetType.MONITOR)?.serialNumber  ?? '',
        hddAssetNo:       byType(AssetType.HDD)?.assetNumber       ?? '',
        hddSN:            byType(AssetType.HDD)?.serialNumber      ?? '',
        connectorAssetNo: byType(AssetType.CONNECTOR)?.assetNumber ?? '',
        connectorSN:      byType(AssetType.CONNECTOR)?.serialNumber ?? '',
      };
    });

    const allFields: { field: string; header: string; getValue: (u: ExportRow) => string | number }[] = [
      { field: 'employeeNumber', header: 'Emp No',              getValue: (u) => u.employeeNumber },
      { field: 'employeeId',     header: 'Employee ID',         getValue: (u) => u.employeeId },
      { field: 'name',           header: 'Name',                getValue: (u) => u.name },
      { field: 'email',          header: 'Email',               getValue: (u) => u.email },
      { field: 'designation',    header: 'Designation',         getValue: (u) => u.designation },
      { field: 'role',           header: 'Role',                getValue: (u) => (u.role as string).replace('_', ' ') },
      { field: 'status',         header: 'Status',              getValue: (u) => u.status === UserStatus.ACTIVE ? 'Active' : u.dateOfLeaving ? 'Left Organization' : 'Inactive' },
      { field: 'baseSalary',     header: 'Base Salary',         getValue: (u) => u.baseSalary },
      { field: 'dateOfJoining',  header: 'Date of Joining',     getValue: (u) => u.dateOfJoining ? new Date(u.dateOfJoining as string).toLocaleDateString('en-IN') : '-' },
      { field: 'dateOfLeaving',  header: 'Date of Leaving',     getValue: (u) => u.dateOfLeaving ? new Date(u.dateOfLeaving as string).toLocaleDateString('en-IN') : '-' },
      // Asset columns
      { field: 'laptopAssetNo',    header: 'Laptop Asset No',      getValue: (u) => u.laptopAssetNo    as string },
      { field: 'laptopSN',         header: 'Laptop S/N',           getValue: (u) => u.laptopSN         as string },
      { field: 'monitorAssetNo',   header: 'Monitor Asset No',     getValue: (u) => u.monitorAssetNo   as string },
      { field: 'monitorSN',        header: 'Monitor S/N',          getValue: (u) => u.monitorSN        as string },
      { field: 'hddAssetNo',       header: 'HDD Asset No',         getValue: (u) => u.hddAssetNo       as string },
      { field: 'hddSN',            header: 'HDD S/N',              getValue: (u) => u.hddSN            as string },
      { field: 'connectorAssetNo', header: 'Connector Asset No',   getValue: (u) => u.connectorAssetNo as string },
      { field: 'connectorSN',      header: 'Connector S/N',        getValue: (u) => u.connectorSN      as string },
    ];

    const visibleFields = allFields.filter((f) => columnVisibilityModel[f.field] !== false);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Users');
    ws.columns = visibleFields.map((f) => ({ header: f.header, key: f.field, width: 20 }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((u) => {
      ws.addRow(Object.fromEntries(visibleFields.map((f) => [f.field, f.getValue(u)])));
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users_with_assets.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEYS.users(paginationModel.page, paginationModel.pageSize),
    queryFn: () =>
      usersApi.getPage({
        page: paginationModel.page + 1,
        limit: paginationModel.pageSize,
      }),
    placeholderData: keepPreviousData,
  });

  const users = data?.data ?? [];
  const totalUsers = data?.meta?.total ?? 0;

  // Fetch all assets to join into grid rows (admin only)
  const { data: allAssetsData = [] } = useQuery({
    queryKey: QUERY_KEYS.assets,
    queryFn: () => assetsApi.getAll(),
    enabled: isSuperAdmin,
  });

  // Asset number reference lists for autocomplete dropdowns
  const { data: assetRefList } = useQuery({
    queryKey: QUERY_KEYS.assetReferenceList,
    queryFn: assetsApi.getReferenceList,
    enabled: isSuperAdmin,
    staleTime: Infinity,
  });
  const laptopOptions = assetRefList?.laptops ?? [];
  const hddOptions: string[] = [];
  const monitorOptions = assetRefList?.monitors ?? [];

  const assetsByUserId = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const a of allAssetsData) {
      if (!a.userId) continue;
      if (!map.has(a.userId)) map.set(a.userId, []);
      map.get(a.userId)!.push(a);
    }
    return map;
  }, [allAssetsData]);

  type EnrichedUser = User & {
    laptopAssetNo: string; laptopSN: string;
    monitorAssetNo: string; monitorSN: string;
    hddAssetNo: string; hddSN: string;
    connectorAssetNo: string; connectorSN: string;
  };

  const enrichedUsers: EnrichedUser[] = useMemo(() => users.map((u) => {
    const assets = assetsByUserId.get(u.id) ?? [];
    const byType = (t: AssetType) => assets.find((a) => a.assetType === t);
    return {
      ...u,
      laptopAssetNo:    byType(AssetType.LAPTOP)?.assetNumber    ?? '',
      laptopSN:         byType(AssetType.LAPTOP)?.serialNumber   ?? '',
      monitorAssetNo:   byType(AssetType.MONITOR)?.assetNumber   ?? '',
      monitorSN:        byType(AssetType.MONITOR)?.serialNumber  ?? '',
      hddAssetNo:       byType(AssetType.HDD)?.assetNumber       ?? '',
      hddSN:            byType(AssetType.HDD)?.serialNumber      ?? '',
      connectorAssetNo: byType(AssetType.CONNECTOR)?.assetNumber ?? '',
      connectorSN:      byType(AssetType.CONNECTOR)?.serialNumber ?? '',
    };
  }), [users, assetsByUserId]);

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: async (newUser) => {
      const selected = ASSET_OPTIONS.filter(
        ({ type }) => assetSelections[type]?.checked && assetSelections[type]?.assetNumber.trim(),
      );
      for (const { type, label } of selected) {
        const { assetNumber, serialNumber } = assetSelections[type];
        await assetsApi.create({
          assetName: label,
          assetType: type,
          assetNumber: assetNumber.trim(),
          serialNumber: serialNumber.trim() || undefined,
          userId: newUser.id,
        });
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users() });
      handleClose();
      showSuccess('User created successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to create user'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) =>
      usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users() });
      handleClose();
      showSuccess('User updated successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to update user'));
    },
  });

  const activateMutation = useMutation({
    mutationFn: usersApi.activate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users() });
      showSuccess('User activated successfully!');
    },
    onError: (error: unknown) => {
      showError(getApiErrorMessage(error, 'Failed to activate user'));
    },
  });

  const handleClose = () => {
    setOpen(false);
    setEditUser(null);
    setFormData({
      employeeId: '',
      employeeNumber: '',
      name: '',
      email: '',
      password: '',
      designation: 'Annotator',
      role: Role.EMPLOYEE,
      dateOfJoining: '',
      dateOfLeaving: '',
      baseSalary: '22000',
    });
    setAssetSelections(emptyAssetSelections());
  };

  const handleOpen = (user?: User) => {
    if (user) {
      setEditUser(user);
      setFormData({
        employeeId: user.employeeId,
        employeeNumber: user.employeeNumber.toString(),
        name: user.name,
        email: user.email,
        password: '',
        designation: user.designation,
        role: user.role,
        dateOfJoining: user.dateOfJoining.split('T')[0],
        dateOfLeaving: user.dateOfLeaving ? user.dateOfLeaving.split('T')[0] : '',
        baseSalary: user.baseSalary.toString(),
      });
    } else {
      // Autofill next employee number and ID when creating a new user
      const maxEmpNumber =
        users && users.length > 0
          ? users.reduce((max: number, u: User) => Math.max(max, u.employeeNumber), 0)
          : 0;
      const nextEmpNumber = maxEmpNumber + 1;
      const nextEmpId = `CITSEED${nextEmpNumber}`;

      setEditUser(null);
      setFormData({
        employeeId: nextEmpId,
        employeeNumber: nextEmpNumber.toString(),
        name: '',
        email: '',
        password: '',
        designation: 'Annotator',
        role: Role.EMPLOYEE,
        dateOfJoining: '',
        dateOfLeaving: '',
        baseSalary: '22000',
      });
    }
    setOpen(true);
  };

  const handleSubmit = () => {
    const salary = parseFloat(formData.baseSalary);
    if (!formData.name.trim()) {
      showError('Name is required');
      return;
    }
    if (isNaN(salary) || salary <= 0) {
      showError('Please enter a valid base salary');
      return;
    }
    if (editUser) {
      updateMutation.mutate({
        id: editUser.id,
        data: {
          name: formData.name,
          designation: formData.designation,
          role: formData.role,
          baseSalary: salary,
          dateOfLeaving: formData.dateOfLeaving || undefined,
        },
      });
    } else {
      if (!formData.email.trim()) {
        showError('Email is required');
        return;
      }
      if (!formData.password.trim()) {
        showError('Password is required');
        return;
      }
      if (!formData.dateOfJoining) {
        showError('Date of joining is required');
        return;
      }
      const empNum = parseInt(formData.employeeNumber, 10);
      if (!Number.isFinite(empNum) || empNum <= 0) {
        showError('Please enter a valid employee number');
        return;
      }
      const missingAssetNumber = ASSET_OPTIONS.find(
        ({ type }) => assetSelections[type]?.checked && !assetSelections[type]?.assetNumber.trim(),
      );
      if (missingAssetNumber) {
        showError(`Asset Number is required for ${missingAssetNumber.label}`);
        return;
      }
      createMutation.mutate({
        employeeId: formData.employeeId,
        employeeNumber: empNum,
        name: formData.name,
        email: formData.email,
        password: formData.password,
        designation: formData.designation,
        role: formData.role,
        dateOfJoining: formData.dateOfJoining,
        baseSalary: salary,
      });
    }
  };

  const handleConfirmClose = () => {
    setConfirmDialog({ open: false, mode: null, user: null, hasLeft: true, leavingDate: '' });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.mode) return;
    if (confirmDialog.mode === 'deactivate') {
      if (confirmDialog.hasLeft && !confirmDialog.leavingDate) {
        showError('Please select the date of leaving.');
        return;
      }

      updateMutation.mutate({
        id: confirmDialog.user.id,
        data: {
          status: UserStatus.INACTIVE,
          dateOfLeaving: confirmDialog.hasLeft ? confirmDialog.leavingDate : undefined,
        },
      });
      handleConfirmClose();
    } else {
      activateMutation.mutate(confirmDialog.user.id);
      handleConfirmClose();
    }
  };

  const columns: GridColDef[] = [
    { field: 'employeeNumber', headerName: 'Emp No', width: 90 },
    { field: 'employeeId', headerName: 'Employee ID', width: 130 },
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'email', headerName: 'Email', width: 220 },
    { field: 'designation', headerName: 'Designation', width: 130 },
    {
      field: 'role',
      headerName: 'Role',
      width: 130,
      renderCell: (params) => (
        <Chip label={(params.value as string | undefined)?.replace('_', ' ') ?? ''} color="primary" size="small" />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => {
        const isActive = params.value === UserStatus.ACTIVE;
        const hasLeft = !!params.row.dateOfLeaving;
        const label = isActive ? 'Active' : hasLeft ? 'Left Organization' : 'Inactive';
        const color = isActive ? 'success' : hasLeft ? 'error' : 'default';
        return <Chip label={label} color={color} size="small" />;
      },
    },
    {
      field: 'baseSalary',
      headerName: 'Base Salary',
      width: 120,
      renderCell: (params) => `₹${Number(params.value).toLocaleString()}`,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit user">
            <IconButton size="small" color="primary" onClick={() => handleOpen(params.row)} aria-label="Edit user">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.status === UserStatus.ACTIVE ? (
            <Tooltip title="Deactivate user">
              <IconButton
                size="small"
                color="error"
                aria-label="Deactivate user"
                onClick={() =>
                  setConfirmDialog({
                    open: true,
                    mode: 'deactivate',
                    user: params.row as User,
                    hasLeft: true,
                    leavingDate: (params.row as User).dateOfLeaving
                      ? (params.row as User).dateOfLeaving!.split('T')[0]
                      : '',
                  })
                }
              >
                <Block fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Activate user">
              <IconButton
                size="small"
                color="success"
                aria-label="Activate user"
                onClick={() =>
                  setConfirmDialog({
                    open: true,
                    mode: 'activate',
                    user: params.row as User,
                    hasLeft: false,
                    leavingDate: (params.row as User).dateOfLeaving
                      ? (params.row as User).dateOfLeaving!.split('T')[0]
                      : '',
                  })
                }
              >
                <CheckCircle fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'dateOfJoining',
      headerName: 'Date of Joining',
      width: 140,
      renderCell: (params) =>
        params.value
          ? new Date(params.value as string).toLocaleDateString('en-IN')
          : '-',
    },
    {
      field: 'dateOfLeaving',
      headerName: 'Date of Leaving',
      width: 140,
      renderCell: (params) =>
        params.value
          ? new Date(params.value as string).toLocaleDateString('en-IN')
          : '-',
    },
    // ── Asset columns (hidden by default, toggled via column visibility) ──
    { field: 'laptopAssetNo',    headerName: 'Laptop Asset No',    width: 150, sortable: false },
    { field: 'laptopSN',         headerName: 'Laptop S/N',         width: 150, sortable: false },
    { field: 'monitorAssetNo',   headerName: 'Monitor Asset No',   width: 155, sortable: false },
    { field: 'monitorSN',        headerName: 'Monitor S/N',        width: 150, sortable: false },
    { field: 'hddAssetNo',       headerName: 'HDD Asset No',       width: 150, sortable: false },
    { field: 'hddSN',            headerName: 'HDD S/N',            width: 150, sortable: false },
    { field: 'connectorAssetNo', headerName: 'Connector Asset No', width: 165, sortable: false },
    { field: 'connectorSN',      headerName: 'Connector S/N',      width: 150, sortable: false },
  ];

  if (isLoading) return <PageLoading />;

  if (isError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error">Failed to load users. Please try again.</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="User Management"
        subtitle="Manage employees and their details"
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<FileDownload />} onClick={exportToExcel}>
              Export Excel
            </Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleOpen()}>
              Add User
            </Button>
          </Box>
        }
      />

      <Card elevation={2}>
        <CardContent sx={{ overflow: 'hidden' }}>
          {isMobile ? (
            <>
              {users.length === 0 ? (
                <Alert severity="info">No users found.</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {users.map((user) => {
                    const isActive = user.status === UserStatus.ACTIVE;
                    const hasLeft = !!user.dateOfLeaving;
                    const statusLabel = isActive ? 'Active' : hasLeft ? 'Left Organization' : 'Inactive';
                    const statusColor = isActive ? 'success' : hasLeft ? 'error' : 'default';
                    return (
                      <MobileTableCard
                        key={user.id}
                        items={[
                          { label: 'Employee ID', value: user.employeeId },
                          { label: 'Name', value: user.name },
                          { label: 'Designation', value: user.designation },
                          {
                            label: 'Role',
                            value: (
                              <Chip
                                label={user.role.replace('_', ' ')}
                                color="primary"
                                size="small"
                              />
                            ),
                          },
                          {
                            label: 'Status',
                            value: (
                              <Chip label={statusLabel} color={statusColor} size="small" />
                            ),
                          },
                          {
                            label: 'Base Salary',
                            value: `₹${Number(user.baseSalary).toLocaleString()}`,
                          },
                        ]}
                        actions={
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Edit user">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleOpen(user)}
                                aria-label="Edit user"
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {isActive ? (
                              <Tooltip title="Deactivate user">
                                <IconButton
                                  size="small"
                                  color="error"
                                  aria-label="Deactivate user"
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      mode: 'deactivate',
                                      user,
                                      hasLeft: true,
                                      leavingDate: user.dateOfLeaving
                                        ? user.dateOfLeaving.split('T')[0]
                                        : '',
                                    })
                                  }
                                >
                                  <Block fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Activate user">
                                <IconButton
                                  size="small"
                                  color="success"
                                  aria-label="Activate user"
                                  onClick={() =>
                                    setConfirmDialog({
                                      open: true,
                                      mode: 'activate',
                                      user,
                                      hasLeft: false,
                                      leavingDate: user.dateOfLeaving
                                        ? user.dateOfLeaving.split('T')[0]
                                        : '',
                                    })
                                  }
                                >
                                  <CheckCircle fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        }
                      />
                    );
                  })}
                </Box>
              )}
              {/* Mobile pagination */}
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Typography variant="caption" color="text.secondary">
                  Page {paginationModel.page + 1} of {Math.ceil(totalUsers / paginationModel.pageSize) || 1}
                  {' '}({totalUsers} total)
                </Typography>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={paginationModel.page === 0}
                    onClick={() => setPaginationModel((p) => ({ ...p, page: p.page - 1 }))}
                  >
                    Prev
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={(paginationModel.page + 1) * paginationModel.pageSize >= totalUsers}
                    onClick={() => setPaginationModel((p) => ({ ...p, page: p.page + 1 }))}
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            </>
          ) : (
            <Box
              sx={{
                height: { sm: 500, md: 600 },
                width: '100%',
                minHeight: 300,
                overflow: 'auto',
                '& .MuiDataGrid-root': { border: 'none' },
                '& .MuiDataGrid-cell': { minHeight: 44 },
                '& .MuiDataGrid-columnHeaders': { minHeight: 44 },
              }}
            >
              <DataGrid
                rows={enrichedUsers}
                columns={columns}
                pageSizeOptions={[10, 25, 50]}
                paginationMode="server"
                rowCount={totalUsers}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                columnVisibilityModel={columnVisibilityModel}
                onColumnVisibilityModelChange={setColumnVisibilityModel}
                disableRowSelectionOnClick
                columnHeaderHeight={44}
                rowHeight={44}
                sx={{ minWidth: 520 }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit User Dialog */}
      <ResponsiveDialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>{editUser ? 'Edit User' : 'Add New User'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Employee ID"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                disabled={!!editUser}
                required
              />
              <TextField
                label="Employee Number"
                type="number"
                value={formData.employeeNumber}
                onChange={(e) => setFormData({ ...formData, employeeNumber: e.target.value })}
                disabled={!!editUser}
                required
              />
              <TextField
                label="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                fullWidth
                sx={{ gridColumn: '1 / -1' }}
              />
              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!!editUser}
                required
              />
              {!editUser && (
                <TextField
                  label="Password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              )}
              <TextField
                label="Designation"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={formData.role}
                  label="Role"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                >
                  <MenuItem value={Role.EMPLOYEE}>Employee</MenuItem>
                  <MenuItem value={Role.LAB_ADMIN}>Lab Admin</MenuItem>
                  <MenuItem value={Role.SUPER_ADMIN}>Super Admin</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Date of Joining"
                type="date"
                value={formData.dateOfJoining}
                onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                disabled={!!editUser}
                InputLabelProps={{ shrink: true }}
                required
              />
              <TextField
                label="Date of Leaving"
                type="date"
                value={formData.dateOfLeaving}
                onChange={(e) => setFormData({ ...formData, dateOfLeaving: e.target.value })}
                InputLabelProps={{ shrink: true }}
                disabled={!editUser}
                helperText={
                  editUser && editUser.status === UserStatus.INACTIVE
                    ? 'Set when the employee has left the organization'
                    : 'Optional'
                }
              />
              <TextField
                label="Base Salary"
                type="number"
                value={formData.baseSalary}
                onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
              />
            </Box>

            {/* ── Asset selection (create only) ── */}
            {!editUser && (
              <Box sx={{ mt: 3 }}>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Assign Assets{' '}
                  <Typography component="span" variant="caption" color="text.secondary">
                    (Optional)
                  </Typography>
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                  {ASSET_OPTIONS.map(({ type, label }) => {
                    const sel = assetSelections[type];
                    const assetNumberOptions =
                      type === AssetType.LAPTOP ? laptopOptions :
                      type === AssetType.HDD    ? hddOptions    :
                      type === AssetType.MONITOR ? monitorOptions : null;
                    return (
                      <Box
                        key={type}
                        sx={{
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: sel?.checked ? 'primary.main' : 'divider',
                          overflow: 'hidden',
                          transition: 'border-color 0.15s',
                        }}
                      >
                        {/* Checkbox row */}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            px: 1.5,
                            py: 0.75,
                            bgcolor: sel?.checked ? 'action.selected' : 'transparent',
                            transition: 'background-color 0.15s',
                          }}
                        >
                          <FormControlLabel
                            sx={{ m: 0, flex: 1 }}
                            control={
                              <Checkbox
                                size="small"
                                checked={sel?.checked ?? false}
                                onChange={(e) =>
                                  setAssetSelections((prev) => ({
                                    ...prev,
                                    [type]: { ...prev[type], checked: e.target.checked },
                                  }))
                                }
                              />
                            }
                            label={
                              <Typography variant="body2" fontWeight={600}>
                                {label}
                              </Typography>
                            }
                          />
                        </Box>

                        {/* Asset Number + S/N fields — visible when checked */}
                        {sel?.checked && (
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 1.5,
                              px: 1.5,
                              pb: 1.5,
                              pt: 1,
                              borderTop: '1px solid',
                              borderColor: 'divider',
                            }}
                          >
                            {assetNumberOptions ? (
                              <Autocomplete
                                size="small"
                                options={assetNumberOptions}
                                value={sel.assetNumber || null}
                                onChange={(_e, newVal) =>
                                  setAssetSelections((prev) => ({
                                    ...prev,
                                    [type]: { ...prev[type], assetNumber: newVal ?? '' },
                                  }))
                                }
                                onInputChange={(_e, newVal) =>
                                  setAssetSelections((prev) => ({
                                    ...prev,
                                    [type]: { ...prev[type], assetNumber: newVal },
                                  }))
                                }
                                freeSolo
                                renderInput={(params) => (
                                  <TextField {...params} label="Asset Number" required />
                                )}
                              />
                            ) : (
                              <TextField
                                label="Asset Number"
                                size="small"
                                value={sel.assetNumber}
                                onChange={(e) =>
                                  setAssetSelections((prev) => ({
                                    ...prev,
                                    [type]: { ...prev[type], assetNumber: e.target.value },
                                  }))
                                }
                                required
                              />
                            )}
                            <TextField
                              label="Serial Number"
                              size="small"
                              value={sel.serialNumber}
                              onChange={(e) =>
                                setAssetSelections((prev) => ({
                                  ...prev,
                                  [type]: { ...prev[type], serialNumber: e.target.value },
                                }))
                              }
                              placeholder="Optional"
                            />
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving...'
              : editUser
              ? 'Update'
              : 'Create'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={confirmDialog.open}
        onClose={handleConfirmClose}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {confirmDialog.mode === 'deactivate' ? 'Deactivate User' : 'Activate User'}
        </DialogTitle>
        <DialogContent>
          {confirmDialog.user && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom>
                {confirmDialog.mode === 'deactivate'
                  ? `Do you want to mark ${confirmDialog.user.name} as having left the organization, or just deactivate them temporarily?`
                  : `Are you sure you want to activate ${confirmDialog.user.name}? They will regain access to the system.`}
              </Typography>
              {confirmDialog.mode === 'deactivate' && (
                <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box>
                    <Button
                      variant={confirmDialog.hasLeft ? 'contained' : 'outlined'}
                      size="small"
                      color="error"
                      onClick={() =>
                        setConfirmDialog((prev) => ({
                          ...prev,
                          hasLeft: true,
                        }))
                      }
                      sx={{ mr: 1 }}
                    >
                      Left organization
                    </Button>
                    <Button
                      variant={!confirmDialog.hasLeft ? 'contained' : 'outlined'}
                      size="small"
                      onClick={() =>
                        setConfirmDialog((prev) => ({
                          ...prev,
                          hasLeft: false,
                          leavingDate: '',
                        }))
                      }
                    >
                      Temporarily inactive
                    </Button>
                  </Box>
                  {confirmDialog.hasLeft && (
                    <TextField
                      label="Date of Leaving"
                      type="date"
                      value={confirmDialog.leavingDate}
                      onChange={(e) =>
                        setConfirmDialog((prev) => ({
                          ...prev,
                          leavingDate: e.target.value,
                        }))
                      }
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  )}
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmClose}>Cancel</Button>
          <Button
            onClick={handleConfirmAction}
            variant="contained"
            color={confirmDialog.mode === 'deactivate' ? 'error' : 'success'}
            disabled={updateMutation.isPending || activateMutation.isPending}
          >
            {confirmDialog.mode === 'deactivate' ? 'Deactivate' : 'Activate'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

    </Box>
  );
};

export default Users;
