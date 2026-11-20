export type RoomType = 'CONSULTORIO' | 'QUIROFANO';

export type Room = {
  id: string;
  nombre: string;
  tipo: RoomType;
};

export type Branch = {
  id: string;
  nombre: string;
  salas: Room[];
};

export type ClinicService = {
  id: string;
  nombre: string;
  duracionMaximaMin: number;
};

export type DiaSemana = 'LUNES' | 'MARTES' | 'MIERCOLES' | 'JUEVES' | 'VIERNES' | 'SABADO';

export type WorkSchedule = {
  id: string;
  veterinarioId: string;
  veterinarioNombre: string;
  sucursalId: string;
  sucursalNombre: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  estado: boolean;
  creadoEn: string;
  actualizadoEn: string;
};

export type WorkScheduleFormData = {
  veterinarioId: string;
  sucursalId: string;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
};

export type VeterinarianOption = {
  id: string;
  person: {
    firstName: string;
    lastName: string;
  };
};
