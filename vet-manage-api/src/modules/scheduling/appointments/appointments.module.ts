import { ListAppointmentsService } from './services/list-appointments.service.js';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { BranchesModule } from '../branches/branches.module.js';
import { AppointmentsRepository } from './repositories/appointments.repository.js';
import { AppointmentsController } from './routes/appointments.controller.js';
import { CancelAppointmentService } from './services/cancel-appointment.service.js';
import { RegisterAppointmentService } from './services/register-appointment.service.js';

@Module({
  imports: [PrismaModule, IdentityModule, BranchesModule],
  controllers: [AppointmentsController],
  providers: [
    AppointmentsRepository,
    CancelAppointmentService,
    ListAppointmentsService,
    RegisterAppointmentService,
  ],
})
export class AppointmentsModule {}
