# SIGES-CCTV Network Monitor UX Refresh Design

Date: 2026-07-14
Owner: Codex
Status: Proposed

## Goal

Rediseñar `/monitoring/network` para que se vea profesional y premium, manteniendo su utilidad operativa real. La dirección aprobada es un híbrido entre dashboard `Analyst` y estética `premium corporativo`.

El resultado debe comunicar tres cosas desde la primera pantalla:

1. Estado general de la red.
2. Observabilidad global embebida desde Grafana.
3. Espacio táctico para operar por nodo sin perder el contexto.

## Non-Goals

- No cambiar la lógica de negocio de discovery, inventario, correlación ni alertas.
- No reemplazar modelos SIGES por datos crudos de Grafana.
- No mover rutas, puertos ni flujos de autenticación.
- No rediseñar otras pantallas administrativas en esta fase.

## User Intent

El usuario quiere que el monitor se vea más serio y moderno, tomando referencias visuales de dashboards bien resueltos, sin convertirlo en una plantilla genérica. Debe servir tanto para impresionar visualmente como para operar.

## Design Direction

### Chosen Visual Style

- Base funcional: `Analyst`
- Capa visual: `premium corporativo`
- Paleta dominante: `azul acero + cian`
- Fondo base: grafito profundo
- Colores de estado:
  - verde para saludable
  - ámbar para degradado o advertencia
  - rojo para crítico

### Why This Direction

`Executive` puro sería demasiado liviano para un monitor técnico. `SOC wall` puro sería demasiado denso para la etapa actual. El híbrido permite que la pantalla tenga presencia visual fuerte, pero siga priorizando decisiones operativas.

## Information Hierarchy

La jerarquía visual y funcional será:

1. Hero ejecutivo con métricas.
2. Panel global de Grafana como pieza protagonista.
3. Workspace operativo por nodo.
4. Tablas, listas y superficies secundarias.

Esto fuerza a que un usuario entienda el estado general antes de entrar al detalle táctico.

## Page Architecture

### 1. Hero Ejecutivo

La parte superior de `/monitoring/network` se convertirá en una banda de presentación con:

- título más fuerte y corto
- subtítulo operacional
- métricas clave resumidas
- lectura de salud general

El hero debe verse más limpio que la versión actual. Debe tener más aire, mejor contraste y una sensación menos “widgetizada”.

#### Content

- total de nodos
- nodos en línea
- degradados / fuera de línea
- inventario oficial
- pendientes de discovery
- última actividad o ventana de observación

#### Presentation Rules

- métricas en tarjetas más sobrias y consistentes
- menos ruido visual en bordes
- contraste por capas y profundidad, no por saturación excesiva
- mayor tamaño de tipografía en los KPIs principales

### 2. Grafana Global Anchored Block

El bloque global de Grafana debe ir arriba, inmediatamente debajo del hero, como superficie principal de observabilidad.

#### Behavior

- mantiene el embed actual
- usa el descriptor `network-command-view`
- sigue viviendo dentro de SIGES
- no reemplaza el resto del monitor

#### Presentation Rules

- ancho completo
- título y framing visual consistentes con el hero
- contenedor premium, integrado al shell
- altura suficiente para sentirse protagonista, pero sin empujar demasiado el workspace operativo debajo

### 3. Workspace Operativo

Debajo del panel global se mantiene el patrón de trabajo a dos columnas:

- izquierda: rail de nodos
- derecha: superficie de detalle operacional

La diferencia es que esta zona debe verse más intencional, con jerarquía visual clara y menos sensación de paneles “pegados”.

#### Left Rail: Node Command List

El listado de nodos debe sentirse como un rail táctico:

- tarjetas más consistentes
- mejor señal visual de estado
- selección más obvia
- datos secundarios más comprimidos

Cada nodo debe comunicar rápidamente:

- código
- nombre
- ruta / centro
- estado operativo
- volumen relativo de activos / scans / analíticas

#### Right Panel: Node Operational Surface

El detalle del nodo debe tener:

- encabezado más fuerte
- badges más limpios
- acción primaria clara para discovery
- tabs con mejor jerarquía

Los tabs actuales (`Inventario`, `Tráfico / Observabilidad`, `Alertas`) se mantienen, pero con mejor framing visual.

## Component Strategy

El refresh debe concentrarse principalmente en:

- `apps/web/app/monitoring/network/page.tsx`

Puede incluir refactor ligero dentro del mismo archivo o extracción pequeña de presentacionales si mejora legibilidad, pero sin convertir esta fase en un refactor amplio del frontend.

`OpsShell` no debe ser rediseñado por completo en esta fase. Solo se aceptan ajustes puntuales si son necesarios para integrar mejor la nueva jerarquía del monitor.

## Visual System Rules

### Layout

- más espacio vertical entre bloques principales
- grillas más ordenadas
- módulos secundarios más compactos
- evitar que todas las superficies compitan entre sí

### Typography

- título del hero con más peso
- subtítulos y labels más controlados
- microcopy operacional corto
- tablas y listas siguen siendo legibles y densas, no decorativas

### Surfaces

- combinar paneles oscuros con highlights cian / azul
- usar degradados sutiles y capas
- evitar exceso de glow o efectos que se sientan arcade

### Charts

- deben verse parte del mismo producto
- mantener colores de estado coherentes
- priorizar legibilidad antes que ornamento

## Interaction Rules

- no cambiar rutas ni navegación
- no cambiar comportamiento de auth
- no cambiar contratos de `apiGet`, embeds ni telemetry helpers
- el rail de nodos debe seguir siendo rápido de usar
- el panel global no debe bloquear el trabajo por nodo

## Data Ownership

SIGES sigue siendo dueño de:

- inventario correlacionado
- discovery
- alerts modeladas en aplicación
- detalle operativo por nodo

Grafana sigue siendo solo la capa de visualización embebida para observabilidad global y por nodo.

## Error and Empty States

Los estados ya existentes deben preservarse, pero visualmente alineados con el refresh:

- loading del panel global
- embed no disponible
- nodo no seleccionado
- inventario vacío
- sin pendientes de discovery

No se deben introducir overlays invasivos ni modales nuevos para esta fase.

## Testing Requirements

La implementación debe verificar como mínimo:

- `npm run test:network-monitor --workspace=apps/web`
- `npm run build --workspace=apps/web`

Si se extraen helpers visuales o de modelado, deben quedar cubiertos por pruebas focalizadas cuando aplique.

## Acceptance Criteria

- `/monitoring/network` se percibe visualmente más profesional y premium.
- La jerarquía superior es: hero, Grafana global, workspace operativo.
- El panel global de Grafana queda arriba y claramente integrado.
- El workspace por nodo sigue funcionando como superficie táctica.
- No se rompe la lógica actual de inventario, discovery, tráfico o alertas.
- La pantalla sigue funcionando sobre `3001`.
- La build y las pruebas del monitor pasan.

## Implementation Boundaries

Esta fase sí puede:

- reorganizar layout
- ajustar estilos
- mejorar jerarquía visual
- mejorar composición de paneles

Esta fase no debe:

- alterar APIs
- redefinir modelos de dominio
- introducir dependencia nueva de dashboard externo
- tocar mapas o topology

## Risks

### Risk 1: Overdesign

Si se exageran gradientes, glows o capas, el resultado pierde seriedad. La implementación debe preferir sobriedad visual.

### Risk 2: Losing Operational Density

Si se exagera el look corporativo, el monitor deja de servir para operar. Las tablas, filtros, badges y acciones tácticas deben seguir visibles y accesibles.

### Risk 3: Scope Drift

Este refresh puede tentar a rediseñar todo el shell. Eso queda fuera. El foco es `/monitoring/network`.

## Recommendation

Implementar el refresh en una sola fase acotada sobre la pantalla de monitoreo de red, con cambios visuales fuertes pero cambios funcionales mínimos. La prioridad es que el monitor se vea como un producto serio de NOC sin sacrificar el flujo táctico ya construido.
