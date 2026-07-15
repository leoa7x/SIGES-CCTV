# Production Copy And UX Hardening Design

## Scope

Cerrar residuos visibles de desarrollo antes de salida a producción en SIGES-CCTV. El alcance aprobado cubre:

- UI visible al operador y al administrador.
- Mensajes backend expuestos al usuario.
- Seeds y documentación operativa donde hoy aparecen credenciales demo o copy residual obvio.

Quedan fuera refactors estructurales amplios, rediseños de navegación y limpieza histórica completa de documentación antigua.

## Design

### Copy and presentation normalization

Se centralizará el copy operativo repetido en helpers livianos del frontend para evitar que cada pantalla renderice enums o etiquetas técnicas crudas. Los estados `ACTIVE`, `INACTIVE` y `ARCHIVED` se seguirán enviando igual al backend, pero la UI mostrará etiquetas operativas en español.

### Inline operator feedback

Los flujos críticos que hoy usan `window.alert` migrarán a avisos inline dentro de la propia vista. La intención es mantener continuidad visual, permitir reintento sin bloquear el navegador y dejar el contexto del error visible dentro del módulo donde ocurrió.

### Login branding completion

El login mantendrá logo y mensaje configurables, pero además dejará de mezclar copy institucional fijo con branding dinámico. El texto estático residual se ajustará a un tono neutral y consistente con despliegues por ciudad o departamento.

### Backend message hygiene

Los errores de autenticación expuestos al cliente saldrán en español operacional. No cambia la semántica del endpoint; solo cambia el copy retornado.

### Demo and documentation hygiene

Los seeds y documentos operativos dejarán de exhibir credenciales demo explícitas en claro cuando no sean necesarias para comprender el flujo. Se reemplazarán por placeholders o instrucciones de variables de entorno.

## Error Handling

- Si falla una acción de red desde la UI, se mostrará un aviso inline con mensaje claro y contextual.
- Si no llega mensaje útil desde backend, se usará un fallback breve en español.
- No se cambiarán códigos HTTP ni contratos JSON existentes.

## Testing

- Pruebas unitarias para helpers de presentación/copy en frontend.
- Prueba unitaria para el mensaje de autenticación en backend.
- Verificación focalizada de compilación/tests de los módulos tocados.
