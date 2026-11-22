import { afterEach, describe, expect, it, vi } from 'vitest';
import { schedulingApi } from './scheduling-api';

afterEach(() => vi.unstubAllGlobals());

describe('Contrato de turnos de sábado', () => {
  it('convierte las relaciones y fechas ISO del GET sin cambiar el día ni las horas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, statusCode: 200, message: 'Turnos de sábado', data: [{
        id: 'turno-1', sucursalId: 'loja', horarioBaseId: 'base-1',
        fecha: '2026-11-28T00:00:00.000Z', justificacion: 'Reemplazo por capacitación',
        sucursal: { id: 'loja', nombre: 'Loja' },
        horarioBase: {
          veterinarioId: 'vet-1', horaInicio: '1970-01-01T09:30:00.000Z', horaFin: '1970-01-01T13:45:00.000Z',
          veterinario: { person: { firstName: 'Ana', lastName: 'Ruiz' } },
        },
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    expect(await schedulingApi.listSaturdayShifts({ sucursalId: 'loja' })).toEqual([{
      id: 'turno-1', fecha: '2026-11-28', justificacion: 'Reemplazo por capacitación',
      sucursalId: 'loja', sucursalNombre: 'Loja', veterinarioId: 'vet-1', veterinarioNombre: 'Ana Ruiz',
      horaInicio: '09:30', horaFin: '13:45',
    }]);
    expect(fetchMock.mock.calls[0][0]).toContain('/scheduling/saturday-shifts?sucursalId=loja');
  });
});
