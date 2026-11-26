# HU-001 Consultar calendario de citas

## Why
La recepcionista necesita consultar citas y disponibilidad por sucursal, incluso en fechas históricas.

## What Changes
- Lectura de calendario día/semana/mes, detalle y franjas de 30 minutos.
- Permiso `calendar:read` para recepcionista (superadmin lo hereda por catálogo).
- Interfaz accesible con etiquetas de estado, filtros locales y navegación temporal.

## Non-goals
No registrar reservas, modificar otras HUs, migrar ni escribir datos. La regla histórica de config.yaml sobre limitar propuestas a fundación técnica se exceptúa por la solicitud explícita de implementar HU-001. No se modifican otros cambios OpenSpec.

## Impact
Submódulo calendar nuevo, registro mínimo de módulo, permiso, rol, ruta y navegación.
