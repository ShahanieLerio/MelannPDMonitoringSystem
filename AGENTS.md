# Workspace Agent Instructions

This project is a React/Vite app for Melann Lending Past Due and Report Monitoring.

## Autonomy

- Execute clear local edit requests to completion without asking for permission.
- Do not ask the user where a component is located unless all reasonable local lookup attempts fail.
- If a search tool fails, immediately use another local lookup method and continue.
- Ask only for destructive actions, production/external changes, credentials, or genuinely ambiguous requirements.

## Lookup Fallbacks

Use fast local lookup first, then fall back automatically:

1. Try `rg --files` and `rg -n "<term>"`.
2. If `rg` is blocked or unavailable on Windows, use PowerShell:
   - `Get-ChildItem -Recurse -File -Exclude node_modules,dist`
   - `Select-String -Path <files> -Pattern "<term>"`
3. Exclude `node_modules`, `dist`, and large generated artifacts unless the task explicitly targets them.
4. When the user names a UI area, check the component map below before searching broadly.

## Component Map

- Sidebar / side bar / navigation menu: `components/Sidebar.tsx`
- Main app layout and header shell: `App.tsx`
- Dashboard: `components/Dashboard.tsx`
- Loan Grid / client table: `components/LoanGrid.tsx`
- Payment form: `components/PaymentForm.tsx`
- Client Update: `components/ClientUpdate.tsx`
- Reports: `components/Reports.tsx`
- Collection Sheet: `components/CollectionSheet.tsx`
- Login page: `components/LoginPage.tsx`
- User management: `components/UserManagement.tsx`
- Shared types/enums: `types.ts`
- Data store/API-facing local service: `services/dataStore.ts`

## Editing Rules

- Keep edits scoped to the requested area.
- For visual-only requests, do not change business logic, data fetching, database scripts, or unrelated components.
- Prefer existing React, Tailwind CDN classes, and current component patterns.
- Use `npm.cmd run build` on Windows to verify frontend changes; `npm run build` may be blocked by PowerShell script policy.
- If Vite/esbuild is blocked by `EPERM`, rerun with the needed permission rather than asking the user what to do.

## Response Style

- Keep progress updates short.
- Report changed files and verification results.
- If something is blocked, state the exact blocker and the fallback attempted.
