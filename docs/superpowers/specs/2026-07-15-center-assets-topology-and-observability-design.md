# Center Assets Topology And Observability Design

## Objective

Modelar y visualizar equipos de red que pertenecen al Centro de Monitoreo (CMC) sin forzarlos a existir como nodos de campo, y dejarlos listos para observabilidad en topología y Grafana.

## Current State

- `MonitoringCenter` ya existe como entidad maestra del CMC.
- `Node` representa infraestructura de campo ligada a una `Route`.
- `NodeAsset` representa equipos ligados a un `Node`.
- La topología actual agrupa nodos por CMC.
- El monitoreo y la observabilidad actuales asumen `nodeId` como origen para inventario, discovery y telemetría.

## Problem

Hay equipos de red que viven físicamente dentro del CMC y no en nodos de campo. Si se modelan como nodos falsos, se mezcla infraestructura de campo con infraestructura interna del centro de mando, lo que complica GIS, rutas, discovery y observabilidad.

## Recommended Approach

Crear una nueva entidad `CenterAsset` asociada directamente a `MonitoringCenter`.

Esta entidad convivirá con `NodeAsset`:

- `MonitoringCenter -> CenterAsset`
- `Node -> NodeAsset`

No se reutilizará `NodeAsset` con dueños opcionales, y no se crearán nodos falsos para representar equipos del CMC.

## Data Model

### New Entity

`CenterAsset` tendrá, como mínimo:

- `id`
- `centerId`
- `assetType`
- `name`
- `ip`
- `mac`
- `vendor`
- `model`
- `hostname`
- `operativeState`
- `source`
- `lastSeenAt`
- `notes`
- `createdAt`
- `updatedAt`

### Reused Concepts

Para no abrir un catálogo nuevo innecesario, `CenterAsset` debe reutilizar los mismos enums y convenciones ya usados por `NodeAsset` cuando sea posible:

- `NodeAssetType`
- `NodeState`
- `NodeAssetSource`

### Existing CMC Data Reused

No se duplicará información del CMC. `CenterAsset` se colgará del `centerId` existente y heredará su contexto mediante relaciones ya presentes:

- nombre del CMC
- dirección
- contacto
- teléfono
- proyecto
- ciudad
- coordenadas del CMC

## Scope

### Included In This Phase

- Nuevo modelo `CenterAsset`
- CRUD backend para `CenterAsset`
- Gestión UI de equipos dentro del módulo de CMC
- Integración en la vista de topología
- Integración inicial en observabilidad/Grafana
- Inventario oficial del CMC administrado manualmente

### Explicitly Excluded In This Phase

- Discovery Orangutan para CMC
- Confirmación automática de hallazgos para `CenterAsset`
- Georreferenciación individual de equipos del CMC
- Conversión del CMC en nodo principal de la red

## Admin UI

La administración de CMC incorporará un bloque o pestaña de `Equipos del CMC`.

Capacidades:

- listar equipos del centro
- crear equipo
- editar equipo
- eliminar equipo

El formulario seguirá el patrón de `NodeAsset` para minimizar complejidad operativa y técnica.

Campos esperados:

- tipo
- nombre
- IP
- MAC
- fabricante
- modelo
- hostname
- estado
- notas

## Topology UX

La topología de cada CMC mostrará dos ramas separadas:

1. `Infraestructura CMC`
2. `Rutas / Nodos`

Esto debe dejar claro al operador qué equipos viven dentro del centro de mando y cuáles pertenecen a la red desplegada en campo.

La estructura visual objetivo es:

- `CMC`
- `Infraestructura CMC`
- `Equipos del CMC`
- `Rutas`
- `Nodos`

## Observability And Grafana

En esta fase, los `CenterAsset` entran a observabilidad como inventario oficial del CMC.

Capacidades esperadas:

- consulta de activos por `centerId`
- resumen operativo por CMC
- dashboards globales que puedan agregar `NodeAsset` y `CenterAsset`
- dashboards específicos del CMC que muestren su infraestructura interna

## Telemetry Strategy For This Phase

Esta fase no incorpora discovery Orangutan para CMC.

Los `CenterAsset` serán:

- cargados manualmente
- visibles en topología
- elegibles para observabilidad y Grafana

La siguiente fase podrá extender discovery y correlación automática para `centerId`, pero sin cambiar el modelo base definido aquí.

## Backend Design

Se añadirá un módulo paralelo al de `node-assets`, orientado a `center-assets`.

Responsabilidades:

- CRUD de activos del CMC
- consultas por `centerId`
- entrega de inventario oficial para topología y observabilidad

No debe alterar semánticamente el comportamiento actual de `NodeAsset`.

## Risks And Tradeoffs

### Tradeoff Accepted

Se introduce una entidad nueva en vez de reutilizar `NodeAsset`.

Costo:

- más código
- más endpoints
- más consultas

Beneficio:

- modelo limpio
- menos lógica condicional
- menos riesgo de mezclar infraestructura de campo con infraestructura del CMC
- mejor base para futura extensión de discovery del CMC

### Deferred Risk

La observabilidad actual está orientada a `nodeId`, por lo que integrar `centerId` requerirá ampliar algunas consultas y agregaciones. Ese cambio es aceptado en esta fase porque mantiene el modelo correcto desde el inicio.

## Testing

Se deberán cubrir al menos:

- creación, edición y eliminación de `CenterAsset`
- listado por `centerId`
- render de equipos del CMC en topología
- inclusión de inventario CMC en los modelos de observabilidad necesarios
- no regresión sobre `NodeAsset` y topología existente

## Success Criteria

La fase se considera completa cuando:

- un CMC puede tener equipos propios registrados
- esos equipos aparecen separados de los nodos en topología
- esos equipos pueden verse como inventario oficial del CMC en observabilidad
- Grafana puede consumirlos por `centerId`
- no fue necesario crear nodos falsos para representar infraestructura del CMC
