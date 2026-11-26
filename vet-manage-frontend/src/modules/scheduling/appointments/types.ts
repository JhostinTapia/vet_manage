export type AppointmentDraft = {
  sucursalId: string;
  clienteId: string;
  pacienteId: string;
  servicioId: string;
  veterinarioId: string;
  salaId: string;
  fecha: string;
  horaInicio: string;
  duracionMin: number;
};

export type RegisteredAppointment = {
  id: string;
  numero: number;
  fechaHora: string;
  fechaHoraFin: string;
  estado: 'PROGRAMADA' | string;
  importeReserva: number | string;
};
