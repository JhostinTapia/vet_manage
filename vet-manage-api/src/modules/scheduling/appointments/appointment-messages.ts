export const APPOINTMENT_MESSAGES = {
  patientDoesNotBelong: 'El paciente no pertenece al cliente',
  mustBeFuture: 'La fecha y hora deben ser posteriores al momento actual',
  invalidDuration:
    'La duración debe ser de al menos 30 minutos y no superar el máximo permitido para el servicio',
  blocked: 'Horario bloqueado',
  veterinarianUnavailable: 'Veterinario no disponible',
  roomUnavailable: 'Consultorio no disponible',
} as const;
