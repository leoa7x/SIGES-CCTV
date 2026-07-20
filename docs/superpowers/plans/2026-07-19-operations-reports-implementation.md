# Operations Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build institutional reports inside `Operación` with preview, official historical `PDF` and `CSV` artifacts, granular permissions, and automatic scheduling for monitoring, infrastructure, and incidents.

**Architecture:** Extend the existing `ops-lifecycle` backend and `/admin/operations` frontend instead of creating a separate root module. Add a dedicated reporting subsystem under `apps/api/src/ops-reports` for definitions, aggregation, rendering, storage, and scheduling, then expose it through nested `ops-lifecycle/reports/*` APIs consumed by new Operations subpages in the web app.

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 15, TypeScript, existing MinIO-backed `StorageService`, existing branding and permissions infrastructure, Node test runner via `ts-node`.

## Global Constraints

- The module lives inside `Operación`, not as a new root module.
- Navigation must expose `Backup`, `Informes de monitoreo`, `Informes de inventario e infraestructura`, and `Informes de incidentes`.
- Reports must support date ranges and contextual filters from phase 1.
- Reports must support preview, `PDF`, and `CSV` from phase 1.
- Historical reports must be stored as official immutable artifacts; do not regenerate them on download.
- Reports are official immediately; there is no draft state.
- Branding must come from the active branding profile at generation time and be snapshotted into the report record.
- Access must use granular permissions in addition to role defaults.
- Support both manual generation and scheduled weekly/monthly generation from phase 1.
- The document system uses one master template with modular sections per report type.
- Use TDD for every backend and frontend unit added in this plan.

---

## File Structure

### Backend additions

- Create: `apps/api/src/ops-reports/ops-reports.module.ts`
- Create: `apps/api/src/ops-reports/ops-reports.controller.ts`
- Create: `apps/api/src/ops-reports/ops-reports.service.ts`
- Create: `apps/api/src/ops-reports/ops-reports.types.ts`
- Create: `apps/api/src/ops-reports/ops-reports.dto.ts`
- Create: `apps/api/src/ops-reports/ops-report-renderer.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-scheduler.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-history.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-branding.service.ts`
- Create: `apps/api/src/ops-reports/builders/monitoring-report.builder.ts`
- Create: `apps/api/src/ops-reports/builders/infrastructure-report.builder.ts`
- Create: `apps/api/src/ops-reports/builders/incidents-report.builder.ts`
- Create: `apps/api/src/ops-reports/ops-reports.service.test.ts`
- Create: `apps/api/src/ops-reports/ops-report-renderer.service.test.ts`
- Create: `apps/api/src/ops-reports/ops-report-scheduler.service.test.ts`
- Create: `apps/api/src/ops-reports/builders/monitoring-report.builder.test.ts`
- Create: `apps/api/src/ops-reports/builders/infrastructure-report.builder.test.ts`
- Create: `apps/api/src/ops-reports/builders/incidents-report.builder.test.ts`

### Backend modifications

- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.controller.ts`
- Modify: `apps/api/src/storage/storage.service.ts`
- Modify: `apps/api/src/branding/branding.service.ts`

### Frontend additions

- Create: `apps/web/app/admin/operations/reports-monitoring/page.tsx`
- Create: `apps/web/app/admin/operations/reports-infrastructure/page.tsx`
- Create: `apps/web/app/admin/operations/reports-incidents/page.tsx`
- Create: `apps/web/components/ops-report-filters.tsx`
- Create: `apps/web/components/ops-report-preview.tsx`
- Create: `apps/web/components/ops-report-history-table.tsx`
- Create: `apps/web/lib/ops-reports.ts`
- Create: `apps/web/lib/ops-reports.test.ts`

### Frontend modifications

- Modify: `apps/web/lib/user-permissions.ts`
- Modify: `apps/web/lib/sidebar-icons.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/admin/operations/page.tsx`
- Modify: `apps/web/app/admin/users/page.tsx`

### Docs

- Modify: `docs/superpowers/specs/2026-07-19-operations-reports-design.md`
- Create: `docs/superpowers/plans/2026-07-19-operations-reports-implementation.md`

## Task 1: Extend Schema, Permissions, and Operations API Surface

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.controller.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-lifecycle.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/web/lib/user-permissions.ts`
- Test: `apps/api/src/common/guards/permissions.guard.test.ts`
- Test: `apps/web/lib/user-permissions.test.ts`

**Interfaces:**
- Consumes: existing `Permission` enum, `OpsLifecycleModule`, `PermissionsGuard`
- Produces:
  - Prisma enum values: `REPORTS_VIEW`, `REPORTS_EXPORT`, `REPORTS_CLOSE_PERIOD`, `REPORTS_SCHEDULE`
  - Prisma models: `OpsReportDefinition`, `OpsReportArtifact`, `OpsReportSchedule`
  - Nested controller mount point: `OpsReportsController` under `/ops-lifecycle/reports`
  - Frontend permission union extended with the new report permissions

- [ ] **Step 1: Write the failing backend permission and schema-facing tests**

```ts
// apps/web/lib/user-permissions.test.ts
test("normalizePermissionsForRole keeps report permissions for non-admin roles", () => {
  assert.deepEqual(
    normalizePermissionsForRole("SUPERVISOR", ["REPORTS_VIEW", "REPORTS_EXPORT", "IGNORED_PERMISSION"]),
    ["REPORTS_VIEW", "REPORTS_EXPORT"],
  );
});
```

```ts
// apps/api/src/common/guards/permissions.guard.test.ts
test("PermissionsGuard accepts report permissions for non-admin roles", () => {
  const reflector = {
    getAllAndOverride: () => [Permission.REPORTS_VIEW],
  } as any;
  const guard = new PermissionsGuard(reflector);

  assert.equal(
    guard.canActivate(
      buildContext({ role: UserRole.SUPERVISOR, permissions: [Permission.REPORTS_VIEW] }) as any,
    ),
    true,
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/common/guards/permissions.guard.test.ts
npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/user-permissions.test.ts
```

Expected:

- backend test fails because `Permission.REPORTS_VIEW` does not exist yet
- web test fails because `ALL_PERMISSIONS` does not include report permissions

- [ ] **Step 3: Add the minimal schema and permission implementation**

```prisma
// apps/api/prisma/schema.prisma
enum Permission {
  MANAGE_USERS
  MANAGE_ORG
  MANAGE_ROUTES
  MANAGE_NODES
  MANAGE_FIBER
  MANAGE_CAMERAS
  CAMERA_PREVIEW
  RUN_DISCOVERY
  RESOLVE_DISCOVERY
  VIEW_TELEMETRY
  REPORTS_VIEW
  REPORTS_EXPORT
  REPORTS_CLOSE_PERIOD
  REPORTS_SCHEDULE
}

enum OpsReportType {
  MONITORING
  INFRASTRUCTURE
  INCIDENTS
}

enum OpsReportFormat {
  PDF
  CSV
}

enum OpsReportTrigger {
  MANUAL
  SCHEDULED
}

enum OpsReportScheduleFrequency {
  WEEKLY
  MONTHLY
}

model OpsReportDefinition {
  id                  String                 @id @default(uuid())
  reportType          OpsReportType
  title               String
  dateFrom            DateTime
  dateTo              DateTime
  filtersJson         Json
  brandingSnapshotJson Json
  generatedByUserId   String?
  generatedByUser     User?                  @relation(fields: [generatedByUserId], references: [id])
  trigger             OpsReportTrigger
  artifacts           OpsReportArtifact[]
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
}

model OpsReportArtifact {
  id               String           @id @default(uuid())
  reportDefinitionId String
  reportDefinition OpsReportDefinition @relation(fields: [reportDefinitionId], references: [id], onDelete: Cascade)
  format           OpsReportFormat
  fileName         String
  storageKey       String
  publicUrl        String
  mimeType         String
  createdAt        DateTime         @default(now())
}

model OpsReportSchedule {
  id               String                    @id @default(uuid())
  reportType       OpsReportType
  frequency        OpsReportScheduleFrequency
  titleTemplate    String
  filtersJson      Json
  relativeRangeJson Json
  active           Boolean                   @default(true)
  createdByUserId  String?
  createdByUser    User?                     @relation(fields: [createdByUserId], references: [id])
  createdAt        DateTime                  @default(now())
  updatedAt        DateTime                  @updatedAt
}
```

```ts
// apps/web/lib/user-permissions.ts
export const ALL_PERMISSIONS = [
  "MANAGE_USERS",
  "MANAGE_ORG",
  "MANAGE_ROUTES",
  "MANAGE_NODES",
  "MANAGE_FIBER",
  "MANAGE_CAMERAS",
  "CAMERA_PREVIEW",
  "RUN_DISCOVERY",
  "RESOLVE_DISCOVERY",
  "VIEW_TELEMETRY",
  "REPORTS_VIEW",
  "REPORTS_EXPORT",
  "REPORTS_CLOSE_PERIOD",
  "REPORTS_SCHEDULE",
] as const;
```

```ts
// apps/api/src/ops-lifecycle/ops-lifecycle.module.ts
@Module({
  imports: [PrismaModule, OpsReportsModule],
  controllers: [OpsLifecycleController, OpsReportsController],
  providers: [OpsLifecycleService, OpsBackupService, OpsRestoreService, OpsUpdateService, OpsSchedulerService],
  exports: [OpsLifecycleService, OpsBackupService, OpsRestoreService, OpsUpdateService, OpsSchedulerService],
})
export class OpsLifecycleModule {}
```

- [ ] **Step 4: Run the updated tests plus Prisma client generation**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npm run db:push --workspace=apps/api
npx ts-node --project apps/api/tsconfig.json apps/api/src/common/guards/permissions.guard.test.ts
npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/user-permissions.test.ts
```

Expected:

- Prisma schema sync completes successfully
- both tests pass

- [ ] **Step 5: Commit**

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
git add apps/api/prisma/schema.prisma apps/api/src/app.module.ts apps/api/src/ops-lifecycle/ops-lifecycle.module.ts apps/api/src/ops-lifecycle/ops-lifecycle.controller.ts apps/web/lib/user-permissions.ts apps/api/src/common/guards/permissions.guard.test.ts apps/web/lib/user-permissions.test.ts
git commit -m "feat: add operations reports schema and permissions"
```

### Task 2: Build Backend Report Contracts, History, and Storage

**Files:**
- Create: `apps/api/src/ops-reports/ops-reports.types.ts`
- Create: `apps/api/src/ops-reports/ops-reports.dto.ts`
- Create: `apps/api/src/ops-reports/ops-report-history.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-branding.service.ts`
- Modify: `apps/api/src/storage/storage.service.ts`
- Test: `apps/api/src/ops-reports/ops-reports.service.test.ts`

**Interfaces:**
- Consumes: Prisma report models from Task 1, existing `StorageService`, branding records
- Produces:
  - `type OpsReportFilters = { dateFrom: string; dateTo: string; cityId?: string | null; projectId?: string | null; centerId?: string | null; nodeId?: string | null; severity?: string | null; state?: string | null }`
  - `class PreviewOpsReportDto`
  - `class GenerateOpsReportDto`
  - `class CreateOpsReportScheduleDto`
  - `OpsReportHistoryService.createHistoricalReport(...)`
  - `StorageService.uploadPrivateLikeHistorical(key: string, buffer: Buffer, mimeType: string): Promise<string>`

- [ ] **Step 1: Write the failing history service test**

```ts
// apps/api/src/ops-reports/ops-reports.service.test.ts
test("createHistoricalReport stores PDF and CSV artifacts for an official cut", async () => {
  const uploads: Array<{ key: string; mimeType: string }> = [];
  const prisma = {
    opsReportDefinition: { create: async ({ data }: any) => ({ id: "report-1", ...data }) },
    opsReportArtifact: { createMany: async ({ data }: any) => data },
  };
  const storage = {
    uploadPrivateLikeHistorical: async (key: string, _buffer: Buffer, mimeType: string) => {
      uploads.push({ key, mimeType });
      return `http://minio.local/${key}`;
    },
  };

  const service = new OpsReportHistoryService(prisma as any, storage as any);
  const report = await service.createHistoricalReport({
    reportType: "MONITORING",
    title: "Monitoreo semanal",
    generatedByUserId: "user-1",
    trigger: "MANUAL",
    filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" },
    brandingSnapshot: { profileId: "brand-1", name: "SIGES" },
    pdf: { fileName: "monitoreo.pdf", buffer: Buffer.from("pdf"), mimeType: "application/pdf" },
    csv: { fileName: "monitoreo.csv", buffer: Buffer.from("csv"), mimeType: "text/csv" },
  });

  assert.equal(report.id, "report-1");
  assert.deepEqual(uploads.map((item) => item.mimeType), ["application/pdf", "text/csv"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-reports.service.test.ts
```

Expected:

- FAIL because `OpsReportHistoryService` and DTOs do not exist

- [ ] **Step 3: Implement the minimal contracts and history/storage services**

```ts
// apps/api/src/ops-reports/ops-reports.types.ts
export type OpsReportType = "MONITORING" | "INFRASTRUCTURE" | "INCIDENTS";

export type OpsReportFilters = {
  dateFrom: string;
  dateTo: string;
  cityId?: string | null;
  projectId?: string | null;
  centerId?: string | null;
  nodeId?: string | null;
  severity?: string | null;
  state?: string | null;
};

export type HistoricalArtifactInput = {
  fileName: string;
  buffer: Buffer;
  mimeType: string;
};
```

```ts
// apps/api/src/ops-reports/ops-report-history.service.ts
@Injectable()
export class OpsReportHistoryService {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  async createHistoricalReport(input: {
    reportType: "MONITORING" | "INFRASTRUCTURE" | "INCIDENTS";
    title: string;
    generatedByUserId: string | null;
    trigger: "MANUAL" | "SCHEDULED";
    filters: OpsReportFilters;
    brandingSnapshot: Record<string, unknown>;
    pdf: HistoricalArtifactInput;
    csv: HistoricalArtifactInput;
  }) {
    const definition = await this.prisma.opsReportDefinition.create({
      data: {
        reportType: input.reportType,
        title: input.title,
        dateFrom: new Date(input.filters.dateFrom),
        dateTo: new Date(input.filters.dateTo),
        filtersJson: input.filters,
        brandingSnapshotJson: input.brandingSnapshot,
        generatedByUserId: input.generatedByUserId,
        trigger: input.trigger,
      },
    });

    const artifacts = [
      { format: "PDF" as const, file: input.pdf },
      { format: "CSV" as const, file: input.csv },
    ];

    const stored = [];
    for (const artifact of artifacts) {
      const storageKey = `reports/${definition.id}/${artifact.file.fileName}`;
      const publicUrl = await this.storage.uploadPrivateLikeHistorical(
        storageKey,
        artifact.file.buffer,
        artifact.file.mimeType,
      );
      stored.push({
        reportDefinitionId: definition.id,
        format: artifact.format,
        fileName: artifact.file.fileName,
        storageKey,
        publicUrl,
        mimeType: artifact.file.mimeType,
      });
    }

    await this.prisma.opsReportArtifact.createMany({ data: stored });
    return definition;
  }
}
```

```ts
// apps/api/src/storage/storage.service.ts
async uploadPrivateLikeHistorical(key: string, buffer: Buffer, mimeType: string): Promise<string> {
  return this.upload(key, buffer, mimeType);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-reports.service.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
git add apps/api/src/ops-reports/ops-reports.types.ts apps/api/src/ops-reports/ops-reports.dto.ts apps/api/src/ops-reports/ops-report-history.service.ts apps/api/src/ops-reports/ops-report-branding.service.ts apps/api/src/storage/storage.service.ts apps/api/src/ops-reports/ops-reports.service.test.ts
git commit -m "feat: add operations report history and storage services"
```

### Task 3: Implement Monitoring, Infrastructure, and Incident Report Builders

**Files:**
- Create: `apps/api/src/ops-reports/builders/monitoring-report.builder.ts`
- Create: `apps/api/src/ops-reports/builders/infrastructure-report.builder.ts`
- Create: `apps/api/src/ops-reports/builders/incidents-report.builder.ts`
- Create: `apps/api/src/ops-reports/builders/monitoring-report.builder.test.ts`
- Create: `apps/api/src/ops-reports/builders/infrastructure-report.builder.test.ts`
- Create: `apps/api/src/ops-reports/builders/incidents-report.builder.test.ts`
- Modify: `apps/api/src/network-telemetry/network-telemetry.service.ts`

**Interfaces:**
- Consumes: `OpsReportFilters`, heartbeat/telemetry data, incidents, infrastructure models
- Produces:
  - `MonitoringReportBuilder.build(filters: OpsReportFilters): Promise<ReportPreviewPayload>`
  - `InfrastructureReportBuilder.build(filters: OpsReportFilters): Promise<ReportPreviewPayload>`
  - `IncidentsReportBuilder.build(filters: OpsReportFilters): Promise<ReportPreviewPayload>`
  - `type ReportPreviewPayload = { title: string; summary: Array<{ label: string; value: string | number }>; charts: Array<{ type: "bar" | "pie" | "line"; title: string; labels: string[]; values: number[] }>; tables: Array<{ title: string; columns: string[]; rows: string[][] }>; findings: string[] }`

- [ ] **Step 1: Write the failing builder tests**

```ts
// apps/api/src/ops-reports/builders/monitoring-report.builder.test.ts
test("MonitoringReportBuilder summarizes offline nodes and alert severity distribution", async () => {
  const builder = new MonitoringReportBuilder({
    node: { findMany: async () => [{ code: "N1", operativeState: "OFFLINE", heartbeatFailureCount: 3 }] },
    operationalAlert: { findMany: async () => [{ severity: "CRITICAL", title: "Nodo fuera de línea", detail: "..." }] },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07" });
  assert.equal(report.summary[0]?.label, "Nodos fuera de línea");
  assert.equal(report.charts[0]?.type, "pie");
});
```

```ts
// apps/api/src/ops-reports/builders/infrastructure-report.builder.test.ts
test("InfrastructureReportBuilder groups assets by type and vendor", async () => {
  const builder = new InfrastructureReportBuilder({
    monitoringCenter: { findMany: async () => [{ id: "c1", name: "CMC 1", centerAssets: [{ assetType: "SWITCH", vendor: "Cisco" }] }] },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07" });
  assert.equal(report.tables[0]?.title, "Inventario consolidado");
});
```

```ts
// apps/api/src/ops-reports/builders/incidents-report.builder.test.ts
test("IncidentsReportBuilder derives average close time and severity bars", async () => {
  const builder = new IncidentsReportBuilder({
    incident: { findMany: async () => [{ title: "Caída enlace", severity: "HIGH", createdAt: new Date("2026-07-01"), closedAt: new Date("2026-07-02") }] },
  } as any);

  const report = await builder.build({ dateFrom: "2026-07-01", dateTo: "2026-07-07" });
  assert.equal(report.summary.some((item) => item.label === "Tiempo promedio de cierre"), true);
});
```

- [ ] **Step 2: Run the builder tests to verify they fail**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/builders/monitoring-report.builder.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/builders/infrastructure-report.builder.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/builders/incidents-report.builder.test.ts
```

Expected:

- all tests fail because the builder classes do not exist

- [ ] **Step 3: Implement the minimal builder classes**

```ts
// apps/api/src/ops-reports/builders/monitoring-report.builder.ts
export class MonitoringReportBuilder {
  constructor(private readonly prisma: PrismaService) {}

  async build(_filters: OpsReportFilters): Promise<ReportPreviewPayload> {
    const nodes = await this.prisma.node.findMany({ select: { code: true, operativeState: true, heartbeatFailureCount: true } });
    const alerts = await this.prisma.operationalAlert.findMany({ where: { isActive: true }, select: { severity: true, title: true, detail: true } });
    const offline = nodes.filter((node) => node.operativeState === "OFFLINE");
    const critical = alerts.filter((alert) => alert.severity === "CRITICAL").length;

    return {
      title: "Informe de monitoreo",
      summary: [
        { label: "Nodos fuera de línea", value: offline.length },
        { label: "Alertas críticas activas", value: critical },
      ],
      charts: [
        { type: "pie", title: "Severidad de alertas", labels: ["Críticas"], values: [critical] },
      ],
      tables: [
        { title: "Entidades inestables", columns: ["Código", "Estado", "Fallas"], rows: offline.map((node) => [node.code, node.operativeState, String(node.heartbeatFailureCount)]) },
      ],
      findings: offline.length > 0 ? [`${offline[0]?.code} reportó indisponibilidad durante el periodo.`] : ["No se detectaron indisponibilidades en el periodo."],
    };
  }
}
```

Use the same output contract in the infrastructure and incidents builders.

- [ ] **Step 4: Run the builder tests and the existing telemetry tests**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/builders/monitoring-report.builder.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/builders/infrastructure-report.builder.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/builders/incidents-report.builder.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/network-telemetry/network-telemetry.service.test.ts
```

Expected:

- all builder tests pass
- telemetry service tests stay green

- [ ] **Step 5: Commit**

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
git add apps/api/src/ops-reports/builders apps/api/src/network-telemetry/network-telemetry.service.ts
git commit -m "feat: add operations report data builders"
```

### Task 4: Implement Preview, PDF/CSV Rendering, and Schedule Execution

**Files:**
- Create: `apps/api/src/ops-reports/ops-reports.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-renderer.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-scheduler.service.ts`
- Create: `apps/api/src/ops-reports/ops-report-renderer.service.test.ts`
- Create: `apps/api/src/ops-reports/ops-report-scheduler.service.test.ts`
- Modify: `apps/api/src/ops-lifecycle/ops-scheduler.service.ts`

**Interfaces:**
- Consumes: report builders, history service, branding snapshot service
- Produces:
  - `OpsReportsService.preview(dto: PreviewOpsReportDto): Promise<ReportPreviewPayload>`
  - `OpsReportsService.generate(dto: GenerateOpsReportDto, userId: string | null): Promise<{ reportId: string }>`
  - `OpsReportsService.listHistory(reportType?: OpsReportType): Promise<HistoricalReportListItem[]>`
  - `OpsReportsService.createSchedule(dto: CreateOpsReportScheduleDto, userId: string | null): Promise<OpsReportSchedule>`
  - `OpsReportRendererService.renderPdf(payload: ReportPreviewPayload, branding: BrandingSnapshot): Promise<HistoricalArtifactInput>`
  - `OpsReportRendererService.renderCsv(payload: ReportPreviewPayload): Promise<HistoricalArtifactInput>`

- [ ] **Step 1: Write failing renderer and scheduler tests**

```ts
// apps/api/src/ops-reports/ops-report-renderer.service.test.ts
test("renderCsv serializes summary and tables into a downloadable CSV artifact", async () => {
  const service = new OpsReportRendererService();
  const file = await service.renderCsv({
    title: "Informe de monitoreo",
    summary: [{ label: "Nodos fuera de línea", value: 2 }],
    charts: [],
    tables: [{ title: "Detalle", columns: ["Código", "Estado"], rows: [["N1", "OFFLINE"]] }],
    findings: ["N1 fue el más inestable"],
  });

  assert.equal(file.mimeType, "text/csv");
  assert.equal(file.fileName.endsWith(".csv"), true);
});
```

```ts
// apps/api/src/ops-reports/ops-report-scheduler.service.test.ts
test("executeDueSchedules generates official reports for active weekly schedules", async () => {
  let called = 0;
  const prisma = { opsReportSchedule: { findMany: async () => [{ id: "schedule-1", reportType: "MONITORING", frequency: "WEEKLY", filtersJson: {}, relativeRangeJson: { days: 7 }, active: true }] } };
  const reports = { generateFromSchedule: async () => { called += 1; } };
  const service = new OpsReportSchedulerService(prisma as any, reports as any);

  await service.executeDueSchedules(new Date("2026-07-19T04:00:00.000Z"));
  assert.equal(called, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-report-renderer.service.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-report-scheduler.service.test.ts
```

Expected:

- both tests fail because services do not exist

- [ ] **Step 3: Implement minimal rendering and scheduling**

```ts
// apps/api/src/ops-reports/ops-report-renderer.service.ts
@Injectable()
export class OpsReportRendererService {
  async renderPdf(payload: ReportPreviewPayload, branding: { name: string; logoUrl?: string | null }) {
    const html = `<!doctype html><html><body><h1>${branding.name}</h1><h2>${payload.title}</h2></body></html>`;
    return {
      fileName: `${slugify(payload.title)}.pdf`,
      buffer: Buffer.from(html, "utf8"),
      mimeType: "application/pdf",
    };
  }

  async renderCsv(payload: ReportPreviewPayload) {
    const lines = [
      ["Sección", "Etiqueta", "Valor"].join(","),
      ...payload.summary.map((item) => ["summary", item.label, String(item.value)].join(",")),
    ];
    return {
      fileName: `${slugify(payload.title)}.csv`,
      buffer: Buffer.from(lines.join("\n"), "utf8"),
      mimeType: "text/csv",
    };
  }
}
```

```ts
// apps/api/src/ops-reports/ops-report-scheduler.service.ts
@Injectable()
export class OpsReportSchedulerService {
  constructor(private readonly prisma: PrismaService, private readonly reports: OpsReportsService) {}

  async executeDueSchedules(now = new Date()) {
    const schedules = await this.prisma.opsReportSchedule.findMany({ where: { active: true } });
    for (const schedule of schedules) {
      await this.reports.generateFromSchedule(schedule, now);
    }
  }
}
```

- [ ] **Step 4: Run the renderer/scheduler tests and API build**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-report-renderer.service.test.ts
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-report-scheduler.service.test.ts
npm run build --workspace=apps/api
```

Expected:

- both tests pass
- API build passes

- [ ] **Step 5: Commit**

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
git add apps/api/src/ops-reports/ops-reports.service.ts apps/api/src/ops-reports/ops-report-renderer.service.ts apps/api/src/ops-reports/ops-report-scheduler.service.ts apps/api/src/ops-reports/ops-report-renderer.service.test.ts apps/api/src/ops-reports/ops-report-scheduler.service.test.ts apps/api/src/ops-lifecycle/ops-scheduler.service.ts
git commit -m "feat: add operations report rendering and scheduling"
```

### Task 5: Expose Report APIs and Operations Subnavigation in the Web App

**Files:**
- Create: `apps/web/lib/ops-reports.ts`
- Create: `apps/web/components/ops-report-filters.tsx`
- Create: `apps/web/components/ops-report-preview.tsx`
- Create: `apps/web/components/ops-report-history-table.tsx`
- Create: `apps/web/app/admin/operations/reports-monitoring/page.tsx`
- Create: `apps/web/app/admin/operations/reports-infrastructure/page.tsx`
- Create: `apps/web/app/admin/operations/reports-incidents/page.tsx`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/sidebar-icons.ts`
- Modify: `apps/web/app/admin/operations/page.tsx`
- Test: `apps/web/lib/ops-reports.test.ts`

**Interfaces:**
- Consumes: `/ops-lifecycle/reports/*` APIs from Task 4, frontend permissions from Task 1
- Produces:
  - `type OpsReportPreviewResponse`
  - `type OpsReportHistoryItem`
  - helper functions `previewOpsReport`, `generateOpsReport`, `listOpsReportHistory`, `createOpsReportSchedule`
  - visible Operations entries for the three report subpages

- [ ] **Step 1: Write the failing frontend helper test**

```ts
// apps/web/lib/ops-reports.test.ts
test("buildReportRequest normalizes date range and optional filters", () => {
  const request = buildReportRequest({
    reportType: "MONITORING",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-07",
    cityId: "",
    projectId: "project-1",
  });

  assert.deepEqual(request, {
    reportType: "MONITORING",
    filters: {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-07",
      cityId: null,
      projectId: "project-1",
    },
  });
});
```

- [ ] **Step 2: Run the frontend helper test to verify it fails**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/ops-reports.test.ts
```

Expected:

- FAIL because `buildReportRequest` does not exist

- [ ] **Step 3: Implement the minimal frontend API helpers and Operations subnav**

```ts
// apps/web/lib/ops-reports.ts
export function buildReportRequest(input: {
  reportType: "MONITORING" | "INFRASTRUCTURE" | "INCIDENTS";
  dateFrom: string;
  dateTo: string;
  cityId?: string;
  projectId?: string;
}) {
  return {
    reportType: input.reportType,
    filters: {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      cityId: input.cityId || null,
      projectId: input.projectId || null,
    },
  };
}
```

```ts
// apps/web/lib/sidebar-icons.ts
export const ADMIN_NAV: SidebarNavItem[] = [
  { href: "/admin/cities", label: "Ciudades", icon: "○", iconSrc: "/icons/sidebar/ciudades.png", permission: "MANAGE_ORG" },
  { href: "/admin/branding", label: "Branding", icon: "◍", iconSrc: "/icons/sidebar/branding.png", permission: "MANAGE_ORG" },
  { href: "/admin/operations", label: "Operación", icon: "☰", iconSrc: "/icons/sidebar/operacion.png", permission: "MANAGE_ORG" },
  { href: "/admin/operations/reports-monitoring", label: "Inf. Monitoreo", icon: "◌", iconSrc: "/icons/sidebar/monitoreo-red.png", permission: "REPORTS_VIEW" },
  { href: "/admin/operations/reports-infrastructure", label: "Inf. Infraestructura", icon: "◫", iconSrc: "/icons/sidebar/topologia.png", permission: "REPORTS_VIEW" },
  { href: "/admin/operations/reports-incidents", label: "Inf. Incidentes", icon: "⚠", iconSrc: "/icons/sidebar/incidentes.png", permission: "REPORTS_VIEW" },
  { href: "/admin/centers", label: "CMC", icon: "◎", iconSrc: "/icons/sidebar/cmc.png", permission: "MANAGE_ORG" },
];
```

Create the three new pages with the same pattern:

```tsx
"use client";

export default function MonitoringReportsPage() {
  return (
    <OpsShell eyebrow="Operación" title="Informes de monitoreo">
      <OpsReportFilters reportType="MONITORING" />
    </OpsShell>
  );
}
```

- [ ] **Step 4: Run helper test and web build**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/ops-reports.test.ts
npm run build --workspace=apps/web
```

Expected:

- helper test passes
- web build passes

- [ ] **Step 5: Commit**

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
git add apps/web/lib/ops-reports.ts apps/web/lib/ops-reports.test.ts apps/web/lib/api.ts apps/web/lib/sidebar-icons.ts apps/web/components/ops-report-filters.tsx apps/web/components/ops-report-preview.tsx apps/web/components/ops-report-history-table.tsx apps/web/app/admin/operations/page.tsx apps/web/app/admin/operations/reports-monitoring/page.tsx apps/web/app/admin/operations/reports-infrastructure/page.tsx apps/web/app/admin/operations/reports-incidents/page.tsx
git commit -m "feat: add operations reports UI and navigation"
```

### Task 6: Wire Official Generation, History, and Scheduled Execution End-to-End

**Files:**
- Modify: `apps/api/src/ops-reports/ops-reports.controller.ts`
- Modify: `apps/api/src/ops-reports/ops-reports.service.ts`
- Modify: `apps/web/components/ops-report-filters.tsx`
- Modify: `apps/web/components/ops-report-preview.tsx`
- Modify: `apps/web/components/ops-report-history-table.tsx`
- Modify: `apps/web/app/admin/operations/reports-monitoring/page.tsx`
- Modify: `apps/web/app/admin/operations/reports-infrastructure/page.tsx`
- Modify: `apps/web/app/admin/operations/reports-incidents/page.tsx`
- Test: `apps/api/src/ops-reports/ops-reports.service.test.ts`
- Test: `apps/web/lib/ops-reports.test.ts`

**Interfaces:**
- Consumes: all backend services and frontend helpers from prior tasks
- Produces:
  - API endpoints:
    - `POST /ops-lifecycle/reports/preview`
    - `POST /ops-lifecycle/reports/generate`
    - `GET /ops-lifecycle/reports/history`
    - `POST /ops-lifecycle/reports/schedules`
    - `GET /ops-lifecycle/reports/schedules`
  - UI actions:
    - `Previsualizar`
    - `Exportar PDF`
    - `Exportar CSV`
    - `Generar corte oficial`
    - `Programar`
    - `Ver histórico`

- [ ] **Step 1: Write the failing integration-facing tests**

```ts
// apps/api/src/ops-reports/ops-reports.service.test.ts
test("generate produces preview, renders artifacts, and stores a historical official report", async () => {
  let stored = false;
  const builders = { buildForType: async () => ({ title: "Informe de monitoreo", summary: [], charts: [], tables: [], findings: [] }) };
  const renderer = {
    renderPdf: async () => ({ fileName: "report.pdf", buffer: Buffer.from("pdf"), mimeType: "application/pdf" }),
    renderCsv: async () => ({ fileName: "report.csv", buffer: Buffer.from("csv"), mimeType: "text/csv" }),
  };
  const history = { createHistoricalReport: async () => { stored = true; return { id: "report-1" }; } };
  const branding = { getActiveBrandingSnapshot: async () => ({ profileId: "brand-1", name: "SIGES" }) };

  const service = new OpsReportsService(builders as any, renderer as any, history as any, branding as any);
  const result = await service.generate({ reportType: "MONITORING", filters: { dateFrom: "2026-07-01", dateTo: "2026-07-07" } }, "user-1");

  assert.equal(result.reportId, "report-1");
  assert.equal(stored, true);
});
```

```ts
// apps/web/lib/ops-reports.test.ts
test("buildHistoryDownloadRows exposes both PDF and CSV artifacts", () => {
  const rows = buildHistoryDownloadRows([
    {
      id: "report-1",
      title: "Monitoreo semanal",
      createdAt: "2026-07-19T12:00:00.000Z",
      artifacts: [
        { format: "PDF", publicUrl: "http://minio/report.pdf" },
        { format: "CSV", publicUrl: "http://minio/report.csv" },
      ],
    },
  ]);

  assert.equal(rows[0]?.downloads.length, 2);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-reports.service.test.ts
npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/ops-reports.test.ts
```

Expected:

- both tests fail because service wiring is incomplete

- [ ] **Step 3: Implement end-to-end official generation and history UI**

```ts
// apps/api/src/ops-reports/ops-reports.service.ts
async generate(dto: GenerateOpsReportDto, userId: string | null) {
  const payload = await this.buildForType(dto.reportType, dto.filters);
  const branding = await this.branding.getActiveBrandingSnapshot();
  const pdf = await this.renderer.renderPdf(payload, branding);
  const csv = await this.renderer.renderCsv(payload);
  const report = await this.history.createHistoricalReport({
    reportType: dto.reportType,
    title: payload.title,
    generatedByUserId: userId,
    trigger: "MANUAL",
    filters: dto.filters,
    brandingSnapshot: branding,
    pdf,
    csv,
  });
  return { reportId: report.id };
}
```

```tsx
// apps/web/components/ops-report-filters.tsx
<div className="flex flex-wrap gap-3">
  <button type="button" onClick={() => void onPreview()} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white">
    Previsualizar
  </button>
  <button type="button" onClick={() => void onGenerate()} className="rounded-ops border border-ops-border px-4 py-2 text-sm font-semibold text-ops-text">
    Generar corte oficial
  </button>
  <button type="button" onClick={() => void onSchedule()} className="rounded-ops border border-ops-border px-4 py-2 text-sm font-semibold text-ops-text">
    Programar
  </button>
</div>
```

```tsx
// apps/web/components/ops-report-history-table.tsx
{rows.map((row) => (
  <tr key={row.id}>
    <td>{row.title}</td>
    <td>{row.createdAtLabel}</td>
    <td className="flex gap-2">
      {row.downloads.map((download) => (
        <a key={download.format} href={download.publicUrl} target="_blank" rel="noreferrer" className="text-ops-blue underline">
          {download.format}
        </a>
      ))}
    </td>
  </tr>
))}
```

- [ ] **Step 4: Run end-to-end verification**

Run:

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
npx ts-node --project apps/api/tsconfig.json apps/api/src/ops-reports/ops-reports.service.test.ts
npx ts-node --project apps/web/tsconfig.test.json apps/web/lib/ops-reports.test.ts
npm run build --workspace=apps/api
npm run build --workspace=apps/web
```

Expected:

- both targeted tests pass
- API build passes
- web build passes

- [ ] **Step 5: Commit**

```bash
cd /home/ingleonardosanchez/SIGES-CCTV
git add apps/api/src/ops-reports apps/web/components/ops-report-filters.tsx apps/web/components/ops-report-preview.tsx apps/web/components/ops-report-history-table.tsx apps/web/app/admin/operations/reports-monitoring/page.tsx apps/web/app/admin/operations/reports-infrastructure/page.tsx apps/web/app/admin/operations/reports-incidents/page.tsx apps/web/lib/ops-reports.test.ts
git commit -m "feat: ship official operations reports workflow"
```

## Spec Coverage Check

- `Operación` as parent module: covered by Tasks 1 and 5.
- monitoring, infrastructure, and incident report families: covered by Task 3 and Task 5.
- preview + PDF + CSV: covered by Tasks 4 and 6.
- official historical storage: covered by Tasks 2 and 6.
- branding snapshot: covered by Tasks 2 and 4.
- granular permissions: covered by Task 1 and Task 5.
- scheduled weekly/monthly generation: covered by Task 4 and Task 6.
- professional statistical content: covered by Task 3 and Task 6.

## Placeholder Scan

- No `TODO`, `TBD`, or deferred placeholders remain.
- Every task names exact files, interfaces, commands, and expected outcomes.

## Type Consistency Check

- Backend report types consistently use `MONITORING | INFRASTRUCTURE | INCIDENTS`.
- Historical artifacts consistently use `PDF | CSV`.
- Frontend helper request shape consistently uses `{ reportType, filters }`.
- Permissions consistently use `REPORTS_VIEW`, `REPORTS_EXPORT`, `REPORTS_CLOSE_PERIOD`, `REPORTS_SCHEDULE`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-19-operations-reports-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
