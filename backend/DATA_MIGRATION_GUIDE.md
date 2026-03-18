# Data Migration Guide

This guide explains how to import historical data from Excel files into the Attend Ease system.

## 📋 Overview

The system provides scripts to import:
1. **Users/Employees** - Employee master data
2. **Attendance Records** - Historical attendance data
3. **Biometric Logs** - Raw biometric punch data

## 🚀 Quick Start

### Step 1: Create Sample Excel Templates

```bash
cd backend
npm run migrate:create-samples
```

This creates sample Excel files in `backend/data/`:
- `sample_employees.xlsx`
- `sample_attendance.xlsx`
- `sample_biometric.xlsx`

### Step 2: Prepare Your Data

Use the sample files as templates and fill in your actual data. You can rename them or keep your own filenames.

### Step 3: Run Import

**Import all data at once:**
```bash
npm run migrate:all
```

**Or import individually:**
```bash
npm run migrate:users data/employees.xlsx
npm run migrate:attendance data/attendance.xlsx
npm run migrate:biometric data/biometric.xlsx
```

## 📊 Excel File Formats

### 1. Employees Excel Format

Required columns:
- `Employee ID` - Unique employee identifier (e.g., CITANN001)
- `Employee Number` - Sequential number (e.g., 101, 102)
- `Name` - Full employee name
- `Email` - Unique email address
- `Designation` - Job title (e.g., Annotator)
- `Date of Joining` - Format: YYYY-MM-DD
- `Base Salary` - Monthly salary (e.g., 22000)
- `Role` - EMPLOYEE, LAB_ADMIN, or SUPER_ADMIN

**Example:**
```
Employee ID | Employee Number | Name       | Email                    | Designation | Date of Joining | Base Salary | Role
CITANN001   | 101            | John Doe   | john.doe@company.com    | Annotator   | 2024-01-15     | 22000      | EMPLOYEE
CITANN002   | 102            | Jane Smith | jane.smith@company.com  | Annotator   | 2024-02-01     | 22000      | EMPLOYEE
```

**Notes:**
- Default password for all imported users: `employee123`
- Users will need to change their password on first login
- Email addresses must be unique
- Leave balance (12 days) is automatically created

---

### 2. Attendance Excel Format

Required columns:
- `Employee ID` - Must match existing employee
- `Date` - Format: YYYY-MM-DD or Excel date
- `Status` - PRESENT, ABSENT, HALF_DAY, CASUAL_LEAVE, WEEKEND, HOLIDAY
- `First In` - First punch time (e.g., 09:00:00)
- `Last Out` - Last punch time (e.g., 18:00:00)
- `Duration (hrs)` - Total hours worked (e.g., 9)

**Status Options:**
- `PRESENT` or `P` - Full day present (≥8h 30m worked)
- `ABSENT` or `A` or `LOP` - Absent/Loss of Pay (<3h 45m worked)
- `HALF_DAY` or `HD` or `HALF` - Half day (≥3h 45m and <8h 30m worked)
- `CASUAL_LEAVE` or `CL` or `LEAVE` - Casual leave
- `WEEKEND` or `W` or `WO` - Weekend off
- `HOLIDAY` or `H` - Public holiday

**Example:**
```
Employee ID | Date       | Status  | First In | Last Out | Duration (hrs)
CITANN001   | 2024-12-01 | PRESENT | 09:00:00 | 18:00:00 | 9
CITANN001   | 2024-12-02 | HALF_DAY| 09:15:00 | 14:00:00 | 5
CITANN001   | 2024-12-03 | ABSENT  | -        | -        | 0
```

**Notes:**
- If record exists, it will be updated
- Missing times are set to null
- Duration can be decimal (e.g., 9.5 for 9 hours 30 minutes)

---

### 3. Biometric Excel Format

Required columns:
- `Employee ID` - Must match existing employee
- `Date` - Format: YYYY-MM-DD
- `In Time` - Punch in time (e.g., 09:00:15)
- `Out Time` - Punch out time (e.g., 18:02:30)
- `Duration (hrs)` - Total hours (e.g., 9.03)

Optional columns:
- `In Door` - Entry point name
- `Out Door` - Exit point name

**Example:**
```
Employee ID | Date       | In Time  | Out Time | In Door        | Out Door      | Duration (hrs)
CITANN001   | 2024-12-01 | 09:00:15 | 18:02:30 | Main Entrance  | Main Entrance | 9.03
CITANN001   | 2024-12-02 | 09:15:00 | 18:30:45 | Main Entrance  | Side Exit     | 9.26
```

**Notes:**
- Biometric logs are created as "unprocessed"
- Run biometric sync from Admin Panel to convert logs to attendance
- Multiple entries per day are supported
- Raw data is stored in `rawData` field for audit

---

## 🔄 Import Process Flow

### Full Migration Flow:

```
1. Import Users (employees.xlsx)
   ↓
   - Creates user accounts
   - Creates leave balance (12 days)
   - Sets default password (employee123)

2. Import Attendance (attendance.xlsx)
   ↓
   - Creates attendance records
   - Links to existing users
   - Updates if record exists

3. Import Biometric (biometric.xlsx)
   ↓
   - Creates unprocessed biometric logs
   - Stores raw data for audit

4. Run Biometric Sync (from Admin Panel)
   ↓
   - Processes biometric logs
   - Calculates durations
   - Creates/updates attendance records

5. Generate Payroll (from Admin Panel)
   ↓
   - Generates salary slips
   - Uses attendance data
   - Creates downloadable PDF/Excel
```

---

## 📝 Script Commands Reference

### Create Sample Templates
```bash
npm run migrate:create-samples
```
Creates sample Excel files in `backend/data/`

### Import Users
```bash
npm run migrate:users <path-to-excel>
# Example:
npm run migrate:users data/employees.xlsx
npm run migrate:users ../historical_data/employees_2024.xlsx
```

### Import Attendance
```bash
npm run migrate:attendance <path-to-excel>
# Example:
npm run migrate:attendance data/attendance.xlsx
```

### Import Biometric
```bash
npm run migrate:biometric <path-to-excel>
# Example:
npm run migrate:biometric data/biometric.xlsx
```

### Import All (Auto-detects files in data/ directory)
```bash
npm run migrate:all
```
Looks for:
- `data/employees.xlsx`
- `data/attendance.xlsx`
- `data/biometric.xlsx`

---

## ⚠️ Important Notes

### Before Import:
1. **Backup Database** - Always backup before large imports
2. **Test with Sample** - Use sample data first to verify format
3. **Check User Emails** - Ensure email addresses are unique
4. **Validate Dates** - Use YYYY-MM-DD format

### During Import:
- Import shows progress with ✅ success, ⏭️ skipped, ❌ error indicators
- Script continues even if some rows fail
- Summary report shown at end

### After Import:
1. **Verify Data** - Check Reports section to verify imported data
2. **Process Biometric** - Run biometric sync from Admin Panel
3. **Generate Payroll** - Create salary slips for imported periods
4. **Update Passwords** - Notify users to change default password

---

## 🛠️ Troubleshooting

### "User not found" Error
**Problem:** Attendance/biometric import can't find employee  
**Solution:** Import users first, or check Employee ID matches exactly

### "Invalid date format" Error
**Problem:** Excel date not recognized  
**Solution:** Use YYYY-MM-DD format (e.g., 2024-12-01)

### "Email already exists" Error
**Problem:** Duplicate email address  
**Solution:** Ensure each employee has unique email

### "File not found" Error
**Problem:** Excel file path incorrect  
**Solution:** Use full path or place file in `backend/data/` directory

### Import Shows All Skipped
**Problem:** Data already exists  
**Solution:** Scripts skip duplicates. Delete existing records if re-import needed

---

## 📊 Data Validation

The scripts perform automatic validation:

### User Import Validates:
- ✓ Employee ID is provided
- ✓ Email is provided and unique
- ✓ Name is provided
- ✓ Date format is valid
- ✓ Base salary is numeric

### Attendance Import Validates:
- ✓ Employee exists in system
- ✓ Date is valid
- ✓ Status is recognized
- ✓ No duplicate date per employee (updates if exists)

### Biometric Import Validates:
- ✓ Employee exists in system
- ✓ Date is valid
- ✓ Duration is numeric

---

## 🔒 Security Considerations

1. **Default Passwords**: All imported users get password `employee123`
   - Force password change on first login (recommend implementing)
   - Notify users via email to change password

2. **Data Privacy**: Excel files may contain sensitive data
   - Store in secure location
   - Don't commit to version control
   - Delete after successful import

3. **Audit Trail**: All imports are logged
   - Check console output for summary
   - Biometric raw data preserved in database

---

## 💡 Best Practices

### Organizing Your Data:

```
backend/
├── data/
│   ├── 2024/
│   │   ├── employees_2024.xlsx
│   │   ├── attendance_jan_2024.xlsx
│   │   ├── attendance_feb_2024.xlsx
│   │   └── biometric_jan_2024.xlsx
│   └── 2025/
│       ├── attendance_dec_2025.xlsx
│       └── biometric_dec_2025.xlsx
└── scripts/
```

### Import Order:
1. **Start of Year**: Import all employees
2. **Monthly**: Import attendance and biometric for that month
3. **End of Month**: Run biometric sync and generate payroll

### Incremental Imports:
- Import attendance/biometric monthly as data becomes available
- Scripts handle duplicates gracefully
- Use date range in filename for clarity

---

## 📞 Support

For issues or questions:
1. Check error messages in console output
2. Verify Excel format matches templates
3. Review this guide for common issues
4. Check `backend/logs/` for detailed error logs (if configured)

---

**Happy Migrating! 🚀**
