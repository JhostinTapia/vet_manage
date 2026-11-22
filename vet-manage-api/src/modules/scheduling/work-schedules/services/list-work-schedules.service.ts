import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { toWorkScheduleResponse } from '../dtos/work-schedule-response.dto.js';
import type { QueryWorkSchedulesDto } from '../dtos/query-work-schedules.dto.js';
import { dbTimeToMinutes, formatTime, SLOT_MINUTES } from '../../common/time-slots.js';

@Injectable()
export class ListWorkSchedulesService {
  constructor(private readonly repo: WorkScheduleRepository) {}

  async list(query: QueryWorkSchedulesDto) {
    const records = await this.repo.findActive({
      veterinarioId: query.veterinarioId,
      sucursalId: query.sucursalId,
    });
    return records.map(toWorkScheduleResponse);
  }

  listVeterinarians() {
    return this.repo.findActiveVeterinarians();
  }

  async slots(id: string, fecha: string) {
    const schedule = await this.repo.findById(id);
    if (!schedule) throw new NotFoundException('Horario no encontrado');
    const date = new Date(`${fecha}T00:00:00Z`);
    const days = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    if (days[date.getUTCDay()] !== schedule.diaSemana) return { fecha, usaJornadaCompleta: false, turnos: [] };
    const daily = await this.repo.findDailyAvailability(id, date);
    const ranges = daily.length ? daily : [schedule];
    const start = dbTimeToMinutes(schedule.horaInicio);
    const end = dbTimeToMinutes(schedule.horaFin);
    const turnos: { inicio: string; fin: string }[] = [];
    for (let minute = start; minute + SLOT_MINUTES <= end; minute += SLOT_MINUTES) {
      if (ranges.some(range => minute >= dbTimeToMinutes(range.horaInicio)
        && minute + SLOT_MINUTES <= dbTimeToMinutes(range.horaFin))) {
        turnos.push({ inicio: formatTime(minute), fin: formatTime(minute + SLOT_MINUTES) });
      }
    }
    return { fecha, usaJornadaCompleta: daily.length === 0, turnos };
  }
}
