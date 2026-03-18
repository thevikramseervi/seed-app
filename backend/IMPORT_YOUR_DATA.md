# How to Import Your Historical Excel Data

Follow these steps to import your existing Excel files into the system.

## 📂 Your Excel Files

Based on your files:
- `DECEMBER ATTENDANCE 2025.xlsx`
- `DECEMBER BIOMETRIC 2025.xls`
- `Pay Slip - Likhithashree.xls`

## 🎯 Step-by-Step Import Process

### Step 1: Prepare the Data Directory

```bash
cd backend/data
```

Copy your Excel files here or reference them by path when running the import commands.

---

### Step 2: Import Attendance Data

Your attendance file format from the Excel you shared:
- Has columns like: Employee ID, Date, Status, In Time, Out Time, Duration

**Run import:**
```bash
cd backend

# If your file is in the data directory
npm run migrate:attendance "data/DECEMBER ATTENDANCE 2025.xlsx"

# Or use the full path to your file
npm run migrate:attendance "data/your-attendance-file.xlsx"
```

**What happens:**
- Script reads each row
- Finds matching employee by Employee ID
- Creates/updates attendance records
- Shows progress with ✅ imported, ⏭️ skipped, ❌ errors
- Displays summary at end

---

### Step 3: Import Biometric Data

Your biometric file has columns like: Employee ID, Date, In Time, Out Time, Duration

**Run import:**
```bash
npm run migrate:biometric "data/DECEMBER BIOMETRIC 2025.xls"

# Or use full path to your file
npm run migrate:biometric "data/your-biometric-file.xls"
```

**What happens:**
- Creates biometric_logs records (marked as unprocessed)
- Stores raw data for audit trail
- Ready for biometric sync processing

---

### Step 4: Process Biometric Logs

After importing biometric data, you need to process it:

**Option A: Via Web UI (Recommended)**
1. Login to http://localhost:5173
2. Go to **Admin Panel**
3. Select date: `2025-12-01` (or appropriate date)
4. Click **"Sync Biometric Data"**
5. System processes logs and creates attendance records

**Option B: Via API**
```bash
curl -X POST "http://localhost:3000/api/biometric/sync?date=2025-12-01" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Step 5: Generate Payroll

After attendance is synced:

**Option A: Via Web UI**
1. Go to **Admin Panel**
2. Select **Month: December**, **Year: 2025**
3. Choose **"All Employees"** or specific employee
4. Click **"Generate for All Employees"**

**Option B: Via API**
```bash
curl -X POST "http://localhost:3000/api/payroll/generate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"year": 2025, "month": 12}'
```

---

## 📋 Mapping Your Excel Columns

### For DECEMBER ATTENDANCE 2025.xlsx

Your file might have columns like:
- `Emp ID` or `Employee ID` → Maps to Employee ID
- `Name` → Used for verification
- `Date` or specific date columns → Maps to Date
- `Status` or `P/A/HD/CL` → Maps to Status

The script automatically handles variations like:
- `P` → PRESENT (≥8h 30m worked)
- `A` or `LOP` → ABSENT/Loss of Pay (<3h 45m worked)
- `HD` or `HALF` → HALF_DAY (≥3h 45m and <8h 30m worked)
- `CL` or `LEAVE` → CASUAL_LEAVE
- `W` or `WO` → WEEKEND
- `H` → HOLIDAY

### For DECEMBER BIOMETRIC 2025.xls

Your file columns:
- `Employee ID` or `Emp ID` → Employee identifier
- `Date` → Date of attendance
- `In Time` → First punch in
- `Out Time` → Last punch out
- `Duration` → Total hours worked
- `In Door`, `Out Door` → Entry/exit points (optional)

---

## 🔧 Troubleshooting Your Import

### Issue: "User not found for employee ID: XXX"

**Solution:** You need to create users first.

**Option 1 - Via Web UI:**
1. Login to http://localhost:5173
2. Go to **Users** page
3. Click **"Add User"**
4. Fill in details and create each employee

**Option 2 - Create employees.xlsx:**
Extract employee info from your attendance file and create:
```
Employee ID | Employee Number | Name       | Email                  | Designation | Date of Joining | Base Salary | Role
CITANN001   | 101            | Name1      | name1@company.com      | Annotator   | 2024-01-01     | 22000      | EMPLOYEE
CITANN002   | 102            | Name2      | name2@company.com      | Annotator   | 2024-01-01     | 22000      | EMPLOYEE
```

Then run:
```bash
npm run migrate:users data/employees.xlsx
```

---

### Issue: "Invalid date format"

**Solution:** Ensure dates are in YYYY-MM-DD format or Excel date format.

If your Excel has dates in different format:
1. Open Excel
2. Select date column
3. Format as `YYYY-MM-DD` (e.g., 2025-12-01)
4. Save and re-run import

---

### Issue: Duplicate records

**Solution:** Scripts skip duplicates by default.

- **Users**: Skipped if email already exists
- **Attendance**: Updated if same user+date exists
- **Biometric**: Creates new log (multiple entries per day allowed)

---

## ✅ Verification After Import

### 1. Check Imported Data

**Via Web UI:**
- **Reports** → Generate Attendance Report
- Filter by December 2025
- Verify all records imported correctly

**Via Database:**
```bash
npm run prisma:studio
```
- Opens Prisma Studio at http://localhost:5555
- Browse tables: users, attendance, biometric_logs

### 2. Verify Counts

**Check users:**
```bash
cd backend
npm run prisma:studio
# Click on 'users' table to see all employees
```

**Check attendance:**
```bash
# Same in Prisma Studio, click 'attendance' table
```

---

## 💡 Pro Tips

### For Large Datasets:
1. **Split by month** - Import one month at a time
2. **Test first** - Import one week of data to verify format
3. **Backup database** - Before large imports
4. **Monitor progress** - Watch console output for errors

### For Multiple Months:
Run imports for each month:
```bash
npm run migrate:attendance "data/november_2025.xlsx"
npm run migrate:attendance "data/december_2025.xlsx"
npm run migrate:attendance "data/january_2026.xlsx"
```

### For Employee Updates:
- Create users manually via web UI (easier)
- Or prepare employees.xlsx with all employee details
- Default password: `employee123` (users should change it)

---

## 📞 Need Help?

1. Check `DATA_MIGRATION_GUIDE.md` for detailed format specifications
2. Review sample files in `backend/data/`
3. Check console output for specific errors
4. Verify Employee IDs match between files

---

**Ready to import? Start with Step 1! 🚀**
