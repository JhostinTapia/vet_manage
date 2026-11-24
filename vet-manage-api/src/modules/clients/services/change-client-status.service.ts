import { Injectable } from '@nestjs/common';
import { ApiException } from '../../../common/errors/api-exception.js';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service.js';
import { AUDIT_ACTIONS, AUDIT_MODULES, type AuditAction } from '../../audit/audit.catalog.js';
import { describePerson } from '../../audit/describe-person.js';
import { AuditService } from '../../audit/services/audit.service.js';

export const CLIENT_STATUS_MESSAGES = {
  notFound: 'Cliente no encontrado',
  deactivated: 'No se puede inactivar un cliente dado de baja',
  inactivated: 'Cliente inactivado correctamente',
  activateDeactivated: 'No se puede activar un cliente dado de baja',
  activated: 'Cliente activado correctamente',
} as const;

type ReversibleStatus = 'ACTIVE' | 'INACTIVE';

type ClientStatusResult<S extends ReversibleStatus> = {
  message: string;
  client: {
    id: string;
    status: S;
  };
};

export type InactivatedClientResult = ClientStatusResult<'INACTIVE'>;
export type ActivatedClientResult = ClientStatusResult<'ACTIVE'>;

const STATUS_LABELS: Record<ReversibleStatus, string> = { ACTIVE: 'Activo', INACTIVE: 'Inactivo' };

type Transition<S extends ReversibleStatus> = {
  target: S;
  from: ReversibleStatus;
  action: AuditAction;
  deactivatedMessage: string;
  successMessage: string;
};

const INACTIVATE: Transition<'INACTIVE'> = {
  target: 'INACTIVE',
  from: 'ACTIVE',
  action: AUDIT_ACTIONS.inactivate,
  deactivatedMessage: CLIENT_STATUS_MESSAGES.deactivated,
  successMessage: CLIENT_STATUS_MESSAGES.inactivated,
};

const ACTIVATE: Transition<'ACTIVE'> = {
  target: 'ACTIVE',
  from: 'INACTIVE',
  action: AUDIT_ACTIONS.activate,
  deactivatedMessage: CLIENT_STATUS_MESSAGES.activateDeactivated,
  successMessage: CLIENT_STATUS_MESSAGES.activated,
};

// Cambios de estado reversibles del cliente: inactivar (HU-04) y activar (HU-05). Dar de baja (HU-03) irá aparte.
@Injectable()
export class ChangeClientStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  inactivate(clientId: string, actorId: string): Promise<InactivatedClientResult> {
    return this.change(clientId, actorId, INACTIVATE);
  }

  activate(clientId: string, actorId: string): Promise<ActivatedClientResult> {
    return this.change(clientId, actorId, ACTIVATE);
  }

  private async change<S extends ReversibleStatus>(
    clientId: string,
    actorId: string,
    transition: Transition<S>,
  ): Promise<ClientStatusResult<S>> {
    await this.prisma.$transaction(async (tx) => {
      const client = await tx.client.findUnique({
        where: { id: clientId },
        select: {
          id: true,
          status: true,
          person: { select: { identification: true, firstName: true, lastName: true } },
        },
      });

      if (!client) throw ApiException.notFound(CLIENT_STATUS_MESSAGES.notFound);
      // Un cliente dado de baja no vuelve a la gestión operativa (riesgo R-05).
      if (client.status === 'DEACTIVATED') {
        throw new ApiException(transition.deactivatedMessage, 400, [], 'CLIENT_STATUS_DEACTIVATED');
      }
      // Ya está en el estado pedido: no se escribe ni se audita de nuevo.
      if (client.status === transition.target) return;

      await tx.client.update({
        where: { id: clientId },
        data: { status: transition.target },
      });

      await this.audit.record(tx, {
        actorId,
        action: transition.action,
        module: AUDIT_MODULES.clients,
        affectedRecord: describePerson(client.person),
        previousValue: { status: STATUS_LABELS[transition.from] },
        newValue: { status: STATUS_LABELS[transition.target] },
      });
    });

    return {
      message: transition.successMessage,
      client: { id: clientId, status: transition.target },
    };
  }
}
