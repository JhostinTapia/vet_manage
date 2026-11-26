# Tareas HU-001
- [x] Revisar base Git, instrucciones y OpenSpec existente.
- [x] Definir propuesta, diseño y escenarios CP-001-01 a CP-001-04.
- [x] Implementar consultas y detalle acotados a sucursal, validación y autorización.
- [x] Implementar franjas históricas con ocupación sin filtro y fechas Ecuador.
- [x] Implementar vistas, navegación, filtros, detalle y punto de integración honesto.
- [x] Probar criterios, límites, sucursales, autorización y regresión HU-006.
- [x] Validar OpenSpec, pruebas, lint, builds y git diff --check; documentar resultados.

## Verificación del 26/11/2026

- OpenSpec: validación estricta del cambio.
- Backend: 793 pruebas, incluida la regresión de HU-006. Build de Nest en salida temporal por permisos del directorio dist local.
- Frontend: 432 pruebas y build Vite.
- Lint de ambos proyectos y git diff --check. Advertencias ajenas a HU-001 en lint y aviso de tamaño de bundle en Vite.
- Las pruebas de calendario usan fixtures y dobles de Prisma. No se ejecutaron suites E2E con base de datos ni migraciones.
