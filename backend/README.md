# Attend Ease Backend

## Database Setup Required

The application is trying to connect to PostgreSQL but authentication failed.

### Please set up the database:

**Option 1: Update the password in `.env` file**
```env
DATABASE_URL="postgresql://seed:YOUR_ACTUAL_PASSWORD@localhost:5432/attendease?schema=public"
```

**Option 2: Create/Reset the database user**
```sql
-- Connect to PostgreSQL as superuser
psql -U postgres

-- Create database
CREATE DATABASE attendease;

-- Create user with password
CREATE USER seed WITH PASSWORD 'your_password_here';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE attendease TO seed;

-- Connect to the database
\c attendease

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO seed;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO seed;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO seed;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO seed;
```

**Option 3: Use default postgres user** (for development)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/attendease?schema=public"
```

## After fixing the database connection:

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start the application
npm run start:dev
```

## Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)
- `npm run prisma:seed` - Seed the database with initial data
- `npm test` - Run backend unit tests (Jest + ts-jest)

### Data migration (Excel import)

- `npm run migrate:create-samples` - Create sample Excel templates in `data/`
- `npm run migrate:users data/<file>.xlsx` - Import employees
- `npm run migrate:attendance data/<file>.xlsx` - Import attendance
- `npm run migrate:attendance-wide data/<file>.xlsx` - Import attendance (wide format)
- `npm run migrate:biometric data/<file>.xlsx` - Import biometric logs
- `npm run migrate:biometric-grouped data/<file>.xlsx` - Import biometric (grouped format)
- `npm run migrate:all` - Import all from `data/employees.xlsx`, `data/attendance.xlsx`, `data/biometric.xlsx`

See [DATA_MIGRATION_GUIDE.md](DATA_MIGRATION_GUIDE.md) for details.

## API Documentation

Once the server is running, visit:
- http://localhost:3000/api/docs - Swagger UI

## Environment Variables

Copy `.env` and update with your values. For a full list (including optional company/slip and SMTP vars), see the root [README.md](../README.md#-setup-instructions).

- **Required:** DATABASE_URL, JWT_SECRET
- **Common:** PORT (default: 3000), NODE_ENV, JWT_EXPIRATION (e.g. 7d), FRONTEND_URL
- **Optional:** DEV_LOG_PASSWORD_RESET_LINK, TWO_FACTOR_ISSUER, SMTP_*, COMPANY_*, etc.
