import { ListAppointmentsService } from '../services/list-appointments.service.js';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../../identity/types/authenticated-request.js';
import { CancelAppointmentDto } from '../dtos/cancel-appointment.dto.js';
import { CancelAppointmentService } from '../services/cancel-appointment.service.js';

@Controller('scheduling/appointments')
export class AppointmentsController {
  constructor(
    private readonly cancelService: CancelAppointmentService,
    private readonly listService: ListAppointmentsService,
  ) {}

  @Get()
  @RequirePermissions('appointments:read')
  async list() {
    return success(
      await this.listService.execute(),
      'Citas consultadas correctamente',
    );
  }

  @Patch(':id/cancel')
  @RequirePermissions('appointments:cancel')
  async cancel(
    @Param('id') id: string,
    @Body() input: CancelAppointmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) {
      throw ApiException.unauthorized();
    }

    const appointment = await this.cancelService.execute(
      id,
      input.motivo,
      request.user.id,
    );

    return success(
      appointment,
      'Cita cancelada correctamente',
    );
  }
}
