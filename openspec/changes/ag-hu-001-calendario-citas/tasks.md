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

## Revisión e integración del 27/11/2026

- Integrada `origin/development` (228e14c) conservando CalendarModule/CalendarPage y AppointmentsModule/AppointmentsPage en los dos archivos en conflicto.
- Corregido el desfase de cinco horas: consultas y ocupación usan el contrato de persistencia compartido con HU-003/HU-004. Las respuestas del calendario normalizan a instantes ISO reales para mostrarlos en America/Guayaquil.
- Regresión para 00:00, 10:00 y 23:00 del 31 de diciembre; detalle, franja y cita deben coincidir. Se excluyen jornadas con rol de veterinario vencido.
- Backend: 1.013 pruebas aprobadas (103 archivos), incluidas HU-003/HU-004/HU-005/HU-006 y 31 de calendario. Las pruebas HTTP requieren ejecución fuera del sandbox para abrir el puerto local.
- Frontend: 560 pruebas aprobadas (61 archivos). Calendario comprobado además con TZ=Pacific/Auckland y TZ=America/Los_Angeles; backend de calendario también con TZ=Pacific/Auckland.
- Compilación TypeScript de API a `/tmp/hu001-api-build` tras regenerar Prisma con el esquema actualizado; build Vite aprobado. Lint de ambos proyectos aprobado con advertencias preexistentes ajenas al cambio. Vite advierte del tamaño del bundle.
- Sin migraciones nuevas ni cambios de datos. No se ejecutaron suites E2E con PostgreSQL; las pruebas usan dobles de persistencia. Se conserva la selección informativa de franja y se actualiza el mensaje porque la sección Citas ya permite registrar.
