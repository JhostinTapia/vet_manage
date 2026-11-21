import type { WorkSchedule } from '../types';

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
