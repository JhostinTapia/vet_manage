import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../../identity/types/authenticated-request.js';
import { RegisterAppointmentDto } from '../dtos/register-appointment.dto.js';
import { RegisterAppointmentService } from '../services/register-appointment.service.js';

@Controller('scheduling/appointments')
export class AppointmentsController {
  constructor(private readonly registerAppointment: RegisterAppointmentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('resources:read-availability')
  async register(
    @Body() dto: RegisterAppointmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.user) throw ApiException.unauthorized();
    const appointment = await this.registerAppointment.register(dto, request.user.id);
    return success(appointment, 'Cita registrada', HttpStatus.CREATED);
  }
}
