# Attend Ease – Frontend

React frontend for the Attend Ease attendance and payroll system.

## Stack

- **React 19** + TypeScript
- **Vite** (build and dev server)
- **MUI (Material-UI) v7** – components, theme, MUI X Data Grid & Date Pickers
- **React Router v7**
- **TanStack Query (React Query) v5**
- **Axios** (API client, proxy to backend `/api`)
- **React Hook Form** + **Zod**
- **Day.js**

## Scripts

- `npm run dev` – Start dev server (http://localhost:5173, proxies `/api` to backend)
- `npm run build` – TypeScript check + production build
- `npm run lint` – ESLint
- `npm run preview` – Preview production build

## Environment

Dev server proxies ` /api` to `http://localhost:3000`. Set `host: true` in `vite.config.ts` if you need to access from another machine (e.g. Windows host when running in WSL).

## Features

- **Landing** – Public landing page; app when authenticated
- **Theme** – Light/dark mode (persisted)
- **Auth** – Login (with optional 2FA step for admins), change password (user menu), protected routes
- **Dashboard** – Stats, leave balance, announcements
- **Attendance** – Calendar and table views
- **Leave** – Apply, history, balance
- **Salary Slips** – List, detail view, PDF/Excel download
- **Announcements** – List and (admin) create
- **Admin** – Users, holidays, payroll generation, biometric upload + sync, reports (Excel export), Security / 2FA (enable/disable TOTP)

## Patterns

- **API hooks** – Shared `useApiQuery` / `useApiMutation` (in `src/hooks`) wrap TanStack Query:
  - Centralized error handling with snackbar-level `onMessage`.
  - Consistent cache invalidation via `invalidateKeys`.
  - Prefer these over raw `useQuery` / `useMutation` in new code.

See root [README.md](../README.md) and [QUICK_START.md](../QUICK_START.md) for full setup and usage.
