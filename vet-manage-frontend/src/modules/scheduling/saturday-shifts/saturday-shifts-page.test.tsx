import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import type { SessionProfile } from '../../auth/types';
import { schedulingApi } from '../services/scheduling-api';
import type { SaturdayShift, WorkSchedule } from '../types';
import {
  formatSaturdayLabel,
  getEligibleVeterinarians,
  getSaturdaysInRange,
} from './saturday-shifts-utils';
import { SaturdayShiftsPage } from './saturday-shifts-page';

vi.mock('../../../common/components/toast-context', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock('../services/scheduling-api', () => ({
  schedulingApi: {
    listBranches: vi.fn(),
    listWorkSchedules: vi.fn(),
    listSaturdayShifts: vi.fn(),
    generateSaturdayShifts: vi.fn(),
    substituteSaturdayShift: vi.fn(),
  },
}));

const schedules: WorkSchedule[] = [
  {
    id: 'ws-v2', veterinarioId: 'v2', veterinarioNombre: 'Valentina Ruiz',
    sucursalId: 'loja', sucursalNombre: 'Loja', diaSemana: 'SABADO',
    horaInicio: '08:00', horaFin: '12:00', estado: true,
    creadoEn: '', actualizadoEn: '',
  },
  {
    id: 'ws-v1', veterinarioId: 'v1', veterinarioNombre: 'Ana Torres',
    sucursalId: 'loja', sucursalNombre: 'Loja', diaSemana: 'SABADO',
    horaInicio: '08:00', horaFin: '12:00', estado: true,
    creadoEn: '', actualizadoEn: '',
  },
  {
    id: 'ws-v1-b', veterinarioId: 'v1', veterinarioNombre: 'Ana Torres',
    sucursalId: 'loja', sucursalNombre: 'Loja', diaSemana: 'SABADO',
    horaInicio: '09:00', horaFin: '13:00', estado: true,
    creadoEn: '', actualizadoEn: '',
  },
];

const shifts: SaturdayShift[] = [{
  id: 'turno-14', fecha: '2026-11-14T00:00:00.000Z',
  justificacion: null, sucursalId: 'loja', sucursalNombre: 'Loja',
  veterinarioId: 'v2', veterinarioNombre: 'Valentina Ruiz',
  horaInicio: '08:00', horaFin: '12:00',
}];

function renderPage(canReadWorkSchedules = true) {
  const user: SessionProfile['user'] = {
    id: 'admin', firstName: 'Admin', lastName: 'Prueba',
    email: 'admin@example.test', roles: [], permissions: [],
  };
  const permissions = canReadWorkSchedules
    ? ['saturday-shifts:read', 'saturday-shifts:manage', 'work-schedules:read']
    : ['saturday-shifts:read', 'saturday-shifts:manage'];
  const session = { mustChangePassword: false, user };
  const auth: AuthContextValue = {
    status: 'authenticated',
    session,
    login: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
    hasPermission: (permission) => permissions.includes(permission),
  };
  return render(<AuthContext.Provider value={auth}><SaturdayShiftsPage /></AuthContext.Provider>);
}

describe('SaturdayShiftsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-01T08:00:00'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      { id: 'loja', nombre: 'Loja', salas: [] },
    ]);
    vi.mocked(schedulingApi.listWorkSchedules).mockResolvedValue(schedules);
    vi.mocked(schedulingApi.listSaturdayShifts).mockResolvedValue(shifts);
    vi.mocked(schedulingApi.generateSaturdayShifts).mockResolvedValue([]);
    vi.mocked(schedulingApi.substituteSaturdayShift).mockResolvedValue(shifts[0]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates 07, 14 y 21 de noviembre y muestra la rotación en vista previa', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByRole('combobox', { name: /^sucursal/i }), 'loja');

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-21' } });

    expect(screen.getAllByText('sáb 07/11/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sáb 14/11/2026').length).toBeGreaterThan(0);
    expect(screen.getAllByText('sáb 21/11/2026').length).toBeGreaterThan(0);
    expect(screen.getByText(/Ana Torres \(08:00–12:00, 09:00–13:00\)/)).toBeInTheDocument();
    expect(screen.getByText(/Valentina Ruiz \(08:00–12:00\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Ana Torres/ }));
    await user.click(screen.getByRole('checkbox', { name: /Valentina Ruiz/ }));

    expect(screen.getByRole('button', { name: 'Subir a Ana Torres' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Bajar a Ana Torres' }));
    expect(screen.getAllByRole('cell', { name: /Valentina Ruiz/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Generar y guardar' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Generar y guardar' }));
    expect(schedulingApi.generateSaturdayShifts).toHaveBeenCalledWith({
      sucursalId: 'loja',
      fechas: ['2026-11-07', '2026-11-14', '2026-11-21'],
      veterinarioIds: ['v2', 'v1'],
    });
  });

  it('deduplica, ordena alfabéticamente y rechaza fechas pasadas', () => {
    expect(getSaturdaysInRange('2026-11-01', '2026-11-30'))
      .toEqual(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']);
    expect(formatSaturdayLabel('2026-11-07')).toBe('sáb 07/11/2026');
    expect(getEligibleVeterinarians(schedules, 'loja').map((vet) => vet.name))
      .toEqual(['Ana Torres', 'Valentina Ruiz']);
  });

  it('rechaza fechas pasadas y mantiene el botón deshabilitado', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByRole('combobox', { name: /^sucursal/i }), 'loja');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-03' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-31' } });
    expect(await screen.findByText('No se pueden generar turnos para fechas pasadas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar y guardar' })).toBeDisabled();
  });

  it('muestra el mensaje si la sucursal no tiene elegibles', async () => {
    vi.mocked(schedulingApi.listWorkSchedules).mockResolvedValue([]);
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByRole('combobox', { name: /^sucursal/i }), 'loja');
    expect(await screen.findByText('Esta sucursal no tiene veterinarios con jornada de sábado')).toBeInTheDocument();
  });

  it('sustituye desde un turno legible y excluye al veterinario asignado', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(await screen.findByRole('combobox', { name: /^Turno/i }), 'turno-14');
    const replacement = screen.getByRole('combobox', { name: /^Reemplazo/i });
    expect(within(replacement).queryByRole('option', { name: /Valentina Ruiz/ })).not.toBeInTheDocument();
    expect(within(replacement).getByRole('option', { name: /Ana Torres/ })).toBeInTheDocument();
    await user.selectOptions(replacement, 'v1');
    await user.type(screen.getByRole('textbox', { name: /^Justificación/i }), 'Permiso del veterinario asignado');
    await user.click(screen.getByRole('button', { name: 'Sustituir' }));
    expect(schedulingApi.substituteSaturdayShift).toHaveBeenCalledWith('turno-14', {
      veterinarioId: 'v1',
      justificacion: 'Permiso del veterinario asignado',
    });
  });

  it('muestra el permiso faltante al cargar horarios base', async () => {
    const user = userEvent.setup();
    renderPage(false);
    await user.selectOptions(await screen.findByRole('combobox', { name: /^sucursal/i }), 'loja');
    expect(await screen.findByText('No tiene permiso para consultar los horarios base de los veterinarios.')).toBeInTheDocument();
  });
});
