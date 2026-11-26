import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';
import { minutesToDbTime, parseTime } from '../../common/time-slots.js';
import { APPOINTMENT_MESSAGES } from '../appointment-messages.js';
import type { RegisterAppointmentDto } from '../dtos/register-appointment.dto.js';

export { APPOINTMENT_MESSAGES } from '../appointment-messages.js';

const activeVeterinarian = (now: Date): Prisma.UserWhereInput => ({
  status: 'ACTIVE',
  userRoles: {
    some: {
      role: { name: 'veterinarian', isActive: true },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
  },
});

function parseAppointmentStart(dto: RegisterAppointmentDto): {
  start: Date;
  date: Date;
  startMinutes: number;
} {
  const date = new Date(`${dto.fecha}T00:00:00.000Z`);
  const dateIsValid =
    /^\d{4}-\d{2}-\d{2}$/.test(dto.fecha) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === dto.fecha;
  const startMinutes = parseTime(dto.horaInicio);

  if (!dateIsValid || startMinutes === null) {
    throw ApiException.badRequest('La fecha y hora no son válidas');
  }

  // El calendario de la agenda usa la hora local de Ecuador continental.
  const start = new Date(`${dto.fecha}T${dto.horaInicio}:00-05:00`);
  if (Number.isNaN(start.getTime())) {
    throw ApiException.badRequest('La fecha y hora no son válidas');
  }

  return { start, date, startMinutes };
}

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterAppointmentDto, registradaPorId: string) {
    if (!Number.isInteger(dto.duracionMin) || dto.duracionMin < 30) {
      throw ApiException.badRequest(APPOINTMENT_MESSAGES.invalidDuration);
    }

    const { start, date, startMinutes } = parseAppointmentStart(dto);

    return this.prisma.$transaction(async (tx) => {
      const lockKeys = [
        `appointment:room:${dto.salaId}`,
        `appointment:veterinarian:${dto.veterinarioId}`,
      ].sort();

      for (const key of lockKeys) {
        await tx.$queryRaw`SELECT 1 WHERE pg_advisory_xact_lock(hashtextextended(${key}, 0)) IS NULL`;
      }

      if (start.getTime() <= Date.now()) {
        throw ApiException.badRequest(APPOINTMENT_MESSAGES.mustBeFuture);
      }

      const patient = await tx.patient.findUnique({
        where: { id: dto.pacienteId },
        select: { id: true, clientId: true, status: true },
      });
      if (!patient || patient.clientId !== dto.clienteId) {
        throw ApiException.badRequest(APPOINTMENT_MESSAGES.patientDoesNotBelong);
      }
      if (patient.status !== 'ACTIVE') {
        throw ApiException.badRequest('El paciente no está activo');
      }

      const client = await tx.client.findFirst({
        where: { id: dto.clienteId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!client) throw ApiException.badRequest('El cliente no está activo');

      const [branch, room, service, veterinarian] = await Promise.all([
        tx.sucursal.findFirst({
          where: { id: dto.sucursalId, estado: true },
          select: { id: true },
        }),
        tx.sala.findFirst({
          where: {
            id: dto.salaId,
            sucursalId: dto.sucursalId,
            tipo: 'CONSULTORIO',
            estado: true,
          },
          select: { id: true },
        }),
        tx.servicio.findFirst({
          where: { id: dto.servicioId, estado: true },
          select: { id: true, duracionMaximaMin: true },
        }),
        tx.user.findFirst({
          where: { id: dto.veterinarioId, ...activeVeterinarian(new Date()) },
          select: { id: true },
        }),
      ]);

      if (!branch) throw ApiException.badRequest('La sucursal no está activa');
      if (!room) throw ApiException.badRequest('El consultorio no está disponible');
      if (!service) throw ApiException.badRequest('El servicio no está activo');
      if (!veterinarian) throw ApiException.badRequest('El veterinario no está activo');
      if (
        dto.duracionMin < 30 ||
        dto.duracionMin > service.duracionMaximaMin
      ) {
        throw ApiException.badRequest(APPOINTMENT_MESSAGES.invalidDuration);
      }

      const tariff = await tx.tarifa.findFirst({
        where: {
          servicioId: dto.servicioId,
          sucursalId: dto.sucursalId,
          estado: true,
        },
        select: { importe: true },
      });
      if (!tariff) {
        throw ApiException.badRequest('El servicio no tiene una tarifa activa');
      }

      const endMinutes = startMinutes + dto.duracionMin;
      if (endMinutes >= 1440) {
        throw ApiException.badRequest('La cita no puede extenderse al día siguiente');
      }

      const end = new Date(start.getTime() + dto.duracionMin * 60_000);
      const block = await tx.bloqueoHorario.findFirst({
        where: {
          sucursalId: dto.sucursalId,
          fecha: date,
          fechaEliminacion: null,
          horaInicio: { lt: minutesToDbTime(endMinutes) },
          horaFin: { gt: minutesToDbTime(startMinutes) },
          OR: [{ veterinarioId: null }, { veterinarioId: dto.veterinarioId }],
        },
        select: { id: true },
      });
      if (block) {
        throw ApiException.conflict(APPOINTMENT_MESSAGES.blocked);
      }

      const conflicts = await tx.cita.findMany({
        where: {
          estado: { not: 'CANCELADA' },
          fechaHora: { lt: end },
          fechaHoraFin: { gt: start },
          OR: [{ veterinarioId: dto.veterinarioId }, { salaId: dto.salaId }],
        },
        select: { veterinarioId: true, salaId: true },
      });

      if (conflicts.some((appointment) => appointment.veterinarioId === dto.veterinarioId)) {
        throw ApiException.conflict(APPOINTMENT_MESSAGES.veterinarianUnavailable);
      }
      if (conflicts.some((appointment) => appointment.salaId === dto.salaId)) {
        throw ApiException.conflict(APPOINTMENT_MESSAGES.roomUnavailable);
      }

      return tx.cita.create({
        data: {
          estado: 'PROGRAMADA',
          fechaHora: start,
          fechaHoraFin: end,
          importeReserva: tariff.importe,
          pacienteId: dto.pacienteId,
          salaId: dto.salaId,
          servicioId: dto.servicioId,
          veterinarioId: dto.veterinarioId,
          registradaPorId,
        },
        select: {
          id: true,
          numero: true,
          fechaHora: true,
          fechaHoraFin: true,
          estado: true,
          importeReserva: true,
        },
      });
    });
  }
}
