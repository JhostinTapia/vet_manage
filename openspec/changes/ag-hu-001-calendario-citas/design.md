# Diseño HU-001

## Lectura y fechas
GET `/api/v1/scheduling/calendar?sucursalId=UUID&fecha=YYYY-MM-DD&vista=dia|semana|mes` devuelve período [inicio, fin exclusivo), citas y franjas. Semana lunes–domingo; mes completo. Los instantes de citas se interpretan en America/Guayaquil (UTC-05); fechas SQL DATE y horas TIME conservan sus componentes UTC. No se llama al servicio HU-006 ni se elimina su validación de fechas pasadas. Intersección estricta: inicio cita < fin período y fin cita > inicio período.

GET `/scheduling/calendar/branches` lista sucursales, incluidas inactivas para lectura histórica. GET `/scheduling/calendar/appointments/:id?sucursalId=UUID` entrega detalle acotado a sucursal; 404 si no coincide. Todos exigen calendar:read y sesión mediante las guardas de identidad del controlador. El listado no incluye cédula; detalle obtiene Patient.client.person.identification y sala.sucursal. Solo recepcionista y el superadmin existente reciben permiso por defecto.

## Franjas
Snapshot consistente de solo lectura por período. Jornada activa y veterinario activo con rol vigente; disponibilidad diaria restringe la jornada si existe; sábado requiere turno; domingo fuera de atención. Se requiere un consultorio activo libre y un veterinario libre durante los 30 minutos. Citas de otras sucursales ocupan al mismo veterinario. Todos los estados excepto CANCELADA ocupan recursos, siguiendo la implementación actual de HU-006, sin resolver ni alterar la discrepancia de reglas de otras historias.

Estados agregados: Disponible si queda una pareja; Bloqueado si un bloqueo general se cruza o todos los veterinarios de jornada están bloqueados; Fuera de atención si no hay jornada efectiva; Ocupado si citas impiden la pareja; Sin recursos si faltan consultorios activos. Los bloqueos individuales no cierran toda la sucursal si queda otro veterinario. Se aplica primero bloqueo general, después jornada, bloqueo total y recursos/ocupación. El filtro de citas es exclusivamente de presentación y nunca entra al cálculo.

La lectura histórica usa configuración actualmente almacenada: el esquema no versiona horarios, estados de recursos ni bloqueos eliminados. No se promete reconstruir configuración histórica borrada.

## Interfaz e integración
Día y semana muestran citas por día; mes usa cuadrícula lunes–domingo. Cada día permite desplegar sus 48 franjas. Detalle con diálogo nativo y foco de retorno. Colores con nombres legibles. Solo Disponible habilita seleccionar la franja; un aviso explica que el flujo de reserva está pendiente y que no se creó cita. Contrato de integración: sucursalId, inicio, fin; futura HU debe revalidar disponibilidad y autorización antes de reservar.

## Operación
Sin variables ni puertos nuevos: API 3080, frontend 5174, PostgreSQL Docker por nombre de servicio. Comandos existentes npm test, npm run lint, npm run build en ambos proyectos. Sin migración ni seed. El arranque normal sincroniza el catálogo RBAC. En modo create-only, si calendar:read ya existe pero falta una asignación, se debe conceder mediante la gestión habitual de permisos.

Los fixtures del calendario usan instantes UTC reales (10:00 en Loja equivale a 15:00Z). HU-006 y otras lecturas existentes construyen o comparan horas usando UTC como hora de pared. Se conserva ese comportamiento. Los datos de demostración con esa convención pueden mostrar una hora distinta en calendario y la futura HU de reserva debe acordar el contrato temporal antes de escribir citas.
