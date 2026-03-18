# Attend Ease - Automated Attendance & Payroll System

A comprehensive full-stack web application for automating attendance tracking, leave management, and payroll processing.

## 🚀 Tech Stack

### Backend
- **Framework**: NestJS v11
- **Database**: PostgreSQL 16
- **ORM**: Prisma v5.22.0
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger
- **PDF Generation**: PDFKit
- **Excel Generation**: ExcelJS
- **Scheduling**: @nestjs/schedule (for cron jobs)

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v7
- **Routing**: React Router v7
- **State Management**: TanStack Query (React Query) v5
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios
- **Date Handling**: Day.js
- **Data Grid**: MUI X Data Grid
- **Excel Export**: ExcelJS

## 📋 Features

### Employee Features
- ✅ **Dashboard** - Overview with attendance stats, leave balance, and announcements
- ✅ **Attendance Tracking** - View daily attendance records with status
- ✅ **Leave Management** - Apply for leave, view application history
- ✅ **Salary Slips** - View and download salary slips (PDF/Excel)
- ✅ **Announcements** - View company announcements

### Admin Features (Lab Admin & Super Admin)
- ✅ **User Management** - CRUD operations for employees
- ✅ **Leave Approval** - Approve/reject leave applications
- ✅ **Holiday Calendar** - Manage company holidays
- ✅ **Payroll Generation** - Generate salary slips (bulk/individual)
- ✅ **Biometric Sync** - Manually sync biometric data to attendance
- ✅ **Reports & Analytics** - Generate attendance, leave, and payroll reports with Excel export

### System Features
- ✅ **Role-Based Access Control** - Employee, Lab Admin, Super Admin
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Two-Factor Authentication (2FA)** - Optional TOTP for admins (e.g. Google Authenticator)
- ✅ **Password Reset** - Forgot password and reset via email link
- ✅ **Biometric Integration** - Process biometric logs into attendance
- ✅ **Automatic Calculations** - Working days, pay days, salary computation
- ✅ **Weekend & Holiday Detection** - Automatic marking
- ✅ **Leave Balance Tracking** - 12 casual leaves per year (pro-rata for mid-year joiners)
- ✅ **Salary Slip Generation** - Professional PDF & Excel formats

## 🎯 Business Logic

### Attendance Rules
- **Full Day (Present)**: ≥8 hours 30 minutes worked
- **Half Day**: ≥3 hours 45 minutes and <8 hours 30 minutes worked
- **Absent (LOP)**: <3 hours 45 minutes worked
- **Weekends**: Saturday & Sunday (automatically marked)
- **Holidays**: Company holidays (configurable)
- **Casual Leave**: Approved leave applications

### Salary Calculation
```
Total Days     = Days in the month (from joining date if mid-month joiner)
Weekend Days   = Saturday & Sunday within Total Days (holiday takes priority over weekend)
Holiday Days   = Company holidays within Total Days (counted first; not double-counted as weekend)
Present Days   = Full days (≥8h30m) from biometric/manual attendance
Half Days      = Half days (≥3h45m, <8h30m) from attendance
Casual Leave   = Approved leave days (excl. weekends & holidays)
LOP Days       = Unrecorded weekdays (no attendance and no leave)

Total Pay Days = Present Days + (Half Days × 0.5) + Casual Leave + Weekend Days + Holiday Days
Net Salary     = (Total Pay Days / Total Days) × Base Salary
```

### Leave Management
- **Total Annual Leave**: 12 days per employee
- **Leave Types**: Casual Leave only (no half-day leaves)
- **Approval Required**: Lab Admin or Super Admin
- **Balance Tracking**: Available, Used, and Pending leaves
- **Overlapping Prevention**: System checks for conflicting dates

## 📁 Project Structure

```
attend-ease/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Initial data seeding
│   ├── src/
│   │   ├── auth/                  # Authentication module (JWT, 2FA, password reset)
│   │   ├── users/                 # User management
│   │   ├── attendance/            # Attendance tracking
│   │   ├── leave/                 # Leave management
│   │   ├── payroll/               # Payroll & salary slips (PDF + Excel)
│   │   ├── holidays/              # Holiday management
│   │   ├── announcements/         # Announcements with audience targeting & read tracking
│   │   ├── notifications/         # In-app notifications + absence-reminder cron
│   │   ├── activity/              # Audit activity log
│   │   ├── biometric/             # Biometric XLSX import & sync service
│   │   ├── email/                 # Email service (password reset, transactional)
│   │   ├── health/                # Health check endpoint
│   │   ├── common/                # Shared utils (date, attendance, number-to-words, filters)
│   │   ├── prisma/                # Prisma service
│   │   └── main.ts               # Application entry point
│   ├── .env                       # Environment variables
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── api/                   # API client services
    │   ├── components/            # Reusable components
    │   ├── contexts/              # React contexts (Auth)
    │   ├── layouts/               # Layout components
    │   ├── pages/                 # Page components
    │   ├── types/                 # TypeScript types
    │   ├── App.tsx               # Main app component
    │   └── main.tsx              # Application entry point
    ├── vite.config.ts            # Vite configuration
    └── package.json
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js v18+ 
- PostgreSQL 16
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create `.env` in the backend directory. See **Environment variables** below for a full list.

   **Required**
   - `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://user:pass@localhost:5432/attendease?schema=public`)
   - `JWT_SECRET` – Secret used to sign JWT tokens

   **Common**
   - `PORT` – Backend port (default: 3000)
   - `NODE_ENV` – `development` or `production`
   - `JWT_EXPIRATION` – Token lifetime (e.g. `7d`)
   - `FRONTEND_URL` – Allowed CORS origin (e.g. `http://localhost:5173`)

   **Optional**
   - `DEV_LOG_PASSWORD_RESET_LINK` – Set to `true` in local dev to log reset links when SMTP is not configured
   - `COMPANY_NAME`, `COMPANY_DIVISION`, `COMPANY_ADDRESS`, `CURRENCY_NOTE`, `DEFAULT_PAY_DAY` – Salary slip / company branding
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` – Email (password reset, etc.)
   - `TWO_FACTOR_ISSUER` – TOTP issuer name (default: Attend Ease)

   Example `.env`:
   ```env
   DATABASE_URL="postgresql://seed:YOUR_PASSWORD@localhost:5432/attendease?schema=public"
   JWT_SECRET="your-super-secret-jwt-key"
   JWT_EXPIRATION="7d"
   PORT=3000
   NODE_ENV="development"
   FRONTEND_URL="http://localhost:5173"
   DEV_LOG_PASSWORD_RESET_LINK="false"
   ```

4. **Setup database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run migrations
   npm run prisma:migrate
   
   # Seed initial data
   npm run prisma:seed
   ```

5. **Start backend server**
   ```bash
   npm run start:dev
   ```
   Server runs at: http://localhost:3000  
   API Docs (development only): http://localhost:3000/api/docs

### How to run (summary)
- **Backend**: `cd backend && npm run start:dev` (after `npm install`, env, and DB setup).
- **Frontend**: `cd frontend && npm run dev` (after `npm install`). App: http://localhost:5173.
- **Migrations**: `cd backend && npm run prisma:migrate`.
- **Seed**: `cd backend && npm run prisma:seed`.

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start frontend dev server**
   ```bash
   npm run dev
   ```
   App runs at: http://localhost:5173

## ✅ Testing & CI

### Backend tests
- **Unit tests** use Jest with `ts-jest`.
- Run all backend tests:
  ```bash
  cd backend
  npm test
  ```

### Continuous Integration
- GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push/PR to `main`/`master`.
- **Backend job**: install deps, generate Prisma client, build, and run `npm test`.
- **Frontend job**: install deps and run `npm run build`.

## 🔐 Default Credentials

After running the seed script:

```
Email: admin@cambridge.edu.in
Password: admin123
Role: Super Admin
```

## 📊 Database Schema

### Main Tables
- **users** - Employee information and credentials (includes optional 2FA fields for admins)
- **attendance** - Daily attendance records
- **biometric_logs** - Raw biometric data
- **leave_applications** - Leave requests
- **leave_balance** - Annual leave balance per user
- **payroll** - Monthly salary records (includes `weekend_days`, `holiday_days`, `payment_date`)
- **holidays** - Company holidays
- **announcements** - System announcements (target audience filtering, pinning, expiry)
- **announcement_reads** - Tracks which users have read each announcement
- **notifications** - In-app notifications per user
- **password_reset_tokens** - Password reset links (time-limited)

### User Roles
- **EMPLOYEE** - Regular employee
- **LAB_ADMIN** - Can approve leaves, manage users
- **SUPER_ADMIN** - Full system access

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login (returns `requires2fa` + `twoFactorToken` for admins with 2FA enabled)
- `POST /api/auth/2fa/verify` - Complete login with 2FA code (body: `token`, `code`)
- `GET /api/auth/me` - Get current user (includes `twoFactorEnabled` for admins)
- `PATCH /api/auth/me/password` - Change password (authenticated)
- `POST /api/auth/forgot-password` - Request password reset email
- `POST /api/auth/reset-password` - Set new password with reset token
- `POST /api/auth/logout` - User logout

### Two-Factor Authentication (admin only)
- `POST /api/auth/2fa/setup` - Start 2FA setup (returns QR/secret for authenticator app)
- `POST /api/auth/2fa/enable` - Enable 2FA after verifying code (body: `code`)
- `POST /api/auth/2fa/disable` - Disable 2FA

### Attendance
- `GET /api/attendance/my-attendance` - Get my attendance
- `GET /api/attendance/monthly/:year/:month` - Monthly attendance
- `GET /api/attendance/dashboard` - Dashboard stats
- `POST /api/attendance/manual` - Manual attendance entry (Admin)

### Leave
- `POST /api/leave/apply` - Apply for leave (excludes weekends & holidays from day count)
- `GET /api/leave/my-applications` - My leave applications
- `GET /api/leave/balance` - My leave balance
- `GET /api/leave/pending` - Pending applications (Admin)
- `PATCH /api/leave/:id/approve` - Approve leave (Admin)
- `PATCH /api/leave/:id/reject` - Reject leave (Admin)
- `PATCH /api/leave/:id/cancel` - Cancel application (owner or Admin)

### Payroll
- `POST /api/payroll/generate` - Generate payroll for one employee (Admin; optional `paymentDate`)
- `POST /api/payroll/generate/all` - Bulk-generate payroll for all active employees (Admin; optional `paymentDate`)
- `GET /api/payroll` - Get all payroll (Admin, optional year/month/userId filters)
- `GET /api/payroll/my-salary-slips` - My salary slips
- `GET /api/payroll/:id` - Get payroll by ID (owner or Admin)
- `PATCH /api/payroll/:id/mark-paid` - Mark as paid, records today as payment date (Super Admin only)
- `GET /api/payroll/:id/download/pdf` - Download PDF (owner or Admin)
- `GET /api/payroll/:id/download/xlsx` - Download Excel (owner or Admin)

### Users (Admin only)
- `GET /api/users` - Get all users (paginated)
- `POST /api/users` - Create user
- `PATCH /api/users/:id` - Update user
- `PATCH /api/users/:id/activate` - Activate user
- `PATCH /api/users/:id/deactivate` - Deactivate user

### Holidays (Admin only)
- `GET /api/holidays` - Get all holidays
- `POST /api/holidays` - Create holiday
- `PATCH /api/holidays/:id` - Update holiday
- `DELETE /api/holidays/:id` - Delete holiday

### Announcements
- `GET /api/announcements` - Get my announcements (filtered by target audience, includes `isRead` / `readAt`)
- `POST /api/announcements` - Create announcement (Admin)
- `PATCH /api/announcements/:id` - Update announcement (Admin)
- `DELETE /api/announcements/:id` - Delete announcement (Admin)
- `POST /api/announcements/:id/mark-read` - Mark announcement as read (persisted in DB)
- `GET /api/announcements/unread-count` - Unread count (based on persisted read records)

### Notifications
- `GET /api/notifications` - Get my notifications
- `PATCH /api/notifications/:id/read` - Mark notification as read
- `PATCH /api/notifications/read-all` - Mark all notifications as read

### Activity
- `GET /api/activity` - Get activity log (Admin)

### Biometric (Admin only)
- `POST /api/biometric/upload` - Upload biometric XLSX file
- `POST /api/biometric/sync?date=YYYY-MM-DD` - Manual sync for a specific date
- `GET /api/biometric/unprocessed` - Unprocessed logs

### Health
- `GET /api/health` - Health check

## 📈 Reports Module

The Reports page provides comprehensive analytics with Excel export:

### Attendance Report
- Filter by date range and employee
- Summary: Present, Absent, Half-day, Leave counts
- Detailed table with status, in/out times, duration
- Export to Excel

### Leave Report  
- All leave applications with status
- Summary: Pending, Approved, Rejected, Cancelled
- Export to Excel

### Payroll Report
- Filter by month, year, and employee
- Summary: Total gross, net salary, payment status
- Detailed breakdown by employee
- Export to Excel

## 🔄 Biometric Integration

### How It Works
1. Biometric device captures employee in/out times
2. Data is stored in `biometric_logs` table
3. Admin triggers manual sync or scheduled job runs
4. System processes logs:
   - Calculates total duration per day
   - Determines attendance status based on hours
   - Creates/updates attendance records
   - Marks logs as processed

### Manual Sync
- Navigate to **Admin Panel**
- Select date to sync
- Click "Sync Biometric Data"
- System processes all unprocessed logs for that date

## 💼 Payroll Generation

### Steps
1. Navigate to **Admin Panel**
2. Select Month/Year
3. Choose employee (or select "All Employees" for bulk generation)
4. Optionally set a **Pay Date** (defaults to last day of the month)
5. Click "Generate Payroll"
6. System calculates per employee:
   - Total days (respects mid-month joining date)
   - Weekend days and holiday days
   - Attendance from biometric/manual records
   - Casual leave from approved applications
   - Loss of Pay for unrecorded weekdays
   - Net salary using the formula above
7. Generates salary slips — downloadable as PDF or Excel from "Salary Slips" page
8. Slips start as **DRAFT**; Super Admin can mark them **PAID** via the Reports page

### Salary Slip Features
- Professional PDF format
- Excel format with formulas
- Includes: Employee details, attendance summary, salary breakdown
- Downloadable from "Salary Slips" page

## 🎨 UI Features

- **Landing Page** - Public landing with sign-in; app when authenticated
- **Theme** - Light/dark mode toggle (persisted)
- **Responsive Design** - Works on desktop, tablet, mobile
- **Material Design** - Modern, consistent UI (MUI v7)
- **Role-Based Navigation** - Menu items based on user role
- **Loading States** - Smooth loading indicators
- **Error Handling** - User-friendly error messages
- **Success Notifications** - Snackbar alerts
- **Data Grid** - Sortable, paginated tables
- **Form Validation** - Real-time validation
- **Protected Routes** - Automatic redirection
- **Change Password** - In-app change password (user menu)
- **2FA for Admins** - Enable/disable TOTP in Admin panel; login prompts for 6-digit code when 2FA is on

## 🔒 Security

- JWT token-based authentication
- Optional TOTP two-factor authentication for admins (LAB_ADMIN, SUPER_ADMIN)
- Password hashing with bcrypt
- Password reset via time-limited email links
- Role-based access control on all sensitive endpoints
- Ownership checks: employees can only access their own payslips, attendance, and leave records
- In-memory rate limiting on login / password-reset to prevent brute force
- Email normalised to lowercase on creation and lookup (case-insensitive auth)
- HTTP security headers via `helmet` middleware
- Swagger API docs disabled in production (`NODE_ENV=production`)
- SQL injection prevention (Prisma ORM)
- CORS configuration

## 📥 Data Migration

The system includes scripts to import historical data from Excel files.

### Quick Start

1. **Create sample Excel templates:**
   ```bash
   cd backend
   npm run migrate:create-samples
   ```

2. **Prepare your data** using the sample templates in `backend/data/`

3. **Import data:**
   ```bash
   # Import all data at once
   npm run migrate:all
   
   # Or import individually
   npm run migrate:users data/employees.xlsx
   npm run migrate:attendance data/attendance.xlsx
   npm run migrate:biometric data/biometric.xlsx
   ```

### Migration Scripts

- `npm run migrate:create-samples` - Create sample Excel templates
- `npm run migrate:users <file>` - Import employees/users
- `npm run migrate:attendance <file>` - Import attendance records
- `npm run migrate:biometric <file>` - Import biometric logs
- `npm run migrate:all` - Import all data from data/ directory

See [DATA_MIGRATION_GUIDE.md](backend/DATA_MIGRATION_GUIDE.md) for detailed instructions.

---

## 🚧 Future Enhancements

- [ ] Automated biometric sync (scheduled jobs)
- [ ] Monthly payroll auto-generation
- [ ] Email notifications for leave approvals
- [ ] Attendance regularization requests
- [ ] Mobile app
- [ ] Advanced analytics & charts
- [ ] Performance reviews integration
- [ ] Shift management
- [ ] Overtime tracking

## 📝 Notes

- Base salary for all employees: ₹22,000
- Casual leave quota: 12 days per year; pro-rata for mid-year joiners using the **15th-day rule**: joining on or before the 15th counts that month; joining after the 15th skips it (e.g. joining April 10 → 9 days; joining April 20 → 8 days)
- Payroll for mid-month joiners: days before the joining date are excluded from all calculations (not counted as weekend, holiday, or LOP)
- No half-day casual leave
- Weekends: Saturday & Sunday
- Working hours: 8 hours 30 minutes = full day

## 🐛 Troubleshooting

### Backend won't start
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Run `npm run prisma:generate`

### Frontend won't start
- Check backend is running on port 3000
- Verify all dependencies installed
- Clear node_modules and reinstall

### Can't login
- Use default credentials: admin@cambridge.edu.in / admin123
- Check backend console for errors
- Verify JWT_SECRET is set

## 📄 License

This project is private and proprietary.

## 👥 Support

For issues or questions, contact the development team.

---

**Built with ❤️ for automated attendance & payroll management**
