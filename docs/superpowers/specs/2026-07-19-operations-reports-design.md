# Diseño: Informes Operativos en SIGES

Fecha: 2026-07-19
Estado: Propuesto para implementación

## Objetivo

Diseñar un módulo de informes institucionales dentro de `Operación` que permita generar, visualizar, exportar y almacenar informes oficiales en `PDF` y `CSV` para tres dominios principales del sistema:

- monitoreo
- inventario e infraestructura
- incidentes

El resultado debe sentirse como una capacidad formal de explotación operativa, no como un simple botón de exportación. Los informes deben usar el branding principal activo del sistema, soportar rangos de fechas, incluir estadísticas y gráficas, y conservarse como histórico oficial descargable.

## Alcance

Esta fase incluye:

- integración del módulo dentro de `Operación`
- subnavegación para informes por categoría
- filtros por rango de fechas y contexto operativo
- vista previa web
- exportación `PDF`
- exportación `CSV`
- generación manual
- generación programada
- cortes oficiales desde el primer release
- almacenamiento histórico de archivos generados
- permisos granulares para consulta, exportación, cierre y programación
- soporte para contenido visual y analítico: KPIs, gráficas, tablas y evidencias

Esta fase no incluye:

- diseñador libre de plantillas por usuario
- edición manual posterior del contenido del informe
- borradores no oficiales
- firmas criptográficas o sello de tiempo externo
- OCR o anexado automático de documentos de terceros

## Principios de diseño

1. Los informes deben nacer como artefactos oficiales, no como vistas temporales recicladas.
2. La misma identidad visual debe aplicarse a todas las familias de informe.
3. El rango temporal es obligatorio para los informes operativos y analíticos.
4. El histórico debe conservar el archivo exacto generado en el momento, sin regenerarlo después.
5. La experiencia debe servir tanto para supervisión ejecutiva como para revisión técnica.
6. La seguridad debe depender de permisos granulares, no solo del rol base.

## Ubicación en producto

El sistema ya tiene la página `Operación` en `/admin/operations`. El módulo de informes se integrará ahí y en la navegación lateral administrativa.

### Estructura objetivo en navegación

Dentro del dominio `Operación` se presentarán estas entradas:

- `Backup`
- `Informes de monitoreo`
- `Informes de inventario e infraestructura`
- `Informes de incidentes`

La recomendación es tratarlas como submódulos visibles y no como una página plana con accesos secundarios ocultos. Esto reduce clics y deja claro que el sistema ya tiene una capacidad formal de reportería.

## Enfoque funcional recomendado

El sistema ofrecerá dos capacidades complementarias desde fase 1:

- generación manual bajo demanda
- generación programada automática

Además, toda generación histórica quedará registrada como corte oficial. No habrá estados de borrador. Si un usuario genera un informe histórico, el informe nace oficialmente y queda versionado con sus archivos asociados.

## Tipos de informe iniciales

### 1. Informes de monitoreo

Pensados para disponibilidad, salud de red, caídas y comportamiento operativo por periodo.

Contenido esperado:

- disponibilidad por rango de fechas
- nodos con caída
- CMC con caída
- tiempo fuera de línea por entidad
- número de alertas por severidad
- activos silenciosos
- comparativo por ciudad, proyecto, CMC o nodo
- distribución temporal de eventos
- tendencias diarias o semanales
- evidencia de activos más inestables
- gráficas de apoyo

### 2. Informes de inventario e infraestructura

Pensados para consolidar la infraestructura registrada y descubierta.

Contenido esperado:

- inventario de CMC
- rutas asociadas
- nodos por ruta
- cámaras por nodo
- activos de nodo y activos de CMC
- IP, MAC, fabricante, modelo, hostname y estado
- distribución por ciudad y proyecto
- crecimiento del inventario por periodo
- diferencias entre inventario oficial y hallazgos de descubrimiento
- resumen topológico
- mapas o representaciones de distribución cuando aplique

### 3. Informes de incidentes

Pensados para operación, control y seguimiento.

Contenido esperado:

- incidentes abiertos
- incidentes cerrados
- incidentes por severidad
- tiempos promedio de atención y cierre
- reincidencias
- distribución por ciudad, proyecto o responsable
- series temporales
- backlog operativo
- incidentes críticos del periodo

## Salidas soportadas

### PDF

El `PDF` es la salida formal. Debe verse institucional, con branding principal activo y una narrativa clara.

Debe incluir:

- portada o encabezado institucional
- logo y nombre del branding principal activo
- tipo de informe
- rango de fechas
- fecha de generación
- usuario generador
- contexto de filtros aplicados
- resumen ejecutivo
- KPIs
- gráficas
- tablas de detalle
- hallazgos o conclusiones automáticas
- anexos técnicos si aplica
- pie de página con numeración y metadatos

### CSV

El `CSV` es la salida operativa.

Debe:

- corresponder exactamente al mismo corte y filtros del PDF
- priorizar integridad y claridad tabular
- evitar decoración visual
- servir para auditoría, Excel y explotación externa

## Plantilla documental

Se implementará una plantilla maestra única con módulos internos por tipo de informe.

### Razón de esta decisión

Una plantilla maestra mantiene consistencia institucional, reduce mantenimiento y simplifica branding. Al mismo tiempo, los módulos por tipo permiten que el contenido interno cambie mucho sin duplicar el marco general del documento.

### Partes fijas de la plantilla maestra

- encabezado institucional
- branding principal activo
- metadatos del corte
- sección de filtros
- estructura de resumen ejecutivo
- pie de página
- numeración
- bloque de trazabilidad

### Partes modulares por tipo

- KPIs específicos
- gráficas específicas
- tablas específicas
- mapas o visualizaciones específicas
- bloques de hallazgos específicos

## Vista previa web

Antes de exportar o cerrar un corte, el usuario verá una previsualización web del informe. Esta previsualización no reemplaza el archivo oficial, pero permite validar:

- rango de fechas
- filtros
- volumen de datos
- indicadores principales
- claridad visual

La previsualización debe usar la misma lógica semántica del PDF, aunque no necesita replicar píxel por píxel la salida impresa.

## Histórico oficial

Todo informe generado como corte histórico quedará almacenado como artefacto oficial del sistema.

Cada registro histórico debe guardar:

- identificador único
- tipo de informe
- subtipo o familia
- fecha y hora de generación
- usuario generador
- rango de fechas reportado
- filtros completos serializados
- branding aplicado
- ruta o referencia al archivo PDF
- ruta o referencia al archivo CSV
- origen manual o programado
- metadatos de ejecución

### Regla clave

El sistema no debe regenerar el histórico cuando alguien lo consulte después. Debe descargar el archivo exacto que se produjo en su momento.

## Programación automática

Desde fase 1 se soportará programación automática.

Frecuencias mínimas:

- semanal
- mensual

Cada programación debe definir:

- tipo de informe
- rango relativo
- filtros fijos
- branding objetivo
- destinatario interno o responsable
- convención de nombre del corte

La ejecución automática debe crear un corte oficial igual que la ejecución manual.

## Branding

Los informes deben utilizar el branding principal activo del sistema al momento de generar el corte.

Eso implica:

- logo principal
- nombre visible del sistema o entidad
- colores institucionales
- textos de encabezado y pie institucional

El branding aplicado debe quedar guardado en los metadatos del corte para trazabilidad. Si después cambia el branding activo, los informes históricos no deben mutar.

## Permisos

El acceso no debe depender solo del rol.

Regla base sugerida:

- visibles por defecto para `SUPER_ADMIN`, `ADMIN`, `SUPERVISOR`

Además, se agregarán permisos granulares:

- `REPORTS_VIEW`
- `REPORTS_EXPORT`
- `REPORTS_CLOSE_PERIOD`
- `REPORTS_SCHEDULE`

### Uso esperado

- `REPORTS_VIEW`: puede entrar y consultar informes
- `REPORTS_EXPORT`: puede descargar PDF/CSV
- `REPORTS_CLOSE_PERIOD`: puede generar cortes oficiales
- `REPORTS_SCHEDULE`: puede crear y editar programaciones

Esto permite que un `TECHNICIAN` o `VIEWER` acceda solo a lectura o exportación si la operación lo requiere.

## Datos y fuentes

Los informes deben alimentarse de capacidades reales ya presentes en SIGES.

### Monitoreo

- heartbeat de nodos y CMC
- alertas operativas
- alertas de telemetría
- observabilidad y métricas de red
- estados en tiempo real y recientes

### Inventario e infraestructura

- CMC
- rutas
- nodos
- cámaras
- activos oficiales de nodo y de CMC
- descubrimiento interno y externo
- fabricantes y metadatos técnicos

### Incidentes

- incidentes registrados
- severidades
- estados
- tiempos y trazabilidad

## Visualizaciones del informe

El valor esperado por producto es alto. Los informes deben incluir estadística y visualización rica.

Visualizaciones recomendadas:

- tarjetas KPI
- barras
- torta
- líneas de tendencia
- distribución por estado o severidad
- comparativos entre entidades
- tablas resumidas y detalladas
- mapas o capturas GIS cuando aporte valor
- capturas o gráficos derivados de observabilidad cuando aplique

## Hallazgos automáticos

Cada informe debe incluir una sección de hallazgos automáticos. No se trata de IA generativa libre, sino de conclusiones derivadas de reglas y agregados.

Ejemplos:

- nodo con mayor tiempo offline del periodo
- CMC con más alertas críticas
- ciudad con mayor concentración de incidentes
- porcentaje del inventario sin fabricante reconocido
- incremento o reducción frente al periodo anterior

Esto hace que el informe no sea solo una tabla impresa.

## Arquitectura lógica propuesta

### Backend

Se recomienda introducir un subsistema de reportería con responsabilidades separadas:

- definición de tipos de informe y contratos de entrada
- agregación de datos por familia
- render de previsualización
- render de PDF
- render de CSV
- almacenamiento histórico
- programación automática

Separación sugerida:

- servicio de catálogos y definiciones
- servicio de consulta/agregación por tipo
- servicio de render
- servicio de almacenamiento
- servicio de programación
- controlador API para preview, exportación e histórico

### Frontend

Se recomienda:

- extender `Operación` con navegación secundaria
- una pantalla por familia de informe
- un patrón común de filtros y preview
- acciones claras:
  - `Previsualizar`
  - `Exportar PDF`
  - `Exportar CSV`
  - `Generar corte oficial`
  - `Programar`
  - `Ver histórico`

## Flujo de usuario

### Generación manual

1. El usuario entra al tipo de informe.
2. Define rango de fechas y filtros.
3. Solicita la previsualización.
4. Revisa KPIs, gráficas y resultados.
5. Exporta o genera corte oficial.
6. El sistema guarda PDF y CSV en histórico.

### Generación programada

1. El usuario autorizado define una programación.
2. El sistema ejecuta automáticamente según frecuencia.
3. Se produce un corte oficial.
4. El informe queda en histórico con origen programado.

## Errores y casos límite

El diseño debe contemplar:

- rango de fechas vacío o inválido
- ausencia de datos en el periodo
- branding principal faltante o incompleto
- error al renderizar PDF
- error al guardar archivo histórico
- filtros demasiado amplios con tiempo de respuesta elevado
- programación duplicada o conflictiva

### Reglas recomendadas

- si no hay datos, el informe debe generarse igual, indicando explícitamente ausencia de registros
- si falla el render PDF, no debe registrarse un corte oficial incompleto
- PDF y CSV deben generarse dentro de una misma transacción lógica de corte

## Criterios de calidad

El módulo se considera profesional si cumple esto:

- el usuario puede generar informes por fecha con filtros claros
- el documento se ve institucional y consistente
- el histórico conserva artefactos oficiales inmutables
- el CSV coincide con el corte del PDF
- la programación automática produce el mismo tipo de artefacto que la manual
- el acceso está controlado por permisos granulares
- los informes contienen estadísticas, no solo tablas planas

## Recomendación de implementación

La primera implementación debe enfocarse en entregar valor visible de extremo a extremo:

1. estructura en `Operación`
2. permisos nuevos
3. entidad histórica de informes
4. preview + generación oficial
5. PDF y CSV
6. histórico descargable
7. programación semanal y mensual
8. visualizaciones analíticas para las tres familias iniciales

## Decisiones cerradas en este diseño

- el módulo vive dentro de `Operación`
- habrá submódulos para monitoreo, inventario e infraestructura, incidentes y backup
- los informes usarán rango de fechas
- el PDF llevará branding principal activo
- existirá preview web
- habrá `PDF` y `CSV`
- habrá cortes oficiales desde fase 1
- los archivos quedarán almacenados como histórico
- no habrá borradores
- habrá generación manual y programada
- la plantilla será maestra con módulos internos
- habrá permisos granulares además del rol base
- los informes deben incluir estadísticas, gráficas y evidencias visuales
