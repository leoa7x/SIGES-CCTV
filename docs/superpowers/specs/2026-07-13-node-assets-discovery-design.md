# Node Assets Discovery Design

Fecha: 2026-07-13
Proyecto: SIGES-CCTV
Área: `/admin/nodes`, inventario de equipos, analíticas y descubrimiento de red

## Objetivo

Extender el módulo de nodos para que cada nodo represente explícitamente un poste con coordenada geográfica y pueda administrar:

- datos de red base del nodo
- equipos activos asociados al nodo
- descubrimientos temporales obtenidos por escaneo de red
- analíticas configuradas a nivel nodo
- analíticas configuradas a nivel equipo
- sincronización de cámaras confirmadas con el módulo existente de `/admin/cameras`

El flujo debe permitir descubrimiento automático temporal y confirmación manual para volver inventario oficial del nodo.

## Decisiones confirmadas

- El nodo representa el poste físico.
- El nodo debe tener coordenada.
- El nodo tendrá `IP principal` obligatoria.
- El nodo tendrá `subred/CIDR` opcional.
- El escaneo usa la subred explícita si existe; si no, se deriva desde la IP principal.
- Los equipos activos relevantes iniciales son:
  - `CAMARA_PTZ`
  - `CAMARA_FIJA`
  - `SWITCH`
  - `UPS`
- Los equipos pueden tener IP, MAC, marca, modelo y nombre.
- Las analíticas se gestionan en dos niveles:
  - analíticas del nodo
  - analíticas por equipo
- El catálogo de analíticas será fijo con opción `Otra` y texto libre adicional.
- El descubrimiento será automático temporal, pero el inventario oficial solo se crea por confirmación manual del operador.
- El mínimo para confirmar un equipo oficialmente es:
  - tipo
  - IP
  - MAC
  - nombre
  - marca/modelo si se logró detectar
- Las cámaras confirmadas deben seguir visibles y sincronizadas en `/admin/cameras`.
- Herramienta base de descubrimiento: `LAN-Orangutan`.
- Enriquecimiento posterior:
  - `ONVIF` para cámaras
  - `SNMP` para switches y UPS

## Enfoque recomendado

Se adopta un modelo intermedio separado:

- `Node` mantiene la identidad física y de red del poste.
- `NodeDiscoveryJob` registra ejecuciones de escaneo.
- `NodeDiscoveredDevice` guarda hallazgos temporales.
- `NodeAsset` guarda inventario oficial del nodo.
- `AnalyticsCatalog` centraliza el catálogo de analíticas.
- relaciones separadas asignan analíticas a nodo y a activo.

Este enfoque separa claramente:

- infraestructura física
- resultados temporales de descubrimiento
- inventario validado por operación
- analíticas configuradas

Evita sobrecargar `Node` con JSON o estados ambiguos y soporta reportes, filtros, sincronización y evolución futura.

## Modelo de datos

### Node

El nodo conserva su rol actual y se amplía con:

- `lat`, `lng` como coordenadas operativas del poste
- `primaryIp` obligatorio
- `scanSubnetCidr` opcional
- relaciones a activos oficiales
- relaciones a jobs de descubrimiento
- relaciones a analíticas del nodo

Notas:

- `ip` actual del nodo debe consolidarse hacia `primaryIp` o mantenerse alineado durante la migración.
- La UI debe dejar explícito que el nodo es un poste, no un equipo.

### NodeAsset

Representa un equipo oficial confirmado dentro del nodo.

Campos iniciales:

- `id`
- `nodeId`
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

Enumeración `assetType` inicial:

- `CAMARA_PTZ`
- `CAMARA_FIJA`
- `SWITCH`
- `UPS`
- `OTHER`

Enumeración `source` inicial:

- `MANUAL`
- `DISCOVERY`
- `DISCOVERY_ENRICHED`

Reglas:

- un nodo puede tener múltiples activos del mismo tipo
- `mac` debe ser única cuando exista
- `ip` no debe repetirse dentro del mismo nodo

### NodeDiscoveryJob

Representa una ejecución de descubrimiento sobre un nodo.

Campos:

- `id`
- `nodeId`
- `status`
- `requestedByUserId`
- `targetIp`
- `targetSubnetCidr`
- `startedAt`
- `finishedAt`
- `rawSummary`
- `errorMessage`

Estados:

- `PENDING`
- `RUNNING`
- `COMPLETED`
- `FAILED`

### NodeDiscoveredDevice

Representa un hallazgo temporal proveniente del escaneo.

Campos:

- `id`
- `nodeDiscoveryJobId`
- `candidateType`
- `name`
- `ip`
- `mac`
- `vendor`
- `model`
- `hostname`
- `discoveryConfidence`
- `status`
- `matchedAssetId`
- `rawPayload`

Estados:

- `DISCOVERED`
- `CONFIRMED`
- `DISMISSED`
- `MERGED`

Reglas:

- un hallazgo no confirmado no cuenta como inventario oficial
- si se confirma, genera o actualiza un `NodeAsset`

### AnalyticsCatalog

Catálogo base de analíticas seleccionables.

Campos:

- `id`
- `code`
- `name`
- `scope`
- `isCustom`

Catálogo inicial sugerido:

- `LPR`
- `RECONOCIMIENTO_FACIAL`
- `CONTEO_PERSONAS`
- `INTRUSION`
- `CRUCE_LINEA`
- `LOITERING`
- `OTHER`

`scope`:

- `NODE`
- `ASSET`
- `BOTH`

### NodeAnalyticsAssignment

Asigna analíticas al nodo.

Campos:

- `id`
- `nodeId`
- `analyticsCatalogId`
- `customLabel`
- `isEnabled`
- `notes`

### NodeAssetAnalyticsAssignment

Asigna analíticas a un activo oficial del nodo.

Campos:

- `id`
- `nodeAssetId`
- `analyticsCatalogId`
- `customLabel`
- `isEnabled`
- `notes`

## Integración con descubrimiento

### Fase 1: LAN-Orangutan

`LAN-Orangutan` será la fuente inicial de descubrimiento de equipos en red local.

Uso previsto:

- si el nodo tiene `scanSubnetCidr`, escanear esa subred
- si no la tiene, derivar la subred desde `primaryIp`
- guardar JSON normalizado como resultados de `NodeDiscoveredDevice`

Capacidades esperadas en esta fase:

- IP
- MAC
- vendor
- hostname
- presencia online/offline

Limitación conocida:

- el modelo exacto del equipo no está garantizado por `LAN-Orangutan`
- por eso el campo `model` debe ser editable manualmente y enriquecible después

### Fase 2: enriquecimiento

Se deja diseñada una segunda etapa, fuera del primer slice:

- `ONVIF` para cámaras IP
- `SNMP` para switches y UPS

La salida de estas integraciones actualizará `vendor`, `model`, `hostname`, capacidades y otros metadatos del `NodeAsset`.

## Sincronización con cámaras

Cuando un `NodeAsset` confirmado sea tipo cámara:

- debe poder crear una `Camera` si no existe
- debe poder vincularse a una `Camera` existente si corresponde
- `/admin/cameras` debe seguir mostrando cámaras oficiales

Regla inicial recomendada:

- `NodeAsset` será la fuente operativa del inventario del nodo
- `Camera` seguirá existiendo para el módulo especializado de cámaras
- al confirmar una cámara desde descubrimiento:
  - si no hay coincidencia por MAC o IP, se crea `Camera`
  - si ya existe, se actualiza el vínculo con el nodo y los metadatos faltantes

No se sincronizarán automáticamente `SWITCH` ni `UPS` con módulos externos en esta fase.

## Flujo funcional

### Crear/editar nodo

En `/admin/nodes`, el formulario del nodo debe permitir:

- código
- nombre
- ruta
- coordenada
- IP principal
- subred/CIDR opcional
- tipo/estado si aplica al modelo existente

### Escanear nodo

Desde el detalle del nodo:

- botón `Escanear red`
- crea `NodeDiscoveryJob`
- ejecuta descubrimiento
- muestra progreso y resultado

### Revisar descubrimientos

El operador verá lista de hallazgos temporales con:

- tipo sugerido
- IP
- MAC
- vendor
- hostname
- nombre sugerido
- coincidencias con activos existentes

Acciones:

- confirmar
- descartar
- fusionar con activo existente
- editar antes de confirmar

### Confirmar activo

Antes de confirmar, la UI debe exigir:

- tipo
- IP
- MAC
- nombre

Si `vendor` o `model` fueron detectados, se precargan.
Si no fueron detectados, el usuario puede completarlos manualmente.

### Analíticas

En el detalle del nodo habrá dos bloques:

- `Analíticas del nodo`
- `Analíticas por equipo`

Cada bloque usa:

- catálogo fijo
- opción `Otra`
- texto libre para `Otra`

## Diseño de UI para `/admin/nodes`

La pantalla debe evolucionar de una tabla simple a una vista de trabajo por nodo.

### Sección 1: tabla principal

Lista de nodos con:

- código
- nombre
- ruta
- coordenada
- IP principal
- subred
- cantidad de activos oficiales
- cantidad de descubrimientos pendientes

### Sección 2: panel detalle del nodo

Subsecciones:

- `Datos del poste`
- `Red del nodo`
- `Equipos oficiales`
- `Descubrimientos pendientes`
- `Analíticas del nodo`
- `Analíticas por equipo`

### Sección 3: equipos oficiales

Para cada `NodeAsset`:

- tipo
- nombre
- IP
- MAC
- vendor/model
- estado
- última vez visto
- analíticas asignadas

### Sección 4: descubrimientos pendientes

Vista orientada a revisión operativa:

- chips de confianza
- coincidencias con activos
- edición inline de tipo/nombre
- acciones rápidas de confirmar/descartar/fusionar

## API propuesta

### Nodos

- extender `GET /nodes`
- extender `GET /nodes/:id`
- extender `POST /nodes`
- extender `PATCH /nodes/:id`

Nuevos campos mínimos:

- `primaryIp`
- `scanSubnetCidr`
- `lat`
- `lng`
- conteos de activos y descubrimientos

### Descubrimiento

- `POST /nodes/:id/discovery-jobs`
- `GET /nodes/:id/discovery-jobs`
- `GET /nodes/:id/discovered-devices`
- `POST /discovered-devices/:id/confirm`
- `POST /discovered-devices/:id/dismiss`
- `POST /discovered-devices/:id/merge`

### Activos del nodo

- `GET /nodes/:id/assets`
- `POST /nodes/:id/assets`
- `PATCH /node-assets/:id`

### Analíticas

- `GET /analytics-catalog`
- `POST /nodes/:id/analytics`
- `PATCH /node-analytics/:id`
- `POST /node-assets/:id/analytics`
- `PATCH /node-asset-analytics/:id`

## Reglas de negocio

- un nodo siempre representa un poste físico
- un nodo debe tener coordenada
- `primaryIp` es obligatoria
- `scanSubnetCidr` es opcional
- el inventario oficial solo sale de confirmación manual o creación manual
- los descubrimientos temporales no modifican dashboards operativos
- una cámara oficial debe seguir disponible en `/admin/cameras`
- `MAC` es el mejor identificador para evitar duplicados
- `IP` puede cambiar; no debe ser el único criterio de identidad

## Riesgos y mitigaciones

### Detección incompleta de modelo

Riesgo:

- `LAN-Orangutan` puede no devolver `model`

Mitigación:

- mantener `model` editable
- diseñar enriquecimiento `ONVIF`/`SNMP`

### Duplicación entre NodeAsset y Camera

Riesgo:

- divergencia de datos

Mitigación:

- definir sincronización por confirmación
- priorizar `MAC` y `IP` para matching
- no crear cámaras temporales sin confirmación

### Escaneo sobre subred incorrecta

Riesgo:

- hallazgos irrelevantes

Mitigación:

- exponer claramente el destino del escaneo antes de ejecutarlo
- permitir editar `scanSubnetCidr`

## Fases de implementación

### Fase 1

- ampliar `Node`
- crear modelos `NodeAsset`, `NodeDiscoveryJob`, `NodeDiscoveredDevice`
- crear catálogo y asignaciones de analíticas
- rediseñar `/admin/nodes`
- alta manual de activos

### Fase 2

- integración con `LAN-Orangutan`
- descubrimiento temporal y confirmación manual

### Fase 3

- sincronización completa con cámaras
- enriquecimiento `ONVIF` y `SNMP`

## Éxito esperado

El módulo se considerará bien diseñado cuando:

- `/admin/nodes` permita administrar un poste como unidad operativa real
- cada nodo tenga coordenada e identidad de red base
- los equipos del nodo queden inventariados oficialmente
- los descubrimientos no confirmados no contaminen operación
- las analíticas puedan documentarse a nivel nodo y equipo
- las cámaras confirmadas sigan funcionando dentro del módulo actual de cámaras
