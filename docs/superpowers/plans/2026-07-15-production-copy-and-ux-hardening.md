# Production Copy And UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar SIGES-CCTV listo para producción corrigiendo copy residual, feedback UX y textos demo visibles sin cambiar contratos funcionales.

**Architecture:** Se agregan helpers de presentación de UI y un aviso inline reutilizable para reemplazar `window.alert` en flentes críticos. El backend conserva su comportamiento actual y solo ajusta copy expuesto. Seeds y docs operativas se sanean sin alterar el flujo de arranque por variables de entorno.

**Tech Stack:** Next.js 15, React 19, TypeScript, NestJS 11, node:test, ts-node

## Global Constraints

- No cambiar contratos API existentes.
- No introducir refactors amplios ajenos a copy/UX/higiene de producción.
- Mantener compatibilidad con branding y permisos ya implementados.
- Probar primero los helpers nuevos y el copy de auth.

---

### Task 1: Frontend presentation helpers

**Files:**
- Create: `apps/web/lib/presentation.ts`
- Test: `apps/web/lib/presentation.test.ts`

**Interfaces:**
- Produces: `formatLifecycleState(state: string): string`
- Produces: `formatRoleLabel(role: string): string`
- Produces: `formatLoginTitle(entityName?: string | null): string`
- Produces: `formatLoginSupportText(entityName?: string | null): string`

- [ ] Write failing tests for visible labels.
- [ ] Run targeted frontend test command and confirm failure.
- [ ] Implement minimal helper functions.
- [ ] Run targeted frontend test command and confirm pass.

### Task 2: Replace residual frontend copy

**Files:**
- Modify: `apps/web/app/login/page.tsx`
- Modify: `apps/web/app/admin/branding/page.tsx`
- Modify: `apps/web/app/admin/cities/page.tsx`
- Modify: `apps/web/app/projects/page.tsx`
- Modify: `apps/web/app/admin/centers/page.tsx`
- Modify: `apps/web/app/admin/users/page.tsx`
- Modify: `apps/web/app/admin/routes/page.tsx`

**Interfaces:**
- Consumes: `formatLifecycleState`, `formatRoleLabel`, `formatLoginTitle`, `formatLoginSupportText`

- [ ] Swap hardcoded English/dev labels for presentation helpers and Spanish operator copy.
- [ ] Remove the visible TODO marker left in product code.
- [ ] Keep backend enum values intact in form submissions.

### Task 3: Inline error feedback for critical views

**Files:**
- Create: `apps/web/components/ops-notice.tsx`
- Modify: `apps/web/app/admin/routes/page.tsx`
- Modify: `apps/web/app/monitoring/network/page.tsx`

**Interfaces:**
- Produces: `OpsNotice({ tone, title, message, onDismiss })`

- [ ] Add failing helper/component-level test only if needed for logic; otherwise verify by targeted build/test after integration.
- [ ] Replace `window.alert` with inline notices for route administration and network monitoring.
- [ ] Preserve confirmations that intentionally require user consent.

### Task 4: Backend auth copy

**Files:**
- Create: `apps/api/src/auth/auth.service.test.ts`
- Modify: `apps/api/src/auth/auth.service.ts`

**Interfaces:**
- Produces: unauthorized message `Credenciales inválidas`

- [ ] Write failing auth service test for the unauthorized message.
- [ ] Run targeted API test command and confirm failure.
- [ ] Update auth service message.
- [ ] Run targeted API test command and confirm pass.

### Task 5: Seed and docs hygiene

**Files:**
- Modify: `apps/api/prisma/seed.ts`
- Modify: `apps/api/prisma/seed.js`
- Modify: `docs/superpowers/specs/2026-06-25-siges-cctv-design.md`
- Modify: `docs/superpowers/plans/2026-06-25-plan1-foundation.md`
- Modify: `docs/superpowers/plans/2026-06-25-plan2-api-realtime.md`

**Interfaces:**
- Produces: neutral placeholders instead of exposed demo credentials

- [ ] Replace explicit example credentials with env-driven placeholders where the docs are operational.
- [ ] Keep local development guidance usable.

### Task 6: Verification

**Files:**
- Modify: `none`

- [ ] Run targeted frontend tests.
- [ ] Run targeted API tests.
- [ ] Run frontend build if feasible.
- [ ] Inspect git diff for unintended collateral changes before reporting.
