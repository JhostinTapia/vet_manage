
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../infrastructure/database/prisma/prisma.module.js';
import { IdentityModule } from '../../identity/identity.module.js';
import { BranchesModule } from '../branches/branches.module.js';
import { AppointmentsRepository } from '../appointments/repositories/appointments.repository.js';
import { AppointmentsController } from '../appointments/routes/appointments.controller.js';
import { RegisterAppointmentService } from '../appointments/services/register-appointment.service.js';
import { ResourcesController } from './routes/resources.controller.js';
import { ResourcesRepository } from './repositories/resources.repository.js';
import { ResourcesService } from './services/resources.service.js';

@Module({
  imports: [PrismaModule, IdentityModule, BranchesModule],
  controllers: [ResourcesController, AppointmentsController],
  providers: [ResourcesService, ResourcesRepository, AppointmentsRepository, RegisterAppointmentService],
})
export class ResourcesModule {}
