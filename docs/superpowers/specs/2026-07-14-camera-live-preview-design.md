# Camera Live Preview Design

## Goal

Add live camera preview to the camera create/edit form in SIGES-CCTV without introducing a full NVR. The first version must support operational validation during camera registration and establish the same stream access path that will later be reused from the GIS node popup.

## Scope

In scope for this design:

- extend the camera data model with stream connection fields
- add backend endpoints to validate and open a temporary live preview session
- add a live preview module to the camera form in `/admin/cameras`
- keep node coordinates as the source of truth for later GIS-driven stream access

Out of scope for this phase:

- full recording, retention, motion detection, or event timeline
- multi-camera walls, PTZ controls, or camera playback
- direct GIS UI implementation
- replacing the current auth model

## Context

The current SIGES-CCTV camera module stores operational metadata such as code, name, IP, brand, model, and analytics flags, but it does not store stream connection details or expose any preview endpoint. The current camera CRUD lives in:

- [apps/api/src/cameras/cameras.service.ts](/home/ingleonardosanchez/SIGES-CCTV/apps/api/src/cameras/cameras.service.ts:1)
- [apps/api/src/cameras/cameras.controller.ts](/home/ingleonardosanchez/SIGES-CCTV/apps/api/src/cameras/cameras.controller.ts:1)
- [apps/web/app/admin/cameras/page.tsx](/home/ingleonardosanchez/SIGES-CCTV/apps/web/app/admin/cameras/page.tsx:1)

The future GIS flow depends on nodes having coordinates and cameras being associated with those nodes. This means the camera preview path should be designed as a reusable service keyed by camera id, not as a form-only hack.

## Options Considered

### Option 1: Direct MJPEG preview from a SIGES-owned bridge

The API starts a short-lived preview process for a camera and exposes the preview as an authenticated MJPEG or chunked HTTP stream that the browser can render in an `img` or lightweight viewer.

Pros:

- fastest path to working live preview
- low frontend complexity
- operationally sufficient for create/edit workflows
- easy to reuse later from GIS popups

Cons:

- higher bandwidth than more modern transports
- less scalable for many simultaneous viewers
- not ideal for long-running monitoring sessions

### Option 2: HLS preview

The backend converts RTSP into HLS segments and the browser plays them with an HLS player.

Pros:

- standard browser-compatible approach
- better for longer viewing sessions

Cons:

- higher latency
- more moving pieces for segmenting and cleanup
- weaker fit for a “probe this camera now” workflow

### Option 3: WebRTC or WebSocket bridge from day one

The backend provides a low-latency bridge inspired by systems like VibeNVR and exposes live video in a browser-optimized transport immediately.

Pros:

- best long-term fit for GIS popups and monitoring
- lower latency
- strongest base for future PTZ and richer monitoring

Cons:

- highest implementation cost
- more protocol and browser complexity
- riskier first delivery for a CRUD-focused phase

## Decision

Implement Option 1 first: a SIGES-owned direct live preview path backed by a short-lived preview bridge. The stored camera data and backend service contracts must be designed so the transport can later be upgraded to WebRTC or a WebSocket-based video bridge without changing the CRUD model or GIS integration points.

This keeps the first release focused on operational value while preserving a clean upgrade path.

## Architecture

### Data model changes

The `Camera` model should be extended with stream connection metadata:

- `streamUrl`: explicit RTSP URL when available
- `streamUsername`: optional username
- `streamPasswordEncrypted`: encrypted secret, never returned in normal API payloads
- `streamTransport`: enum `TCP | UDP`
- `previewEnabled`: boolean flag
- `onvifUrl`: optional future-facing discovery/control field
- `lastPreviewCheckAt`: last successful preview validation timestamp
- `lastPreviewStatus`: optional short status enum or message

The API response for general camera listing must omit secrets. Create/update DTOs should accept writable secret fields, but read DTOs should return only safe metadata.

### Preview service

Add a dedicated camera preview service in the API layer responsible for:

- building the effective stream connection from camera metadata
- validating required fields before attempting preview
- spawning or delegating a short-lived preview worker
- exposing an authenticated preview URL bound to a camera and session
- expiring preview sessions automatically

This service should be isolated from generic camera CRUD so that transport changes later do not spread through unrelated modules.

### Transport boundary

The first implementation should treat the preview engine as an adapter behind a stable interface:

- `startPreview(cameraId, requestedByUserId)`
- `getPreviewStatus(sessionId)`
- `stopPreview(sessionId)`

The initial adapter can emit MJPEG or another simple browser-consumable live stream. A future adapter can switch to WebRTC or WebSocket delivery while keeping these same API semantics.

## API Design

### Camera CRUD additions

Extend create and update camera payloads with:

- `streamUrl`
- `streamUsername`
- `streamPassword`
- `streamTransport`
- `previewEnabled`
- `onvifUrl`

### New preview endpoints

Protected by the existing JWT auth:

- `POST /cameras/:id/preview/start`
  - validates camera stream configuration
  - starts a temporary preview session
  - returns `sessionId`, `status`, `viewerUrl`, `expiresAt`

- `GET /cameras/preview/:sessionId/status`
  - returns `starting | live | failed | expired`
  - includes sanitized error info when relevant

- `POST /cameras/preview/:sessionId/stop`
  - closes the preview session early

The returned `viewerUrl` should point to a server-controlled authenticated media route. The frontend should never build the raw camera stream URL itself.

## Frontend Design

### Camera form changes

The create/edit modal in [apps/web/app/admin/cameras/page.tsx](/home/ingleonardosanchez/SIGES-CCTV/apps/web/app/admin/cameras/page.tsx:1) should gain a “Señal en vivo” section with:

- stream URL field
- optional username field
- optional password field
- transport selector `TCP/UDP`
- preview enabled toggle
- `Probar señal` button
- live preview panel
- status strip for `conectando`, `sin señal`, `credenciales inválidas`, `stream activo`

The preview panel should remain inside the modal and should not block saving camera metadata if preview is unavailable, because field installation often happens before the stream is reachable.

### UX behavior

When the operator clicks `Probar señal`:

1. the form validates the required stream fields
2. the frontend requests `preview/start`
3. the UI enters `conectando`
4. the preview panel loads the returned `viewerUrl`
5. the UI polls preview status until `live` or `failed`

When the modal closes or the camera selection changes, the frontend should explicitly stop the active preview session.

## GIS Reuse Path

The preview architecture must support later GIS integration with no new media contract. The GIS popup flow should simply:

1. resolve the node by map click
2. list associated cameras
3. invoke the same preview start endpoint for the selected camera
4. render the returned `viewerUrl` in the map popup or side panel

This keeps node coordinates as the navigation anchor while cameras remain the media source of truth.

## Security

- never return stored camera passwords in list or detail APIs
- encrypt stream passwords at rest
- redact secrets from logs and errors
- bind preview sessions to the authenticated user
- expire preview sessions aggressively
- ensure preview routes are authenticated and non-cacheable

Because this system will manage CCTV credentials, secret handling is not optional infrastructure work; it is part of the feature.

## Error Handling

Expected errors should be explicit and operator-readable:

- missing stream configuration
- invalid credentials
- timeout connecting to camera
- unsupported codec or transport
- camera reachable but preview bridge failed
- session expired

The API should return short stable error codes and a concise message. The frontend should map them into plain operator language without exposing raw low-level diagnostics by default.

## Testing

### Backend

- unit tests for stream configuration validation
- unit tests for preview session lifecycle
- unit tests ensuring camera detail responses never leak secrets
- adapter tests for error mapping from the preview bridge

### Frontend

- form tests for preview field handling
- state tests for `conectando`, `live`, and `failed`
- tests ensuring preview stop is called on modal close

### Manual verification

- create camera with valid stream and confirm live preview
- create camera with wrong password and confirm readable failure
- edit existing camera and confirm preview can be reopened
- confirm camera save still works when preview is skipped
- confirm node/camera relationships remain intact for future GIS use

## Implementation Notes

- keep the preview module separate from future recording/NVR features
- avoid coupling preview startup to camera create; operators must be able to save first and test later
- define the media adapter behind an interface from the start so the transport can evolve without data migration
- do not attempt PTZ or playback in this phase

## Success Criteria

This phase is successful when:

- operators can enter stream connection details during camera create/edit
- the form can open a live preview for a single camera
- secrets are stored safely and never leaked in normal reads
- the preview session model is reusable later from the GIS node click flow
