import { Body, Controller, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import { ApiException } from '../../../../common/errors/api-exception.js';
import { success } from '../../../../common/errors/api-response.js';
import { RequirePermissions } from '../../../identity/decorators/require-permissions.decorator.js';
import type { AuthenticatedRequest } from '../../../identity/types/authenticated-request.js';
import { RegisterScheduleBlockDto } from '../dtos/register-schedule-block.dto.js';
import { ListScheduleBlocksService } from '../services/list-schedule-blocks.service.js';
import { RegisterScheduleBlockService } from '../services/register-schedule-block.service.js';

@Controller('scheduling/schedule-blocks')
export class ScheduleBlocksController {
  constructor(
    private readonly registerService: RegisterScheduleBlockService,
    private readonly listService: ListScheduleBlocksService,
  ) {}

  // Bloqueos vigentes; filtros opcionales: sucursalId, desde y hasta (AAAA-MM-DD).
  @Get()
  @RequirePermissions('schedule-blocks:read')
  async list(
    @Query('sucursalId') sucursalId?: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return success(await this.listService.listBlocks({ sucursalId, desde, hasta }), 'Bloqueos vigentes');
  }

  // Veterinarios activos que se pueden seleccionar en un bloqueo.
  @Get('veterinarians')
  @RequirePermissions('schedule-blocks:read')
  async veterinarians() {
    return success(await this.listService.listVeterinarians(), 'Veterinarios activos');
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('schedule-blocks:create')
  async register(@Body() input: RegisterScheduleBlockDto, @Req() request: AuthenticatedRequest) {
    if (!request.user) throw ApiException.unauthorized();
    const block = await this.registerService.execute(input, request.user.id);
    return success(block, 'Bloqueo registrado correctamente', 201);
  }
}
