# Dev Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Leave SIGES-CCTV with one stable bootstrap path for local development and Docker, so `docker compose up -d`, DB bootstrap, and `npm run dev` all work without manual workarounds.

**Architecture:** Treat the repository as a root npm workspace and align every entry point around that fact. Docker images must build from the monorepo root to see the root lockfile, local scripts must load the root `.env`, and Nest incremental metadata must live under `dist` so a deleted output directory never leaves stale compiler state behind.

**Tech Stack:** Docker Compose, Node.js workspaces, NestJS 11, Next.js 15, Prisma, TypeScript

## Global Constraints

- Keep local development and Docker bootstrap consistent with the same root workspace layout.
- Do not rely on manual `source .env` steps for normal development commands.
- Preserve existing service ports documented by the project: web `3001`, api `4001`, postgres `5434`, redis `6379`, redpanda `9092`, console `8082`.
- Fix root causes instead of adding one-off runtime workarounds.

---

### Task 1: Stabilize workspace scripts and compiler state

**Files:**
- Modify: `package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/api/tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: root `.env`, npm workspaces, Nest build/dev commands
- Produces: stable `npm run dev`, `npm run db:push`, `npm run db:seed`, and deterministic Nest build output under `apps/api/dist`

- [ ] Update root scripts so bootstrap commands exist at the repo root for API database operations.
- [ ] Update `apps/api/package.json` scripts so dev and Prisma commands load `../../.env` automatically.
- [ ] Set `tsBuildInfoFile` inside `apps/api/dist` so `deleteOutDir` removes stale incremental state together with build output.
- [ ] Ignore `*.tsbuildinfo` artifacts at the repo level.

### Task 2: Make Docker build from the monorepo root

**Files:**
- Modify: `docker-compose.yml`
- Modify: `apps/api/Dockerfile`
- Modify: `apps/web/Dockerfile`
- Create: `.dockerignore`

**Interfaces:**
- Consumes: root `package-lock.json`, root workspace `package.json`, `apps/api`, `apps/web`
- Produces: `docker compose up -d` that can build `api` and `web` using the workspace lockfile and start them with their expected ports

- [ ] Change compose build contexts for `api` and `web` to the repository root while keeping per-app Dockerfiles.
- [ ] Rework the API Dockerfile into a root-workspace multi-stage build that installs from the root lockfile, builds `apps/api`, and runs `node dist/main.js` from the app workspace.
- [ ] Rework the Web Dockerfile into a root-workspace multi-stage build that installs from the root lockfile, builds `apps/web`, and serves the Next standalone output.
- [ ] Add a root `.dockerignore` to exclude `node_modules`, `.next`, `dist`, git metadata, and local agent folders from Docker context.

### Task 3: Lock the frontend bootstrap behavior

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/tsconfig.json`

**Interfaces:**
- Consumes: root `.env`, Next.js dev/build process
- Produces: deterministic web dev startup that does not rewrite tracked config files on first run

- [ ] Update `apps/web/package.json` dev script so it loads the root `.env`.
- [ ] Keep the required Next TypeScript options explicitly checked into `apps/web/tsconfig.json` so first boot is clean.

### Task 4: Update docs and verify the full bootstrap

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: fixed scripts, fixed Docker setup
- Produces: one documented local workflow matching the repo’s actual behavior

- [ ] Rewrite the bootstrap section to use root commands and clarify when Docker starts infrastructure plus app containers.
- [ ] Verify root API build failure is gone by removing `apps/api/dist`, running the API build again, and confirming `apps/api/dist/main.js` exists.
- [ ] Verify local bootstrap by running DB sync/seed with root commands and confirming `npm run dev` can start `api` and `web`.
- [ ] Verify Docker bootstrap by running `docker compose up -d --build` and checking HTTP responses from `:3001` and `:4001/docs`.
