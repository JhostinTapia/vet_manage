## ADDED Requirements

### Requirement: Consulta y detalle por sucursal
El sistema MUST permitir a recepcionista leer citas y detalle solo de la sucursal solicitada con permiso calendar:read.

#### Scenario: CP-001-01 Cita confirmada en Loja
- **GIVEN** cita CONFIRMADA del 02/11/2026 10:00–10:30 de Ecuador en Loja
- **WHEN** consulta el calendario y abre el detalle
- **THEN** ve número, horas, paciente, veterinario y estado azul con etiqueta Confirmada
- **AND** detalle añade cliente, cédula, consultorio y sucursal

#### Scenario: Autorización y aislamiento
- **WHEN** consulta sin sesión o sin permiso
- **THEN** recibe 401 o 403 respectivamente
- **AND** un detalle solicitado con otra sucursal responde 404

### Requirement: Períodos locales e históricos
El sistema MUST soportar día, semana lunes–domingo y mes completo en America/Guayaquil, sin rechazar fechas pasadas, incluyendo citas que intersectan el período.

#### Scenario: CP-001-02 Navegación semanal y mensual
- **GIVEN** fecha seleccionada 02/11/2026
- **WHEN** cambia a semana y avanza
- **THEN** los períodos son 02–08 y 09–15 de noviembre
- **AND** la vista mensual cubre 01–30 de noviembre, con cambios correctos de mes y año

#### Scenario: Intersecciones y lista vacía
- **WHEN** una cita inicia antes del período y termina dentro
- **THEN** aparece sin alterar sus horas reales
- **AND** sin citas se muestra un mensaje vacío y se conservan las franjas

### Requirement: Disponibilidad independiente y reserva pendiente
El sistema MUST calcular franjas sin filtro de estado considerando jornadas, disponibilidades, sábados, bloqueos, recursos y ocupación entre sucursales. MUST habilitar selección solo en Disponible sin persistir reservas.

#### Scenario: CP-001-03 Causas de franja
- **GIVEN** jornada 08:00–12:00, 09:00 libre y bloqueo 11:00–11:30
- **WHEN** consulta las franjas
- **THEN** 09:00 es Disponible, 11:00 Bloqueado y 13:00 Fuera de atención
- **AND** seleccionar Disponible informa integración de reserva pendiente sin escribir citas

### Requirement: Filtro y accesibilidad
El sistema MUST mostrar nombre legible junto al color: Programada gris, Confirmada azul, En curso naranja, Finalizada verde, Cancelada rojo y No asistió morado.

#### Scenario: CP-001-04 Filtrar confirmadas
- **GIVEN** citas confirmadas y canceladas
- **WHEN** filtra CONFIRMADA
- **THEN** solo las confirmadas son visibles
- **AND** los datos persistidos, bloqueos y disponibilidad permanecen iguales
