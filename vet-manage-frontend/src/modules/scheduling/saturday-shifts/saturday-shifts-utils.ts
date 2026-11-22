import type { SaturdayShift, WorkSchedule } from '../types';

export type SaturdayEligible = {
  id: string;
  name: string;
  jornadas: string[];
};

export const JUSTIFICACION_MAX = 500;

export function formatSaturdayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `sáb ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
}

export function getSaturdaysInRange(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  const cursor = new Date(fromYear, fromMonth - 1, fromDay);
  const end = new Date(toYear, toMonth - 1, toDay);
  const dates: string[] = [];
  while (cursor <= end) {
    if (cursor.getDay() === 6) {
      const year = cursor.getFullYear();
      const month = String(cursor.getMonth() + 1).padStart(2, '0');
      const day = String(cursor.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function getEligibleVeterinarians(schedules: WorkSchedule[], sucursalId: string): SaturdayEligible[] {
  const map = new Map<string, SaturdayEligible>();
  for (const schedule of schedules) {
    if (schedule.sucursalId !== sucursalId || schedule.diaSemana !== 'SABADO' || !schedule.estado) continue;
    const jornada = `${schedule.horaInicio}–${schedule.horaFin}`;
    const existing = map.get(schedule.veterinarioId);
    if (existing) {
      if (!existing.jornadas.includes(jornada)) existing.jornadas.push(jornada);
    } else {
      map.set(schedule.veterinarioId, {
        id: schedule.veterinarioId,
        name: schedule.veterinarioNombre,
        jornadas: [jornada],
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function dbTimeToClock(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : '';
}

export function normalizeSaturdayShift(raw: unknown): SaturdayShift | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as {
    id?: unknown;
    fecha?: unknown;
    justificacion?: unknown;
    sucursalId?: unknown;
    sucursalNombre?: unknown;
    veterinarioId?: unknown;
    veterinarioNombre?: unknown;
    horaInicio?: unknown;
    horaFin?: unknown;
    sucursal?: { id?: unknown; nombre?: unknown };
    horarioBase?: {
      veterinarioId?: unknown;
      horaInicio?: unknown;
      horaFin?: unknown;
      veterinario?: { person?: { firstName?: unknown; lastName?: unknown } };
    };
  };
  const id = typeof record.id === 'string' ? record.id : '';
  if (!id) return null;
  const sucursal = record.sucursal;
  const horarioBase = record.horarioBase;
  const person = horarioBase?.veterinario?.person;
  return {
    id,
    fecha: typeof record.fecha === 'string' ? record.fecha : '',
    justificacion: typeof record.justificacion === 'string' ? record.justificacion : null,
    sucursalId: typeof record.sucursalId === 'string'
      ? record.sucursalId
      : typeof sucursal?.id === 'string' ? sucursal.id : '',
    sucursalNombre: typeof record.sucursalNombre === 'string'
      ? record.sucursalNombre
      : typeof sucursal?.nombre === 'string' ? sucursal.nombre : '',
    veterinarioId: typeof record.veterinarioId === 'string'
      ? record.veterinarioId
      : typeof horarioBase?.veterinarioId === 'string' ? horarioBase.veterinarioId : '',
    veterinarioNombre: typeof record.veterinarioNombre === 'string'
      ? record.veterinarioNombre
      : [person?.firstName, person?.lastName].filter((value): value is string => typeof value === 'string').join(' ').trim(),
    horaInicio: typeof record.horaInicio === 'string'
      ? record.horaInicio
      : dbTimeToClock(horarioBase?.horaInicio),
    horaFin: typeof record.horaFin === 'string'
      ? record.horaFin
      : dbTimeToClock(horarioBase?.horaFin),
  };
}
