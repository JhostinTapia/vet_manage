import { BadRequestException, Injectable } from '@nestjs/common';
import { WorkScheduleRepository } from '../repositories/work-schedule.repository.js';
import { toWorkScheduleResponse } from '../dtos/work-schedule-response.dto.js';
import type { CreateWorkScheduleDto } from '../dtos/create-work-schedule.dto.js';
import { parseTime, isOnSlot, minutesToDbTime } from '../../common/time-slots.js';

@Injectable()
export class CreateWorkScheduleService {
  constructor(private readonly repo: WorkScheduleRepository) {}

  async create(dto: CreateWorkScheduleDto) {
    const startMin = parseTime(dto.horaInicio);
    if (startMin === null) {
      throw new BadRequestException('La hora de inicio no tiene un formato válido (HH:mm)');
    }
    if (!isOnSlot(startMin)) {
      throw new BadRequestException('La hora de inicio debe ser en punto o y media');
    }

    const endMin = parseTime(dto.horaFin);
    if (endMin === null) {
      throw new BadRequestException('La hora de fin no tiene un formato válido (HH:mm)');
    }
    if (!isOnSlot(endMin)) {
      throw new BadRequestException('La hora de fin debe ser en punto o y media');
    }

    if (endMin <= startMin) {
      throw new BadRequestException('La hora de fin debe ser posterior a la hora de inicio');
    }

    const overlapping = await this.repo.findOverlapping(
      dto.veterinarioId,
      dto.diaSemana,
      startMin,
      endMin,
    );
    if (overlapping.length > 0) {
      throw new BadRequestException(
        'El horario se cruza con otro horario existente del mismo veterinario',
      );
    }

    const record = await this.repo.create({
      veterinarioId: dto.veterinarioId,
      sucursalId: dto.sucursalId,
      diaSemana: dto.diaSemana,
      horaInicio: minutesToDbTime(startMin),
      horaFin: minutesToDbTime(endMin),
    });

    return toWorkScheduleResponse(record);
  }
}
