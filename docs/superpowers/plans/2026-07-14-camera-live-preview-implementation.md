# Camera Live Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure live camera preview to the camera create/edit form, backed by persisted stream metadata and a reusable preview-session API that can later be reused from GIS node popups.

**Architecture:** Extend the existing `Camera` domain with stream metadata and safe read/write DTO boundaries, then add a dedicated camera preview module in the Nest API that owns preview session lifecycle and media routing. The web camera form consumes the preview API through a modal-local live preview panel, while keeping the media contract reusable for future GIS node clicks.

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, Next.js 15, React 19, TypeScript 5, node:test, ffmpeg-backed preview bridge via Node child processes.

## Global Constraints

- Keep the first version focused on live preview only; do not add recording, retention, motion detection, PTZ, playback, or timeline features.
- Keep node coordinates as the source of truth for later GIS-driven stream access.
- Never return stored camera passwords in list or detail APIs.
- Encrypt stream passwords at rest.
- Redact secrets from logs and errors.
- Bind preview sessions to the authenticated user.
- Expire preview sessions aggressively.
- Ensure preview routes are authenticated and non-cacheable.
- Do not couple preview startup to camera create; operators must be able to save first and test later.
- Define the media adapter behind an interface so the transport can later evolve without data migration.

---

## File Structure

- Modify `apps/api/prisma/schema.prisma`
  - extend `Camera` with stream metadata and preview health fields
- Create `apps/api/prisma/migrations/<timestamp>_camera_live_preview/migration.sql`
  - persist the schema changes
- Modify `apps/api/src/cameras/cameras.service.ts`
  - expand DTOs, sanitize read models, persist encrypted stream credentials
- Modify `apps/api/src/cameras/cameras.controller.ts`
  - expose create/update payload changes and preview endpoints
- Create `apps/api/src/cameras/camera-secret.service.ts`
  - encrypt/decrypt stream passwords
- Create `apps/api/src/cameras/cameras.service.test.ts`
  - verify DTO persistence and secret-safe read models
- Modify `apps/api/package.json`
  - add a camera test script
- Create `apps/api/src/camera-preview/camera-preview.types.ts`
  - preview session and adapter interfaces
- Create `apps/api/src/camera-preview/camera-preview.adapter.ts`
  - adapter contract
- Create `apps/api/src/camera-preview/ffmpeg-preview.adapter.ts`
  - ffmpeg-backed direct live preview implementation
- Create `apps/api/src/camera-preview/camera-preview.service.ts`
  - preview session lifecycle, auth binding, expiry, status transitions
- Create `apps/api/src/camera-preview/camera-preview.controller.ts`
  - start/status/stop/media routes
- Create `apps/api/src/camera-preview/camera-preview.module.ts`
  - Nest module wiring
- Create `apps/api/src/camera-preview/camera-preview.service.test.ts`
  - validate session lifecycle and error mapping
- Modify `apps/api/src/app.module.ts`
  - register preview module
- Modify `apps/web/lib/api.ts`
  - add preview DTO types and helper calls
- Create `apps/web/lib/camera-preview.ts`
  - form-facing preview state helpers
- Create `apps/web/lib/camera-preview.test.ts`
  - unit tests for UI preview state handling
- Modify `apps/web/package.json`
  - add camera preview web test script
- Modify `apps/web/app/admin/cameras/page.tsx`
  - add stream fields, live preview panel, start/stop flow

### Task 1: Persist camera stream metadata and protect secrets

**Files:**
- Create: `apps/api/src/cameras/camera-secret.service.ts`
- Create: `apps/api/src/cameras/cameras.service.test.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/cameras/cameras.service.ts`
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/cameras/cameras.module.ts`
- Modify: `apps/api/prisma/seed.ts`
- Modify: `apps/api/prisma/seed.js`

**Interfaces:**
- Consumes: existing `Camera` Prisma model and `CamerasService` CRUD flow
- Produces:
  - `CreateCameraDto.streamUrl?: string`
  - `CreateCameraDto.streamUsername?: string`
  - `CreateCameraDto.streamPassword?: string`
  - `CreateCameraDto.streamTransport?: "TCP" | "UDP"`
  - `CreateCameraDto.previewEnabled?: boolean`
  - `CreateCameraDto.onvifUrl?: string`
  - same optional fields on `UpdateCameraDto`
  - `CameraSecretService.encrypt(plainText: string): string`
  - `CameraSecretService.decrypt(cipherText: string): string`
  - `CamerasService.findOne(id: string): Promise<SafeCameraDetail>`

- [ ] **Step 1: Write the failing API test for secret-safe camera reads**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { CameraTransport } from "@prisma/client";
import { CamerasService } from "./cameras.service";

test("findOne omits encrypted stream password but returns preview metadata", async () => {
  const prisma = {
    camera: {
      findUniqueOrThrow: async () => ({
        id: "cam-1",
        code: "CAM-001",
        name: "Camara Norte",
        ip: "192.168.1.20",
        streamUrl: "rtsp://192.168.1.20:554/stream1",
        streamUsername: "admin",
        streamPasswordEncrypted: "cipher-text",
        streamTransport: CameraTransport.TCP,
        previewEnabled: true,
        onvifUrl: "http://192.168.1.20/onvif/device_service",
        lastPreviewStatus: "LIVE",
        node: { id: "node-1", code: "N-001", name: "Nodo Norte", route: { center: { name: "CMC Norte" } } },
      }),
    },
  };

  const secretService = { encrypt: (value: string) => value, decrypt: () => "super-secret" };
  const service = new CamerasService(prisma as never, secretService as never);

  const result = await service.findOne("cam-1");

  assert.equal(result.streamPassword, undefined);
  assert.equal(result.streamUrl, "rtsp://192.168.1.20:554/stream1");
  assert.equal(result.previewEnabled, true);
  assert.equal(result.streamTransport, "TCP");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:cameras --workspace=apps/api`  
Expected: FAIL with missing `test:cameras` script and missing preview fields/services.

- [ ] **Step 3: Extend Prisma camera schema for stream metadata**

```prisma
model Camera {
  id                     String          @id @default(uuid())
  code                   String          @unique
  name                   String
  ip                     String?
  brand                  String?
  model                  String?
  resolution             String?
  state                  CameraState     @default(ONLINE)
  hasAnalytics           Boolean         @default(false)
  streamUrl              String?
  streamUsername         String?
  streamPasswordEncrypted String?
  streamTransport        CameraTransport @default(TCP)
  previewEnabled         Boolean         @default(false)
  onvifUrl               String?
  lastPreviewCheckAt     DateTime?
  lastPreviewStatus      String?
  nodeId                 String
  node                   Node            @relation(fields: [nodeId], references: [id])
  incidents              Incident[]      @relation("CameraIncidents")
  createdAt              DateTime        @default(now())
  updatedAt              DateTime        @updatedAt
}

enum CameraTransport {
  TCP
  UDP
}
```

- [ ] **Step 4: Add a focused secret service and safe camera DTO mapping**

```ts
import { Injectable } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

@Injectable()
export class CameraSecretService {
  private readonly key = createHash("sha256")
    .update(process.env.CAMERA_SECRET_KEY ?? process.env.JWT_SECRET ?? "dev_secret_change_me")
    .digest();

  encrypt(plainText: string) {
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
  }

  decrypt(cipherText: string) {
    const [ivHex, payloadHex] = cipherText.split(":");
    const decipher = createDecipheriv("aes-256-cbc", this.key, Buffer.from(ivHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(payloadHex, "hex")), decipher.final()]);
    return decrypted.toString("utf8");
  }
}
```

```ts
type SafeCameraDetail = Awaited<ReturnType<CamerasService["findOne"]>>;

private toSafeCamera<T extends { streamPasswordEncrypted?: string | null }>(camera: T) {
  const { streamPasswordEncrypted, ...safe } = camera;
  return safe;
}
```

- [ ] **Step 5: Expand create/update DTOs and persistence**

```ts
export class CreateCameraDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() ip?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() resolution?: string;
  @IsOptional() @IsBoolean() hasAnalytics?: boolean;
  @IsOptional() @IsString() streamUrl?: string;
  @IsOptional() @IsString() streamUsername?: string;
  @IsOptional() @IsString() streamPassword?: string;
  @IsOptional() @IsEnum(CameraTransport) streamTransport?: CameraTransport;
  @IsOptional() @IsBoolean() previewEnabled?: boolean;
  @IsOptional() @IsString() onvifUrl?: string;
  @IsString() @IsNotEmpty() nodeId!: string;
}

create(dto: CreateCameraDto) {
  const { nodeId, streamPassword, ...rest } = dto;
  return this.prisma.camera.create({
    data: {
      ...rest,
      streamPasswordEncrypted: streamPassword ? this.secretService.encrypt(streamPassword) : undefined,
      node: { connect: { id: nodeId } },
    },
  });
}
```

- [ ] **Step 6: Add the API test script and run tests**

```json
{
  "scripts": {
    "test:cameras": "ts-node --project tsconfig.json src/cameras/cameras.service.test.ts"
  }
}
```

Run: `npm run test:cameras --workspace=apps/api`  
Expected: PASS with at least the secret-safe read test green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/src/cameras apps/api/package.json apps/api/prisma/seed.ts apps/api/prisma/seed.js
git commit -m "feat: persist camera stream metadata"
```

### Task 2: Add the preview-session backend and direct live bridge

**Files:**
- Create: `apps/api/src/camera-preview/camera-preview.types.ts`
- Create: `apps/api/src/camera-preview/camera-preview.adapter.ts`
- Create: `apps/api/src/camera-preview/ffmpeg-preview.adapter.ts`
- Create: `apps/api/src/camera-preview/camera-preview.service.ts`
- Create: `apps/api/src/camera-preview/camera-preview.controller.ts`
- Create: `apps/api/src/camera-preview/camera-preview.module.ts`
- Create: `apps/api/src/camera-preview/camera-preview.service.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Consumes:
  - `CamerasService.findOne(id: string)`
  - `CameraSecretService.decrypt(cipherText: string): string`
- Produces:
  - `CameraPreviewService.startPreview(cameraId: string, userId: string): Promise<{ sessionId: string; status: "starting"; viewerUrl: string; expiresAt: string }>`
  - `CameraPreviewService.getPreviewStatus(sessionId: string, userId: string): { status: "starting" | "live" | "failed" | "expired"; errorCode?: string; message?: string }`
  - `CameraPreviewService.stopPreview(sessionId: string, userId: string): void`
  - `CameraPreviewAdapter.start(session: PreviewSession, connection: PreviewConnection): Promise<void>`

- [ ] **Step 1: Write the failing preview lifecycle test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { CameraPreviewService } from "./camera-preview.service";

test("startPreview binds a session to the requesting user and returns a viewer URL", async () => {
  const adapter = { start: async () => {}, stop: async () => {}, getStream: () => null };
  const cameras = {
    findOne: async () => ({
      id: "cam-1",
      previewEnabled: true,
      streamUrl: "rtsp://cam/live",
      streamUsername: "admin",
      streamPasswordEncrypted: "cipher",
      streamTransport: "TCP",
    }),
    getPreviewConnection: async () => ({
      streamUrl: "rtsp://cam/live",
      streamUsername: "admin",
      streamPassword: "secret",
      streamTransport: "TCP",
    }),
  };

  const service = new CameraPreviewService(cameras as never, adapter as never);
  const result = await service.startPreview("cam-1", "user-1");

  assert.equal(result.status, "starting");
  assert.match(result.viewerUrl, /\/cameras\/preview\/.+\/media$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:camera-preview --workspace=apps/api`  
Expected: FAIL with missing preview module/script.

- [ ] **Step 3: Define the preview adapter and session types**

```ts
export type PreviewStatus = "starting" | "live" | "failed" | "expired";

export type PreviewConnection = {
  streamUrl: string;
  streamUsername?: string | null;
  streamPassword?: string | null;
  streamTransport: "TCP" | "UDP";
};

export type PreviewSession = {
  sessionId: string;
  cameraId: string;
  userId: string;
  status: PreviewStatus;
  expiresAt: Date;
  errorCode?: string;
  message?: string;
};
```

```ts
export interface CameraPreviewAdapter {
  start(session: PreviewSession, connection: PreviewConnection): Promise<void>;
  stop(sessionId: string): Promise<void>;
  getStream(sessionId: string): NodeJS.ReadableStream | null;
}
```

- [ ] **Step 4: Implement a minimal ffmpeg-backed adapter**

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export class FfmpegPreviewAdapter implements CameraPreviewAdapter {
  private readonly processes = new Map<string, ChildProcessWithoutNullStreams>();

  async start(session: PreviewSession, connection: PreviewConnection) {
    const args = [
      "-rtsp_transport", connection.streamTransport.toLowerCase(),
      "-i", connection.streamUrl,
      "-f", "mjpeg",
      "-q:v", "5",
      "pipe:1",
    ];

    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    this.processes.set(session.sessionId, child);
  }

  async stop(sessionId: string) {
    this.processes.get(sessionId)?.kill("SIGTERM");
    this.processes.delete(sessionId);
  }

  getStream(sessionId: string) {
    return this.processes.get(sessionId)?.stdout ?? null;
  }
}
```

- [ ] **Step 5: Implement session lifecycle and authenticated media routes**

```ts
@Controller("cameras")
export class CameraPreviewController {
  constructor(private readonly preview: CameraPreviewService) {}

  @Post(":id/preview/start")
  start(@Param("id") id: string, @Req() req: { user: { id: string } }) {
    return this.preview.startPreview(id, req.user.id);
  }

  @Get("preview/:sessionId/status")
  status(@Param("sessionId") sessionId: string, @Req() req: { user: { id: string } }) {
    return this.preview.getPreviewStatus(sessionId, req.user.id);
  }

  @Post("preview/:sessionId/stop")
  stop(@Param("sessionId") sessionId: string, @Req() req: { user: { id: string } }) {
    return this.preview.stopPreview(sessionId, req.user.id);
  }
}
```

- [ ] **Step 6: Add the preview test script and run the backend tests**

```json
{
  "scripts": {
    "test:camera-preview": "ts-node --project tsconfig.json src/camera-preview/camera-preview.service.test.ts"
  }
}
```

Run:

```bash
npm run test:cameras --workspace=apps/api
npm run test:camera-preview --workspace=apps/api
```

Expected: PASS for both scripts.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/camera-preview apps/api/src/app.module.ts apps/api/package.json
git commit -m "feat: add camera live preview backend"
```

### Task 3: Add live preview to the admin camera form

**Files:**
- Create: `apps/web/lib/camera-preview.ts`
- Create: `apps/web/lib/camera-preview.test.ts`
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/app/admin/cameras/page.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Consumes:
  - `POST /cameras/:id/preview/start`
  - `GET /cameras/preview/:sessionId/status`
  - `POST /cameras/preview/:sessionId/stop`
- Produces:
  - `type CameraPreviewSession = { sessionId: string; status: "starting"; viewerUrl: string; expiresAt: string }`
  - `pollPreviewStatus(sessionId: string, token: string): Promise<CameraPreviewStatus>`
  - form fields `streamUrl`, `streamUsername`, `streamPassword`, `streamTransport`, `previewEnabled`, `onvifUrl`

- [ ] **Step 1: Write the failing web helper test**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getPreviewPhaseLabel } from "./camera-preview";

test("maps API preview statuses into operator labels", () => {
  assert.equal(getPreviewPhaseLabel("starting"), "Conectando...");
  assert.equal(getPreviewPhaseLabel("live"), "Stream activo");
  assert.equal(getPreviewPhaseLabel("failed"), "Sin señal");
  assert.equal(getPreviewPhaseLabel("expired"), "Sesión vencida");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:camera-preview --workspace=apps/web`  
Expected: FAIL with missing helper/script.

- [ ] **Step 3: Add preview DTOs and helper functions to the web client**

```ts
export type CameraPreviewStartResponse = {
  sessionId: string;
  status: "starting";
  viewerUrl: string;
  expiresAt: string;
};

export type CameraPreviewStatusResponse = {
  status: "starting" | "live" | "failed" | "expired";
  errorCode?: string;
  message?: string;
};

export async function apiPostNoContent(path: string, token: string, body: unknown): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status} ${path}`);
}
```

- [ ] **Step 4: Implement preview state helpers and modal preview flow**

```ts
export function getPreviewPhaseLabel(status: "starting" | "live" | "failed" | "expired") {
  switch (status) {
    case "starting": return "Conectando...";
    case "live": return "Stream activo";
    case "failed": return "Sin señal";
    case "expired": return "Sesión vencida";
  }
}
```

```tsx
const [previewSession, setPreviewSession] = useState<CameraPreviewStartResponse | null>(null);
const [previewStatus, setPreviewStatus] = useState<CameraPreviewStatusResponse | null>(null);

async function startPreview() {
  if (!accessToken || !editing) return;
  const session = await apiPost<CameraPreviewStartResponse>(`/cameras/${editing.id}/preview/start`, accessToken, {});
  setPreviewSession(session);
  setPreviewStatus({ status: "starting" });
}
```

- [ ] **Step 5: Extend the camera form fields and embed the viewer**

```tsx
<div className="rounded-ops border border-ops-border bg-ops-panel p-4">
  <div className="mb-3 flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-ops-text">Senal en vivo</p>
      <p className="text-xs text-ops-muted">Valida la credencial y el stream antes de cerrar el formulario.</p>
    </div>
    <button type="button" onClick={startPreview} className="rounded-ops border border-ops-border px-3 py-2 text-xs text-ops-text">
      Probar senal
    </button>
  </div>
  <div className="aspect-video overflow-hidden rounded-ops border border-ops-border bg-black">
    {previewSession ? <img src={previewSession.viewerUrl} alt="Preview de camara" className="h-full w-full object-cover" /> : null}
  </div>
  <p className="mt-2 text-xs text-ops-muted">{previewStatus ? getPreviewPhaseLabel(previewStatus.status) : "Sin prueba activa"}</p>
</div>
```

- [ ] **Step 6: Add the web test script and run web verification**

```json
{
  "scripts": {
    "test:camera-preview": "ts-node --project tsconfig.test.json lib/camera-preview.test.ts"
  }
}
```

Run:

```bash
npm run test:camera-preview --workspace=apps/web
npm run build --workspace=apps/web
```

Expected: PASS for the helper test and successful Next build.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/admin/cameras/page.tsx apps/web/lib/api.ts apps/web/lib/camera-preview.ts apps/web/lib/camera-preview.test.ts apps/web/package.json
git commit -m "feat: add live preview to camera form"
```

### Task 4: Verify end-to-end behavior and lock the contract

**Files:**
- Modify: `docs/superpowers/specs/2026-07-14-camera-live-preview-design.md`
- Modify: `docs/superpowers/plans/2026-07-14-camera-live-preview-implementation.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes:
  - completed camera CRUD and preview endpoints
  - web preview flow from Task 3
- Produces:
  - documented environment variable `CAMERA_SECRET_KEY`
  - verified API and UI contract for later GIS reuse

- [x] **Step 1: Add environment documentation for preview secrets**

```env
CAMERA_SECRET_KEY=change_me_for_camera_stream_credentials
```

- [x] **Step 2: Run database and backend verification**

Run:

```bash
npm run db:push --workspace=apps/api
npm run test:cameras --workspace=apps/api
npm run test:camera-preview --workspace=apps/api
```

Expected: Prisma schema sync completes and both backend test suites pass.

- [x] **Step 3: Run web verification**

Run:

```bash
npm run test:camera-preview --workspace=apps/web
npm run build --workspace=apps/web
```

Expected: helper test passes and web build succeeds.

- [ ] **Step 4: Manual operator verification**

Run:

```bash
npm run dev --workspace=apps/api
npm run dev --workspace=apps/web
```

Expected manual checks:

- create a camera without preview and save successfully
- edit the camera, provide `streamUrl`, user, password, and transport
- click `Probar senal` and confirm the modal shows a live feed or a readable failure state
- close the modal and confirm the session is stopped
- reopen the same camera and confirm preview can be started again

The implemented browser flow consumes the protected MJPEG `viewerUrl` with an authenticated `fetch`, extracts JPEG frames from the response body, and renders them from object URLs. It does not use a bare `<img src>` request because that request cannot carry the JWT `Authorization` header. Preview start, status, stop, and media routes are JWT-authenticated and return `Cache-Control: no-store, private`.

- [x] **Step 5: Commit**

```bash
git add .env.example docs/superpowers/specs/2026-07-14-camera-live-preview-design.md docs/superpowers/plans/2026-07-14-camera-live-preview-implementation.md
git commit -m "docs: finalize camera live preview rollout"
```
