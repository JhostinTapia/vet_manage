import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../infrastructure/database/prisma/prisma.service.js';

type Db = Prisma.TransactionClient;

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(operation: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(operation, {
      isolationLevel: 'Serializable',
    });
  }

  listAppointments() {
    return this.prisma.cita.findMany({
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaHora: true,
        fechaHoraFin: true,
        paciente: {
          select: { name: true },
        },
        sala: {
          select: {
            nombre: true,
            sucursal: {
              select: { nombre: true },
            },
          },
        },
        veterinario: {
          select: {
            person: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        pagos: {
          where: { estado: 'APROBADO' },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { fechaHora: 'desc' },
    });
  }

  findForCancellation(id: string, db: Db) {
    return db.cita.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        fechaHora: true,
        pagos: {
          where: { estado: 'APROBADO' },
          select: { id: true },
          take: 1,
        },
      },
    });
  }

  async cancel(
    id: string,
    motivo: string,
    actorId: string,
    now: Date,
    db: Db,
  ) {
    const { count } = await db.cita.updateMany({
      where: {
        id,
        estado: 'PROGRAMADA',
        pagos: {
          none: { estado: 'APROBADO' },
        },
      },
      data: {
        estado: 'CANCELADA',
        tipoCancelacion: 'ORDINARIA',
      },
    });

    if (count !== 1) {
      return null;
    }

    await db.cambioEstadoCita.create({
      data: {
        citaId: id,
        estadoAnterior: 'PROGRAMADA',
        estadoNuevo: 'CANCELADA',
        motivo,
        realizadoPorId: actorId,
        fechaHora: now,
      },
    });

    await db.notificacionCita.create({
      data: {
        citaId: id,
        tipo: 'CANCELACION',
        estado: 'PENDIENTE',
        fechaProgramada: now,
      },
    });

    return {
      id,
      estado: 'CANCELADA' as const,
      motivo,
      canceladaPorId: actorId,
      fechaCancelacion: now.toISOString(),
    };
  }
}
