# Diseño: Datos de Rutas de Fibra y Empalmes

## Objetivo

Extender el módulo `/admin/routes` para documentar la red física de fibra de forma técnica y trazable, priorizando primero el **dato operativo** y dejando la visualización avanzada en mapa para una fase posterior.

El sistema debe permitir:

- documentar cables troncales y derivaciones dentro de una `Route`
- reutilizar un `Node` existente cuando un extremo o punto coincide con un nodo ya registrado
- crear automáticamente un empalme cuando el punto no corresponde a un `Node`
- registrar la composición del empalme: cables que entran/salen, capacidad, reserva y fusiones
- capturar fusiones por bloque en la UI y persistirlas internamente por hilo
- guardar trabajo incompleto como borrador, pero distinguirlo de una ruta técnicamente validada

## Alcance de esta fase

Esta fase cubre solo el **modelo de datos**, la **API** y el **wizard de captura** en `/admin/routes`.

Queda fuera por ahora:

- migración o reemplazo del módulo actual de mapa
- reconstrucción visual del trazado sobre MapLibre
- fotos, bitácora de mantenimiento, responsable técnico y adjuntos documentales
- automatización de continuidad sobre dispositivos o cámaras finales

## Decisiones confirmadas

### 1. Estructura general

La `Route` no representará un único tramo simple, sino un contenedor lógico de red de fibra.

Dentro de una `Route` existirán uno o más `FiberCable`:

- un cable principal de tipo `TRONCAL`
- uno o varios cables de tipo `DERIVACION`

Cada cable conecta un punto A y un punto B, y puede además pasar por puntos intermedios documentados como parte de su trazado operativo.

### 2. Reutilización de nodos

Cuando un punto del cable coincide con un `Node` ya existente en SIGES:

- el sistema debe reutilizar ese `Node`
- no debe duplicar el punto como entidad física separada

Cuando el punto no coincide con un `Node`:

- el sistema lo tratará como un **empalme**
- el wizard obligará a capturar la ficha técnica del empalme antes de continuar

### 3. Tipo de captura de empalme

Se implementará el nivel **empalme operativo**:

- código o nombre
- coordenada
- tipo de empalme o cierre
- capacidad de hilos
- cantidad de bandejas
- cables que entran y salen
- hilos por cable
- reserva
- fusiones

### 4. Fusión por bloque, persistencia por hilo

La UI capturará fusiones por bloque para evitar carga manual excesiva.

Ejemplo:

- cable A hilos `1-12`
- cable B hilos `1-12`

Internamente, el sistema expandirá eso a fusiones unitarias hilo a hilo para permitir trazabilidad real.

### 5. Validación documental

La captura no será estrictamente bloqueante desde el inicio.

Se usará un esquema mixto:

- se puede guardar como borrador o parcial
- solo se marca como documentado o validado cuando la continuidad y consistencia técnica estén completas

## Modelo de datos propuesto

### Entidades nuevas

#### `FiberCable`

Representa un cable físico dentro de una `Route`.

Campos iniciales:

- `id`
- `routeId`
- `code`
- `kind`: `TRONCAL | DERIVACION`
- `fiberCount`
- `status`
- `originPointId`
- `destinationPointId`
- `parentCableId` nullable
- `sourceSpliceId` nullable
- `notes`
- `documentStatus`

Uso:

- `parentCableId` permite asociar derivaciones a un cable troncal o a otro cable
- `sourceSpliceId` identifica desde qué empalme nace una derivación

#### `FiberPoint`

Representa un punto físico usado por cables.

Campos iniciales:

- `id`
- `kind`: `NODE | SPLICE`
- `nodeId` nullable
- `spliceId` nullable
- `name`
- `latitude`
- `longitude`

Reglas:

- si `kind = NODE`, debe existir `nodeId`
- si `kind = SPLICE`, debe existir `spliceId`

#### `SpliceClosure`

Representa un empalme físico.

Campos iniciales:

- `id`
- `code`
- `name`
- `closureType`
- `latitude`
- `longitude`
- `trayCount`
- `fiberCapacity`
- `notes`
- `documentStatus`

#### `SpliceCableLeg`

Representa un cable que entra o sale de un empalme.

Campos iniciales:

- `id`
- `spliceId`
- `fiberCableId`
- `direction`: `IN | OUT`
- `bufferLabel` nullable
- `fiberCount`
- `reservedFiberCount`
- `notes`

#### `SpliceBlockInput`

Representa la captura de UI por bloques antes de expandir.

Campos iniciales:

- `id`
- `spliceId`
- `fromLegId`
- `fromFiberStart`
- `fromFiberEnd`
- `toLegId`
- `toFiberStart`
- `toFiberEnd`
- `blockKind`: `FUSION | RESERVE | PASS_THROUGH | SPLIT`
- `notes`

#### `SpliceFiberConnection`

Representa la persistencia final por hilo.

Campos iniciales:

- `id`
- `spliceId`
- `fromLegId`
- `fromFiberNumber`
- `toLegId`
- `toFiberNumber`
- `connectionKind`
- `status`
- `notes`

Esta será la base para responder preguntas futuras como:

- de qué cable viene un hilo
- a qué derivación sale
- qué hilos están libres o reservados

## Relación con el modelo existente

### `Route`

Se conserva como entidad principal.

### `Node`

Se reutiliza como punto extremo o intermedio cuando aplique.

### `FiberSegment`

No debe absorber esta lógica nueva.

Razón:

- hoy `FiberSegment` representa un trazo simple útil para mapa/estado
- mezclar ahí cables, empalmes, derivaciones y fusiones volvería la entidad inconsistente

Decisión:

- el nuevo módulo de datos se construye con entidades nuevas
- más adelante se define si `FiberSegment` se deriva de estas entidades o se migra

## Estados documentales

Se propone una enum compartida para cables y empalmes:

- `DRAFT`
- `PARTIAL`
- `DOCUMENTED`
- `VALIDATED`

Significado:

- `DRAFT`: estructura apenas iniciada
- `PARTIAL`: hay datos, pero faltan fusiones, cables o coherencia
- `DOCUMENTED`: la información operativa está completa
- `VALIDATED`: el sistema confirmó consistencia técnica interna

## Reglas de validación

Un cable o empalme no podrá marcarse como `VALIDATED` si ocurre cualquiera de estas condiciones:

- rangos de bloque solapados
- un hilo aparece fusionado más de una vez en la misma dirección incompatible
- el rango de captura excede la capacidad del cable
- una derivación sale de un punto que no es empalme
- un empalme tipo `SPLICE` no tiene cables asociados
- un punto `NODE` intenta guardar datos de empalme

Validaciones adicionales:

- si el usuario crea un punto nuevo, debe completar la ficha de empalme
- una derivación debe nacer desde un empalme
- el sistema debe permitir guardar `DRAFT` aunque existan faltantes

## Flujo de UX para `/admin/routes`

La interfaz será un wizard.

### Pasos propuestos

1. Seleccionar o crear la `Route`
2. Crear cable troncal
3. Definir punto A
4. Definir punto B
5. Si un punto no es `Node`, registrar empalme
6. Añadir puntos intermedios relevantes
7. Registrar empalmes intermedios
8. Crear derivaciones desde empalmes
9. Registrar cables entrantes y salientes por empalme
10. Capturar fusiones por bloque
11. Expandir y validar por hilo
12. Guardar como `DRAFT/PARTIAL` o marcar como `DOCUMENTED/VALIDATED`

### Comportamiento esperado

- al elegir una coordenada, el sistema intentará reutilizar un `Node` existente si el usuario lo selecciona
- si no hay `Node`, abrirá automáticamente la captura de empalme
- el wizard debe mostrar el árbol lógico:
  - ruta
  - cable troncal
  - empalmes
  - derivaciones
  - bloques de fusión

## API propuesta

Se recomienda no sobrecargar el CRUD actual de `routes`.

### Nuevos endpoints

- `GET /routes/:id/fiber-cables`
- `POST /routes/:id/fiber-cables`
- `PATCH /fiber-cables/:id`
- `GET /fiber-points/:id`
- `POST /splices`
- `PATCH /splices/:id`
- `POST /splices/:id/legs`
- `POST /splices/:id/block-inputs`
- `POST /splices/:id/expand-blocks`
- `POST /fiber-cables/:id/validate`

## Estrategia de implementación recomendada

### Fase 1

- crear entidades Prisma nuevas
- exponer API base
- permitir crear ruta, cable troncal, puntos y empalmes

### Fase 2

- soportar derivaciones
- soportar `SpliceCableLeg`
- soportar captura por bloque

### Fase 3

- expandir por hilo
- validar continuidad y estados documentales

### Fase 4

- integrar visualización de trazado en mapa desde el nuevo modelo

## Riesgos y decisiones futuras

### Riesgos

- si más adelante se fuerza esto dentro de `FiberSegment`, se perderá claridad del modelo
- la trazabilidad por hilo puede crecer rápido en volumen, pero sigue siendo el modelo correcto para auditoría
- la UX del wizard puede volverse pesada si se mete mapa complejo en esta misma fase

### Decisiones futuras pendientes

- cómo derivar visualmente segmentos para MapLibre
- si habrá fotos y adjuntos por empalme
- si se registrará intervención técnica por fecha
- si un cable podrá tener múltiples trayectorias geométricas detalladas entre puntos

## Recomendación final

La implementación debe enfocarse primero en construir un **modelo de datos técnico correcto** y un wizard de captura fiable.

No conviene intentar resolver al mismo tiempo:

- documentación física detallada
- continuidad por hilo
- mapa operacional completo

La prioridad correcta es:

1. dato correcto
2. validación correcta
3. visualización derivada del dato
