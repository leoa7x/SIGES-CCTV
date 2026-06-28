# City Demographics & GIS Enhancement

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the City entity with demographic data, GIS coordinates (auto-geocoded via Nominatim), logo upload (stored in MinIO), entity type (MUNICIPALITY/DEPARTMENT), and computed CCTV counts (cameras, nodes, poles) so that each city/department has a complete CCTV profile.

**Architecture:** Schema migration adds new fields to City and a `hasPole` boolean to Node. A new StorageService wraps MinIO (S3-compatible, self-hosted in Docker) for logo uploads. CitiesService calls Nominatim (OpenStreetMap geocoder, no API key) to auto-populate `lat/lng` on create when the user doesn't supply them. Computed counts (cameras/nodes/poles) are calculated server-side via Prisma deep-count queries. The frontend form is rewritten with conditional fields (department name only for MUNICIPALITY type), logo upload with preview, and editable lat/lng fields.

**Tech Stack:** Prisma 6 migration, NestJS 11 (ConfigService global, @nestjs/platform-express/Multer already installed), `@aws-sdk/client-s3` (new install), MinIO (new Docker service), Nominatim REST API (free, no key), Next.js 15 frontend.

## Global Constraints

- git author: `leoa7x <leo.sanchez@thecicorp.com>`
- No tests (no test suite in project) — verification gate per task: `cd apps/api && npx tsc --noEmit` for API, `cd apps/web && npx tsc --noEmit` for web
- Prisma migration must apply cleanly: `cd apps/api && npx prisma migrate dev --name city-demographics-node-pole`
- `GeoEntityType` enum values (exact strings): `MUNICIPALITY`, `DEPARTMENT`
- Counts object shape (returned by API): `{ cameras: number, nodes: number, poles: number }`
- MinIO bucket name: `siges-cctv`
- Nominatim User-Agent header: `SIGES-CCTV/1.0 (leo.sanchez@thecicorp.com)`
- Nominatim URL: `https://nominatim.openstreetmap.org/search?q=<encoded>&format=json&limit=1&countrycodes=co`
- Logo upload endpoint: `POST /cities/:id/logo` with form-data field name `logo`
- Logo key in MinIO: `cities/<cityId>/logo.<ext>`
- No `apiDelete` in web — API has no DELETE endpoints
- Input CSS class (verbatim, all web forms): `"w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none"`

---

## File Map

```
apps/api/
  prisma/schema.prisma                         MODIFY — add GeoEntityType enum, update City, add hasPole to Node
  prisma/migrations/<timestamp>_city-demographics-node-pole/   CREATED by migrate dev
  src/storage/storage.service.ts               CREATE — MinIO S3 upload wrapper
  src/storage/storage.module.ts                CREATE — exports StorageService
  src/cities/cities.service.ts                 MODIFY — new DTOs, Nominatim, counts, logo upload
  src/cities/cities.controller.ts              MODIFY — add POST :id/logo endpoint
  src/cities/cities.module.ts                  MODIFY — import StorageModule
  src/nodes/nodes.service.ts                   MODIFY — add hasPole to DTOs
docker-compose.yml                             MODIFY — add MinIO service + volume
.env                                           MODIFY — add MINIO_* vars

apps/web/
  app/admin/cities/page.tsx                    MODIFY — full rewrite with enhanced form
  app/admin/nodes/page.tsx                     MODIFY — add hasPole checkbox
```

---

## Task 1: Prisma schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Interfaces:**
- Produces: `GeoEntityType` enum available in `@prisma/client`; City model with new fields; Node model with `hasPole: Boolean`

---

- [ ] **Step 1: Read the current schema**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/api/prisma/schema.prisma
```

- [ ] **Step 2: Add `GeoEntityType` enum after existing enums**

Add this enum anywhere after line ~265 (near the other enums):

```prisma
enum GeoEntityType {
  MUNICIPALITY
  DEPARTMENT
}
```

- [ ] **Step 3: Replace the City model**

Replace the existing `model City { ... }` block with:

```prisma
model City {
  id             String        @id @default(uuid())
  name           String
  type           GeoEntityType @default(MUNICIPALITY)
  department     String?
  daneCode       String?
  population     Int?
  areaSqKm       Float?
  contractObject String?
  logoUrl        String?
  lat            Float?
  lng            Float?
  state          EntityState   @default(ACTIVE)
  projects       Project[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}
```

Note: `department` changes from `String` (required) to `String?` (optional) — this is intentional. DEPARTMENT type entities have no parent department.

- [ ] **Step 4: Add `hasPole` to Node model**

Inside `model Node { ... }`, after `operativeState NodeState @default(ONLINE)`, add:

```prisma
  hasPole        Boolean        @default(false)
```

- [ ] **Step 5: Run migration**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx prisma migrate dev --name city-demographics-node-pole
```

Expected: migration created and applied, no errors. Prisma client regenerated automatically.

- [ ] **Step 6: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: 0 errors. (The `department` field changing to optional may surface issues in DTOs — if so, fix them in the DTO files.)

- [ ] **Step 7: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/api/prisma/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(api): add city demographics + GeoEntityType + node hasPole migration"
```

---

## Task 2: MinIO setup + StorageService

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env` (root)
- Create: `apps/api/src/storage/storage.service.ts`
- Create: `apps/api/src/storage/storage.module.ts`

**Interfaces:**
- Produces: `StorageService.upload(key: string, buffer: Buffer, mimeType: string): Promise<string>` — returns the public URL of the uploaded object
- Produces: `StorageModule` exporting `StorageService`

---

- [ ] **Step 1: Install AWS S3 SDK in API**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npm install @aws-sdk/client-s3
```

Expected: package added to `node_modules` and `package.json`.

- [ ] **Step 2: Add MinIO service to `docker-compose.yml`**

Read the current `docker-compose.yml` first. Then add the MinIO service inside `services:` (before the final `volumes:` key) and add `minio_data:` to the `volumes:` section.

MinIO service block to add:

```yaml
  # ── MinIO (S3-compatible object storage) ─────────────────────────────────────
  minio:
    image: minio/minio:latest
    container_name: siges-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER:-siges_minio}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD:-siges_minio_change_me}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 15s
      timeout: 5s
      retries: 5
```

Add to the `volumes:` section:

```yaml
  minio_data:
```

- [ ] **Step 3: Add MinIO env vars to `.env`**

Read the current `.env` file first, then append:

```
# MinIO object storage
MINIO_ENDPOINT=http://localhost:9000
MINIO_USER=siges_minio
MINIO_PASSWORD=siges_minio_change_me
MINIO_BUCKET=siges-cctv
MINIO_PUBLIC_URL=http://localhost:9000
```

- [ ] **Step 4: Start MinIO container**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV && docker compose up -d minio
```

Expected: `siges-minio` container starts. Verify:

```bash
docker ps --filter "name=siges-minio" --format "{{.Names}}\t{{.Status}}"
```

Expected: `siges-minio    Up X seconds`

- [ ] **Step 5: Create `apps/api/src/storage/storage.service.ts`**

```typescript
import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  S3Client,
  PutObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: S3Client;
  private bucket: string;
  private publicUrl: string;

  constructor(private config: ConfigService) {
    this.bucket = config.get<string>("MINIO_BUCKET", "siges-cctv");
    this.publicUrl = config.get<string>("MINIO_PUBLIC_URL", "http://localhost:9000");
    this.client = new S3Client({
      endpoint: config.get<string>("MINIO_ENDPOINT", "http://localhost:9000"),
      region: "us-east-1",
      credentials: {
        accessKeyId: config.get<string>("MINIO_USER", "siges_minio"),
        secretAccessKey: config.get<string>("MINIO_PASSWORD", "siges_minio_change_me"),
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" already exists`);
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      await this.client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucket,
          Policy: JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Effect: "Allow",
                Principal: "*",
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${this.bucket}/*`],
              },
            ],
          }),
        }),
      );
      this.logger.log(`Bucket "${this.bucket}" created with public-read policy`);
    }
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );
    return `${this.publicUrl}/${this.bucket}/${key}`;
  }
}
```

- [ ] **Step 6: Create `apps/api/src/storage/storage.module.ts`**

```typescript
import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add docker-compose.yml .env apps/api/src/storage/ apps/api/package.json apps/api/package-lock.json
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(api): add MinIO storage service and docker-compose service"
```

---

## Task 3: Cities API — DTOs, Nominatim, counts, logo upload

**Files:**
- Modify: `apps/api/src/cities/cities.service.ts`
- Modify: `apps/api/src/cities/cities.controller.ts`
- Modify: `apps/api/src/cities/cities.module.ts`

**Interfaces:**
- Consumes: `StorageModule` / `StorageService.upload(key, buffer, mimeType): Promise<string>` from Task 2
- Produces:
  - `GET /cities` → `CityWithCounts[]` where each city includes `counts: { cameras, nodes, poles }`
  - `POST /cities` → creates city, auto-geocodes if `lat`/`lng` not provided
  - `PATCH /cities/:id` → updates city fields
  - `POST /cities/:id/logo` (multipart, field `logo`) → uploads logo, returns `{ logoUrl: string }`

---

- [ ] **Step 1: Read current cities files**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/api/src/cities/cities.service.ts
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/api/src/cities/cities.controller.ts
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/api/src/cities/cities.module.ts
```

- [ ] **Step 2: Rewrite `apps/api/src/cities/cities.service.ts`**

```typescript
import { Injectable } from "@nestjs/common";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";
import { GeoEntityType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

export class CreateCityDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsEnum(GeoEntityType) type!: GeoEntityType;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() daneCode?: string;
  @IsOptional() @IsInt() population?: number;
  @IsOptional() @IsNumber() areaSqKm?: number;
  @IsOptional() @IsString() contractObject?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

export class UpdateCityDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(GeoEntityType) type?: GeoEntityType;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() daneCode?: string;
  @IsOptional() @IsInt() population?: number;
  @IsOptional() @IsNumber() areaSqKm?: number;
  @IsOptional() @IsString() contractObject?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
}

@Injectable()
export class CitiesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  private async getCounts(cityId: string) {
    const [cameras, nodes, poles] = await Promise.all([
      this.prisma.camera.count({
        where: { node: { route: { center: { project: { cityId } } } } },
      }),
      this.prisma.node.count({
        where: { route: { center: { project: { cityId } } } },
      }),
      this.prisma.node.count({
        where: { hasPole: true, route: { center: { project: { cityId } } } },
      }),
    ]);
    return { cameras, nodes, poles };
  }

  private async geocode(
    name: string,
    department: string | undefined | null,
    type: GeoEntityType,
  ): Promise<{ lat: number; lng: number } | null> {
    const q =
      type === GeoEntityType.DEPARTMENT
        ? `${name}, Colombia`
        : `${name}, ${department ?? ""}, Colombia`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=co`;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "SIGES-CCTV/1.0 (leo.sanchez@thecicorp.com)" },
      });
      const data = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    } catch {}
    return null;
  }

  async findAll() {
    const cities = await this.prisma.city.findMany({ orderBy: { name: "asc" } });
    return Promise.all(
      cities.map(async (c) => ({ ...c, counts: await this.getCounts(c.id) })),
    );
  }

  async findOne(id: string) {
    const city = await this.prisma.city.findUniqueOrThrow({ where: { id } });
    return { ...city, counts: await this.getCounts(id) };
  }

  async create(dto: CreateCityDto) {
    let { lat, lng } = dto;
    if (lat == null || lng == null) {
      const coords = await this.geocode(dto.name, dto.department, dto.type);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }
    return this.prisma.city.create({ data: { ...dto, lat, lng } });
  }

  async update(id: string, dto: UpdateCityDto) {
    return this.prisma.city.update({ where: { id }, data: dto as any });
  }

  async uploadLogo(id: string, file: Express.Multer.File): Promise<{ logoUrl: string }> {
    const ext = (file.mimetype.split("/")[1] ?? "jpg").replace("jpeg", "jpg");
    const key = `cities/${id}/logo.${ext}`;
    const logoUrl = await this.storage.upload(key, file.buffer, file.mimetype);
    await this.prisma.city.update({ where: { id }, data: { logoUrl } });
    return { logoUrl };
  }
}
```

- [ ] **Step 3: Rewrite `apps/api/src/cities/cities.controller.ts`**

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthGuard } from "@nestjs/passport";
import { CitiesService, CreateCityDto, UpdateCityDto } from "./cities.service";

@UseGuards(AuthGuard("jwt"))
@Controller("cities")
export class CitiesController {
  constructor(private service: CitiesService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(":id") findOne(@Param("id") id: string) { return this.service.findOne(id); }
  @Post() create(@Body() dto: CreateCityDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateCityDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/logo")
  @UseInterceptors(FileInterceptor("logo"))
  uploadLogo(
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadLogo(id, file);
  }
}
```

- [ ] **Step 4: Update `apps/api/src/cities/cities.module.ts`**

Read the current file, then add `StorageModule` to imports:

```typescript
import { Module } from "@nestjs/common";
import { CitiesController } from "./cities.controller";
import { CitiesService } from "./cities.service";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [CitiesController],
  providers: [CitiesService],
})
export class CitiesModule {}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: 0 errors. If there are `Express.Multer.File` type errors, install `@types/multer`:

```bash
npm install -D @types/multer
```

Then re-run tsc.

- [ ] **Step 6: Restart API dev server to test**

```bash
pkill -f "nest start" 2>/dev/null; sleep 1
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npm run dev &
sleep 5 && curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer test" http://localhost:4001/cities
```

Expected: `401` (JWT guard active) — confirms server started and route is registered.

- [ ] **Step 7: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/api/src/cities/
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(api): enhance cities with demographics, geocoding, counts, logo upload"
```

---

## Task 4: Nodes API — add `hasPole` to DTOs

**Files:**
- Modify: `apps/api/src/nodes/nodes.service.ts`

**Interfaces:**
- Consumes: `hasPole: Boolean @default(false)` on Node model (from Task 1)
- Produces: `CreateNodeDto.hasPole?: boolean`, `UpdateNodeDto.hasPole?: boolean`

---

- [ ] **Step 1: Read current nodes service**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/api/src/nodes/nodes.service.ts
```

- [ ] **Step 2: Add `hasPole` to both DTOs**

In `CreateNodeDto`, after `@IsString() @IsNotEmpty() routeId!: string;`, add:

```typescript
  @IsOptional() @IsBoolean() hasPole?: boolean;
```

And add `IsBoolean` to the import from `class-validator`:
```typescript
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
```

In `UpdateNodeDto`, after `@IsOptional() @IsEnum(NodeState) operativeState?: NodeState;`, add:

```typescript
  @IsOptional() @IsBoolean() hasPole?: boolean;
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/api/src/nodes/nodes.service.ts
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(api): add hasPole to node DTOs"
```

---

## Task 5: Frontend `/admin/cities` — enhanced form

**Files:**
- Modify: `apps/web/app/admin/cities/page.tsx` (full rewrite)

**Interfaces:**
- Consumes:
  - `GET /cities` → `CityItem[]` with `counts: { cameras, nodes, poles }`
  - `POST /cities` body: `{ name, type, department?, daneCode?, population?, areaSqKm?, contractObject?, lat?, lng? }`
  - `PATCH /cities/:id` body: same fields plus `state?`
  - `POST /cities/:id/logo` multipart `logo` field → `{ logoUrl: string }`
  - `apiGet`, `apiPost`, `apiPatch` from `../../../lib/api`

---

- [ ] **Step 1: Add `apiPostFile` helper to `apps/web/lib/api.ts`**

Read `apps/web/lib/api.ts`, then add this function:

```typescript
export async function apiPostFile<T>(path: string, token: string, formData: FormData): Promise<T> {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Rewrite `apps/web/app/admin/cities/page.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OpsShell } from "../../../components/ops-shell";
import { OpsModal } from "../../../components/ops-modal";
import { useAuth } from "../../../components/auth-provider";
import { apiGet, apiPatch, apiPost, apiPostFile } from "../../../lib/api";

type Counts = { cameras: number; nodes: number; poles: number };
type CityItem = {
  id: string; name: string; type: "MUNICIPALITY" | "DEPARTMENT";
  department: string | null; daneCode: string | null;
  population: number | null; areaSqKm: number | null;
  contractObject: string | null; logoUrl: string | null;
  lat: number | null; lng: number | null; state: string;
  counts: Counts;
};
type CreateForm = {
  name: string; type: "MUNICIPALITY" | "DEPARTMENT"; department: string;
  daneCode: string; population: string; areaSqKm: string;
  contractObject: string; lat: string; lng: string;
};
type EditForm = {
  name: string; type: "MUNICIPALITY" | "DEPARTMENT"; department: string;
  daneCode: string; population: string; areaSqKm: string;
  contractObject: string; lat: string; lng: string; state: string;
};
const EMPTY_CREATE: CreateForm = {
  name: "", type: "MUNICIPALITY", department: "", daneCode: "",
  population: "", areaSqKm: "", contractObject: "", lat: "", lng: "",
};
const INPUT = "w-full rounded-ops border border-ops-border bg-ops-surface px-3 py-2 text-sm text-ops-text focus:border-ops-blue focus:outline-none";

export default function CitiesPage() {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<CityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CityItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(EMPTY_CREATE);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "", type: "MUNICIPALITY", department: "", daneCode: "",
    population: "", areaSqKm: "", contractObject: "", lat: "", lng: "", state: "ACTIVE",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try { setItems(await apiGet<CityItem[]>("/cities", accessToken)); }
    catch { } finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setCreateForm(EMPTY_CREATE);
    setLogoFile(null); setLogoPreview(null);
    setModalOpen(true);
  }

  function openEdit(item: CityItem) {
    setEditing(item);
    setEditForm({
      name: item.name, type: item.type,
      department: item.department ?? "", daneCode: item.daneCode ?? "",
      population: item.population != null ? String(item.population) : "",
      areaSqKm: item.areaSqKm != null ? String(item.areaSqKm) : "",
      contractObject: item.contractObject ?? "",
      lat: item.lat != null ? String(item.lat) : "",
      lng: item.lng != null ? String(item.lng) : "",
      state: item.state,
    });
    setLogoFile(null); setLogoPreview(item.logoUrl);
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setLogoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else { setLogoPreview(null); }
  }

  function parseOptionalNumber(s: string): number | undefined {
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  }
  function parseOptionalInt(s: string): number | undefined {
    const n = parseInt(s, 10);
    return isNaN(n) ? undefined : n;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    try {
      let cityId: string;
      if (editing) {
        const payload = {
          name: editForm.name, type: editForm.type,
          department: editForm.department || undefined,
          daneCode: editForm.daneCode || undefined,
          population: parseOptionalInt(editForm.population),
          areaSqKm: parseOptionalNumber(editForm.areaSqKm),
          contractObject: editForm.contractObject || undefined,
          lat: parseOptionalNumber(editForm.lat),
          lng: parseOptionalNumber(editForm.lng),
          state: editForm.state,
        };
        await apiPatch(`/cities/${editing.id}`, accessToken, payload);
        cityId = editing.id;
      } else {
        const payload = {
          name: createForm.name, type: createForm.type,
          department: createForm.department || undefined,
          daneCode: createForm.daneCode || undefined,
          population: parseOptionalInt(createForm.population),
          areaSqKm: parseOptionalNumber(createForm.areaSqKm),
          contractObject: createForm.contractObject || undefined,
          lat: parseOptionalNumber(createForm.lat),
          lng: parseOptionalNumber(createForm.lng),
        };
        const created = await apiPost<{ id: string }>("/cities", accessToken, payload);
        cityId = created.id;
      }
      if (logoFile) {
        const fd = new FormData();
        fd.append("logo", logoFile);
        await apiPostFile(`/cities/${cityId}/logo`, accessToken, fd);
      }
      closeModal();
      await load();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  const form = editing ? editForm : createForm;
  const setForm = editing
    ? (fn: (f: EditForm) => EditForm) => setEditForm(fn)
    : (fn: (f: CreateForm) => CreateForm) => setCreateForm(fn as any);

  return (
    <OpsShell eyebrow="Administración" title="Ciudades y Departamentos">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ops-muted">{items.length} entidades geográficas</p>
        <button onClick={openCreate} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80">
          + Nueva ciudad
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-ops-border border-t-ops-blue" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-ops border border-ops-border bg-ops-panel">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ops-border text-left text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
                <th className="px-4 py-3">Logo</th>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3 hidden sm:table-cell">DANE</th>
                <th className="px-4 py-3 hidden md:table-cell">Cámaras</th>
                <th className="px-4 py-3 hidden md:table-cell">Nodos</th>
                <th className="px-4 py-3 hidden md:table-cell">Postes</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ops-border">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-ops-surface">
                  <td className="px-4 py-3">
                    {item.logoUrl ? (
                      <img src={item.logoUrl} alt="logo" className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <div className="h-8 w-8 rounded border border-ops-border bg-ops-surface text-[9px] text-ops-dim flex items-center justify-center">N/A</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-ops-text">{item.name}</p>
                    {item.department && <p className="text-[10px] text-ops-muted">{item.department}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[9px] font-bold ${item.type === "DEPARTMENT" ? "border-ops-amber/30 bg-ops-amber/10 text-ops-amber" : "border-ops-blue/30 bg-ops-blue/10 text-ops-blue"}`}>
                      {item.type === "DEPARTMENT" ? "DPTO" : "MUN"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell font-mono text-xs text-ops-muted">{item.daneCode ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell tabular-nums text-ops-muted">{item.counts.cameras}</td>
                  <td className="px-4 py-3 hidden md:table-cell tabular-nums text-ops-muted">{item.counts.nodes}</td>
                  <td className="px-4 py-3 hidden md:table-cell tabular-nums text-ops-muted">{item.counts.poles}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${item.state === "ACTIVE" ? "border-ops-emerald/30 bg-ops-emerald/10 text-ops-emerald" : "border-ops-border bg-ops-surface text-ops-muted"}`}>
                      {item.state}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(item)} className="text-[11px] text-ops-blue hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpsModal open={modalOpen} title={editing ? "Editar entidad" : "Nueva entidad geográfica"} onClose={closeModal} saving={saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Tipo</label>
            <div className="flex gap-2">
              {(["MUNICIPALITY", "DEPARTMENT"] as const).map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => editing
                    ? setEditForm((f) => ({ ...f, type: t, department: t === "DEPARTMENT" ? "" : f.department }))
                    : setCreateForm((f) => ({ ...f, type: t, department: t === "DEPARTMENT" ? "" : f.department }))
                  }
                  className={`flex-1 rounded-ops border py-2 text-[11px] font-semibold transition ${
                    form.type === t
                      ? "border-ops-blue bg-ops-blue/10 text-ops-blue"
                      : "border-ops-border text-ops-muted hover:border-ops-blue/40"
                  }`}
                >
                  {t === "MUNICIPALITY" ? "Municipio" : "Departamento"}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
              {form.type === "DEPARTMENT" ? "Nombre del departamento" : "Nombre del municipio"}
            </label>
            <input className={INPUT} value={form.name} required
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, name: e.target.value })) : setCreateForm((f) => ({ ...f, name: e.target.value }))}
              placeholder={form.type === "DEPARTMENT" ? "Meta" : "Puerto Gaitán"} />
          </div>

          {/* Department (only for MUNICIPALITY) */}
          {form.type === "MUNICIPALITY" && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Departamento</label>
              <input className={INPUT} value={form.department}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, department: e.target.value })) : setCreateForm((f) => ({ ...f, department: e.target.value }))}
                placeholder="Meta" />
            </div>
          )}

          {/* DANE + Population + Area */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Código DANE</label>
              <input className={INPUT} value={form.daneCode}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, daneCode: e.target.value })) : setCreateForm((f) => ({ ...f, daneCode: e.target.value }))}
                placeholder={form.type === "DEPARTMENT" ? "50" : "50686"} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Población</label>
              <input type="number" className={INPUT} value={form.population}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, population: e.target.value })) : setCreateForm((f) => ({ ...f, population: e.target.value }))}
                placeholder="18000" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Área km²</label>
              <input type="number" step="0.01" className={INPUT} value={form.areaSqKm}
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, areaSqKm: e.target.value })) : setCreateForm((f) => ({ ...f, areaSqKm: e.target.value }))}
                placeholder="17499" />
            </div>
          </div>

          {/* Contract object */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Objeto del contrato</label>
            <textarea className={INPUT} rows={2} value={form.contractObject}
              onChange={(e) => editing ? setEditForm((f) => ({ ...f, contractObject: e.target.value })) : setCreateForm((f) => ({ ...f, contractObject: e.target.value }))}
              placeholder="Instalación y mantenimiento de sistema de videovigilancia…" />
          </div>

          {/* GIS coordinates */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">
              Coordenadas GIS <span className="font-normal text-ops-dim">(auto-geocodificadas al guardar si se dejan vacías)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input className={INPUT} value={form.lat} placeholder="Latitud (ej. 4.0756)"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, lat: e.target.value })) : setCreateForm((f) => ({ ...f, lat: e.target.value }))} />
              <input className={INPUT} value={form.lng} placeholder="Longitud (ej. -72.0836)"
                onChange={(e) => editing ? setEditForm((f) => ({ ...f, lng: e.target.value })) : setCreateForm((f) => ({ ...f, lng: e.target.value }))} />
            </div>
          </div>

          {/* Logo upload */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Logo (alcaldía / gobernación)</label>
            <div className="flex items-center gap-3">
              {logoPreview && (
                <img src={logoPreview} alt="preview" className="h-12 w-12 rounded border border-ops-border object-contain" />
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="rounded-ops border border-ops-border px-3 py-1.5 text-[11px] text-ops-muted hover:border-ops-blue hover:text-ops-blue">
                {logoPreview ? "Cambiar imagen" : "Seleccionar imagen"}
              </button>
              {logoFile && <span className="text-[10px] text-ops-dim truncate max-w-32">{logoFile.name}</span>}
            </div>
          </div>

          {/* State (edit only) */}
          {editing && (
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-ops-muted">Estado</label>
              <select className={INPUT} value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="rounded-ops border border-ops-border px-4 py-2 text-sm text-ops-muted hover:text-ops-text">Cancelar</button>
            <button type="submit" disabled={saving} className="rounded-ops bg-ops-blue px-4 py-2 text-sm font-semibold text-white hover:bg-ops-blue/80 disabled:opacity-50">
              {saving ? "Guardando…" : editing ? "Guardar" : "Crear"}
            </button>
          </div>
        </form>
      </OpsModal>
    </OpsShell>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors. Common issue: `apiPostFile` not exported from `lib/api` — confirm Step 1 was applied.

- [ ] **Step 4: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/cities/page.tsx apps/web/lib/api.ts
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): rewrite cities admin with demographics, logo upload, GIS coords"
```

---

## Task 6: Frontend `/admin/nodes` — add `hasPole` checkbox

**Files:**
- Modify: `apps/web/app/admin/nodes/page.tsx`

**Interfaces:**
- Consumes: `hasPole: boolean` in NodeItem, `hasPole?: boolean` in CreateForm and EditForm

---

- [ ] **Step 1: Read current nodes page**

```bash
cat /mnt/c/Users/ingel/SIGES-CCTV/apps/web/app/admin/nodes/page.tsx
```

- [ ] **Step 2: Add `hasPole` to the NodeItem type**

In the `NodeItem` type definition, add:
```typescript
  hasPole: boolean;
```

- [ ] **Step 3: Add `hasPole` to CreateForm and EditForm types**

In `CreateForm`: add `hasPole: boolean;`
In `EditForm`: add `hasPole: boolean;`

- [ ] **Step 4: Update initial state constants**

In `useState<CreateForm>` initial value: add `hasPole: false`
In `useState<EditForm>` initial value (initial empty): add `hasPole: false`

- [ ] **Step 5: Update `openEdit` to populate `hasPole`**

In `openEdit(item)`, in the `setEditForm(...)` call, add:
```typescript
hasPole: item.hasPole,
```

- [ ] **Step 6: Update `handleSubmit` to send `hasPole` in API calls**

In the create branch (apiPost payload), add:
```typescript
hasPole: createForm.hasPole,
```

In the edit branch (apiPatch payload), add:
```typescript
hasPole: editForm.hasPole,
```

- [ ] **Step 7: Add the checkbox to the form in OpsModal**

In the form JSX, after the SNMP community field and before the route/operativeState selector, add:

```tsx
<label className="flex items-center gap-2 text-sm text-ops-muted">
  <input
    type="checkbox"
    checked={editing ? editForm.hasPole : createForm.hasPole}
    onChange={(e) =>
      editing
        ? setEditForm((f) => ({ ...f, hasPole: e.target.checked }))
        : setCreateForm((f) => ({ ...f, hasPole: e.target.checked }))
    }
    className="rounded"
  />
  Montado en poste
</label>
```

- [ ] **Step 8: Add hasPole indicator to table row**

In the table, in the hidden-sm column for Tipo, after `{item.nodeType}`, add a badge if hasPole:

```tsx
{item.hasPole && (
  <span className="ml-1 rounded border border-ops-amber/30 bg-ops-amber/10 px-1 py-0.5 text-[9px] text-ops-amber">POSTE</span>
)}
```

- [ ] **Step 9: Verify TypeScript**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1
```

Expected: 0 errors.

- [ ] **Step 10: Commit**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV add apps/web/app/admin/nodes/page.tsx
git -C /mnt/c/Users/ingel/SIGES-CCTV commit -m "feat(web): add hasPole checkbox to nodes admin page"
```

---

## Task 7: Push

**Files:** No new files.

---

- [ ] **Step 1: Final TypeScript check (both apps)**

```bash
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/api && npx tsc --noEmit 2>&1 && echo "API OK"
cd /mnt/c/Users/ingel/SIGES-CCTV/apps/web && npx tsc --noEmit 2>&1 && echo "WEB OK"
```

Expected: `API OK` and `WEB OK` with no errors.

- [ ] **Step 2: Push**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV push origin HEAD
```

- [ ] **Step 3: Verify push**

```bash
git -C /mnt/c/Users/ingel/SIGES-CCTV log --oneline origin/main -8
```

Expected: top 7 commits are the Plan 7 feature commits.
