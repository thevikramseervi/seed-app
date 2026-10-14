// User types
export enum Role {
  EMPLOYEE = 'EMPLOYEE',
  LAB_ADMIN = 'LAB_ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export interface User {
  id: string;
  employeeId: string;
  employeeNumber: number;
  name: string;
  email: string;
  designation: string;
  role: Role;
  dateOfJoining: string;
  dateOfLeaving?: string;
  baseSalary: number;
  status: UserStatus;
}

// Attendance types
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  WEEKEND = 'WEEKEND',
  HOLIDAY = 'HOLIDAY',
  CASUAL_LEAVE = 'CASUAL_LEAVE',
  NO_PUNCH = 'NO_PUNCH',
}

export interface Attendance {
  id: string;
  userId: string;
  date: string;
  status: AttendanceStatus;
  firstInTime?: string;
  lastOutTime?: string;
  totalDuration?: number;
  biometricSynced: boolean;
}

// Leave types
export enum LeaveType {
  CASUAL_LEAVE = 'CASUAL_LEAVE',
  UNPAID_LEAVE = 'UNPAID_LEAVE',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export interface LeaveApplication {
  id: string;
  userId: string;
  leaveType?: LeaveType;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  user?: {
    name: string;
    employeeId: string;
    designation: string;
    role?: Role;
  };
  reviewer?: {
    name: string;
  };
}

export interface LeaveBalance {
  id: string;
  userId: string;
  year: number;
  totalLeaves: number;
  /** Leaves accrued till current month (or full for past years). */
  accruedLeaves?: number;
  usedLeaves: number;
  pendingLeaves: number;
  availableLeaves: number;
}

export interface ClUsageSummary {
  userId: string;
  year: number;
  throughMonth: number; // 1-12
  appliedDays: number;
  applicationsCount: number;
}

// Payroll types
export enum PaymentStatus {
  DRAFT = 'DRAFT',
  PROCESSED = 'PROCESSED',
  PAID = 'PAID',
}

export interface Payroll {
  id: string;
  userId: string;
  month: number;
  year: number;
  baseSalary: number;
  workingDays: number;
  weekendDays: number;
  holidayDays: number;
  presentDays: number;
  casualLeaveDays: number;
  halfDays: number;
  lossOfPayDays: number;
  totalPayDays: number;
  grossEarnings: number;
  deductions: number;
  reimbursements: number;
  netSalary: number;
  paymentStatus: PaymentStatus;
  paymentDate?: string;
  generatedAt: string;
  user?: {
    employeeId: string;
    employeeNumber: number;
    name: string;
    email?: string;
    designation: string;
    dateOfJoining?: string;
  };
}

// Announcement types
export enum AnnouncementPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TargetAudience {
  ALL = 'ALL',
  EMPLOYEES = 'EMPLOYEES',
  ADMINS = 'ADMINS',
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: AnnouncementPriority;
  isPinned: boolean;
  isActive: boolean;
  targetAudience: TargetAudience;
  expiresAt?: string;
  createdAt: string;
  creator: {
    name: string;
    role: Role;
  };
  isRead?: boolean;
  readAt?: string;
}

// Notification types (data is optional payload e.g. for deep links)
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  readAt?: string;
  data?: Record<string, unknown>;
}

// Holiday type
export interface Holiday {
  id: string;
  date: string;
  name: string;
  description?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// Dashboard types
export interface DashboardStats {
  presentDays: number;
  absentDays: number;
  halfDays: number;
  casualLeaves: number;
  totalWorkingDays: number;
}

export interface ActivityEntry {
  id: string;
  userId: string;
  date: string;
  userType: string;
  project: string;
  task: string;
  subTask?: string;
  unit: string;
  nos: number;
  percentage: number;
  productivity: number;
  weightage: number;
  user?: {
    employeeId: string;
    employeeNumber?: number;
    name: string;
    status?: UserStatus;
  };
}

// Asset types
export enum AssetType {
  LAPTOP = 'LAPTOP',
  MONITOR = 'MONITOR',
  HDD = 'HDD',
  CONNECTOR = 'CONNECTOR',
  OTHER = 'OTHER',
}

export interface Asset {
  id: string;
  assetName: string;
  assetType: AssetType;
  assetNumber: string;
  serialNumber?: string;
  userId?: string;
  user?: { id: string; name: string; employeeId: string; employeeNumber: number };
  createdAt: string;
  updatedAt: string;
}

export enum AssetAction {
  ASSIGNED = 'ASSIGNED',
  RETURNED = 'RETURNED',
  REASSIGNED = 'REASSIGNED',
  DELETED = 'DELETED',
}

export interface AssetHistory {
  id: string;
  assetId: string;
  assetNumber: string;
  assetName: string;
  assetType: AssetType;
  serialNumber?: string;
  userId?: string;
  employeeName?: string;
  employeeId?: string;
  action: AssetAction;
  performedBy: string;
  performedByName: string;
  remarks?: string;
  createdAt: string;
}
