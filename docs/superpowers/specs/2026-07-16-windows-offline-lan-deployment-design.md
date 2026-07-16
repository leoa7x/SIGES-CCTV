# SIGES-CCTV Windows Offline LAN Deployment Design

Date: 2026-07-16
Status: Draft for review

## Objective

Define a production-grade deployment model for SIGES-CCTV on a dedicated Windows machine that:

- runs fully offline after installation
- serves multiple LAN clients through a browser
- uses `https://siges.cctv.local`
- includes an internal certificate trust model
- can be installed and operated without requiring direct knowledge of the repository

This design intentionally does not try to convert the whole platform into a single desktop `.exe`. SIGES-CCTV is a multi-service platform, so the correct deliverable is an installation package and an operations model for the full stack.

## Scope

This design covers:

- server-side installation on a dedicated Windows Server or Windows 10/11 machine
- client-side setup for browser access from multiple Windows PCs
- internal DNS and internal certificate trust assumptions
- offline packaging and update flow
- operational tooling for start, stop, backup, restore, and upgrade

This design does not cover:

- internet-facing publication
- multi-server high availability
- Active Directory integration
- Linux deployment
- mobile client distribution

## Constraints

- The deployment must continue working without internet after installation.
- Multiple client PCs will access the system from the LAN.
- The target hostname is `siges.cctv.local`.
- The deployment should avoid depending on external infrastructure that the operator must provide separately.
- The system must preserve the current platform architecture as much as possible to reduce implementation risk.

## Current Architecture

Today the repository is a multi-service stack composed of:

- Next.js web frontend
- NestJS API backend
- PostgreSQL/PostGIS
- Redis
- Redpanda
- MinIO
- Grafana

The repo already supports containerized operation and local orchestration through Docker-based workflows. That makes a container-packaged offline Windows deployment the lowest-risk path.

## Evaluated Approaches

### Approach 1: Offline containerized platform installer

Package the existing stack as offline server images plus controlled installation and operations scripts.

Pros:

- aligns with the current architecture
- minimizes application rewrites
- keeps environment parity across development and deployment
- is the fastest path to a stable Windows offering

Cons:

- requires shipping a local container runtime strategy
- needs strong operational scripting around install, update, and backup

### Approach 2: Native Windows services for every component

Repackage web, API, database, storage, queue, and observability as native Windows services.

Pros:

- more Windows-native operational appearance

Cons:

- high implementation cost
- much higher integration risk
- large divergence from the current repo architecture

### Approach 3: Hybrid deployment

Keep some dependencies containerized and convert web/API into Windows services.

Pros:

- appears to reduce container dependence

Cons:

- increases operational complexity
- creates split deployment logic
- gives fewer benefits than a fully containerized package

## Recommendation

Use Approach 1.

Deliver two installation artifacts:

- `SIGES-Server-Setup.exe`
- `SIGES-Client-Setup.exe`

This keeps the server packaging close to the current application model while giving operators a Windows-friendly installation and support workflow.

## Target Deployment Model

### Server

A dedicated Windows machine hosts the complete SIGES stack locally and publishes the platform to the LAN.

The installed system exposes:

- `https://siges.cctv.local`

The server package is responsible for:

- importing the full offline service bundle
- configuring persistent data volumes
- loading environment configuration
- initializing the database and application bootstrap
- publishing web access on the LAN

### Clients

Each client PC receives a lightweight one-time installer that prepares browser access to the server.

The client package is responsible for:

- installing the internal root CA in the Windows trust store
- configuring name resolution for `siges.cctv.local`
- validating TLS connectivity to the server
- creating a shortcut for the application

## Server Installer Design

### Deliverable

`SIGES-Server-Setup.exe`

### Contents

The installer package includes:

- offline service images or equivalent sealed runtime artifacts for:
  - web
  - api
  - postgres/postgis
  - redis
  - redpanda
  - minio
  - grafana
- environment templates
- server certificate and internal CA material
- PowerShell operations scripts
- migration/bootstrap scripts
- installer configuration manifest

### Installation Flow

1. Validate supported Windows version and required privileges.
2. Validate minimum CPU, RAM, disk, and port availability.
3. Install or enable the required local runtime for the packaged stack.
4. Import the offline platform artifacts.
5. Create persistent data locations for:
   - database
   - object storage
   - observability/configuration state
   - application configuration
6. Generate or install the internal certificate set.
7. Configure local publication for `siges.cctv.local`.
8. Start the full SIGES stack.
9. Run database migrations and bootstrap tasks.
10. Run health checks and present final access information.

### Persistence

The deployment must persist at least:

- PostgreSQL data
- MinIO object data
- platform configuration
- TLS certificate material
- branding and operator-facing configuration
- logs required for troubleshooting

## Client Installer Design

### Deliverable

`SIGES-Client-Setup.exe`

### Responsibilities

The client installer does not install application services. It only prepares secure and reliable browser access to the server.

It must:

- install the SIGES internal root CA into the Windows trust store
- configure resolution for `siges.cctv.local`
- verify that the server certificate is trusted
- verify that `https://siges.cctv.local` responds
- create a desktop or Start Menu shortcut
- report success or the exact failure reason

### Client Experience

After client setup:

- the operator opens SIGES from a shortcut
- the browser reaches `https://siges.cctv.local`
- no certificate warning should appear

## Name Resolution Strategy

The deployment should not rely on external enterprise DNS being preconfigured.

The initial supported strategy is:

- installer-managed local resolution on each client

This is recommended as the first implementation because it is self-contained and predictable for offline LAN deployments.

The design should leave room for a future DNS-service mode on the server, but that is not required for phase 1.

## Certificate Strategy

The deployment uses:

- one internal root CA for the SIGES environment
- one server certificate for `siges.cctv.local`

Requirements:

- root CA installed on all clients through the client installer
- server certificate presented by the reverse proxy/public entrypoint
- certificate renewal workflow included in server operations tooling

Security note:

- private CA keys must stay only on the server-side administrative environment
- client packages distribute trust, not signing authority

## LAN Publication

The public entrypoint should be a reverse proxy endpoint that terminates HTTPS for:

- `siges.cctv.local`

The proxy should route internally to the web service and, when needed, forward API traffic cleanly without requiring clients to know separate service ports.

The desired external experience is one hostname, one scheme, and no operator-facing port knowledge.

## Operations Toolkit

The server installation must provide a supportable local operations kit.

Minimum operations:

- Start SIGES
- Stop SIGES
- Restart SIGES
- Show SIGES status
- Backup SIGES
- Restore SIGES
- Update SIGES
- Renew internal certificate
- Collect diagnostics

These may be delivered as PowerShell scripts, a small admin launcher, or both.

## Backup and Restore

Backup must include:

- PostgreSQL database dump or equivalent consistent database backup
- MinIO object storage content
- environment and platform configuration
- branding/customization data
- certificate materials required for continuity

Restore must:

- stop services safely
- restore data to the correct stores
- rehydrate configuration
- restart services
- run validation checks

## Update Model

Updates must work offline.

Recommended update flow:

1. operator receives a versioned offline update package
2. server imports new application/service artifacts
3. server runs migrations if required
4. services restart in controlled order
5. health checks confirm readiness

The update path must avoid destructive in-place patching without rollback preparation.

## Health and Diagnostics

The deployed platform must expose a support workflow that can answer:

- is the web entrypoint up?
- is the API up?
- is the database reachable?
- is storage reachable?
- is observability reachable?
- is the certificate valid?

Diagnostics should be available locally on the server without internet.

## Error Handling

### Server Installation Errors

The server installer must fail clearly for:

- unsupported Windows version
- insufficient disk or memory
- required ports already in use
- missing administrator rights
- runtime installation failure
- stack bootstrap failure
- migration failure
- certificate provisioning failure

### Client Installation Errors

The client installer must fail clearly for:

- missing administrator rights
- inability to import the CA
- inability to configure name resolution
- inability to reach `siges.cctv.local`
- TLS trust mismatch

## Testing Strategy

Validation should cover:

- clean server install on supported Windows targets
- repeat server install on a previously used machine
- client onboarding on multiple Windows client versions
- offline restart after machine reboot
- backup and restore cycle
- offline update cycle
- certificate trust validation on clients
- LAN access from multiple PCs simultaneously

## Phased Implementation Recommendation

### Phase 1

- define packaging format
- implement server offline bundle
- implement client installer
- publish through one hostname with internal TLS
- support install, start, stop, backup, restore

### Phase 2

- add update package workflow
- add richer diagnostics/admin launcher
- improve certificate renewal workflow

### Phase 3

- optional internal DNS-service mode
- optional centralized client rollout tooling

## Success Criteria

The deployment is successful when:

- a dedicated Windows server can install SIGES fully offline
- multiple LAN clients can access `https://siges.cctv.local`
- clients do not see certificate warnings
- the stack survives reboot and restart
- operators can back up, restore, and update without repository-level knowledge

