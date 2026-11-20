import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../infrastructure/api/http-client';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { schedulingApi } from '../services/scheduling-api';
import { ratesApi } from './rates-api';
import {
  FORBIDDEN_RATE_MESSAGE,
  INVALID_RATE_MESSAGE,
  REQUIRED_RATE_MESSAGE,
  RatesPage,
} from './rates-page';

vi.mock('../services/scheduling-api', () => ({
  schedulingApi: {
    listBranches: vi.fn(),
    listServices: vi.fn(),
  },
}));

vi.mock('./rates-api', () => ({
  ratesApi: {
    list: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    deactivateService: vi.fn(),
  },
}));

function makeRate(id: string, amount: number, active = true) {
  return {
    id,
    servicioId: 'service-consulta',
    sucursalId: 'branch-loja',
    importe: amount,
    fechaVigencia: '2026-11-20T00:00:00.000Z',
    estado: active,
    servicio: { id: 'service-consulta', nombre: 'Consulta general', estado: true },
    sucursal: { id: 'branch-loja', nombre: 'Loja', estado: true },
  };
}

function renderPage(
  canRead = true,
  canManage = true,
  user = {
    id: 'staff',
    firstName: 'Ana',
    lastName: 'Admin',
    email: 'admin@example.test',
    roles: [],
    permissions: [],
  },
) {
  const permissions = canManage
    ? ['rates:read', 'rates:manage']
    : canRead
      ? ['rates:read']
      : [];
  const session = { mustChangePassword: false, user };
  const auth: AuthContextValue = {
    status: 'authenticated',
    session,
    login: vi.fn(async () => session),
    logout: vi.fn(async () => undefined),
    hasPermission: (permission) => permissions.includes(permission),
  };
  return render(<AuthContext.Provider value={auth}><RatesPage /></AuthContext.Provider>);
}

describe('RatesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      { id: 'branch-loja', nombre: 'Loja', salas: [] },
    ]);
    vi.mocked(schedulingApi.listServices).mockResolvedValue([
      { id: 'service-consulta', nombre: 'Consulta general', duracionMaximaMin: 30 },
    ]);
    vi.mocked(ratesApi.list).mockResolvedValue([]);
  });

  it('CP-025-04 muestra el mensaje exacto para tarifa cero', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Tarifa'), '0');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-05 muestra el mensaje exacto para tarifa negativa', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Tarifa'), '-5');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-06 muestra el mensaje exacto para texto', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Tarifa'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-07 muestra el mensaje exacto para tres decimales', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('Tarifa'), '20,005');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_RATE_MESSAGE);
  });

  it('CP-025-08 muestra el mensaje exacto para tarifa vacía', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(REQUIRED_RATE_MESSAGE);
  });

  it('CP-025-01 registra y muestra la tarifa vigente de USD 20.00', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.save).mockResolvedValue(makeRate('rate-20', 20));
    renderPage();

    await user.type(await screen.findByLabelText('Tarifa'), '20.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(ratesApi.save).toHaveBeenCalledWith({
      servicioId: 'service-consulta',
      sucursalId: 'branch-loja',
      importe: 20,
    });
    expect(await screen.findByText('USD 20.00 · Activa')).toBeInTheDocument();
  });

  it('CP-025-02 muestra ambas tarifas sin cambiar el importe histórico', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.list).mockResolvedValue([makeRate('rate-20', 20)]);
    vi.mocked(ratesApi.update).mockResolvedValue(makeRate('rate-25', 25));
    renderPage();

    await user.type(await screen.findByLabelText('Tarifa'), '25.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(ratesApi.update).toHaveBeenCalledWith('rate-20', 25);
    expect(await screen.findByText('USD 20.00 · Inactiva')).toBeInTheDocument();
    expect(screen.getByText('USD 25.00 · Activa')).toBeInTheDocument();
  });

  it('CP-025-03 conserva las tarifas de citas previas al inactivar el servicio', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.list).mockResolvedValue([makeRate('rate-20', 20)]);
    vi.mocked(ratesApi.deactivateService).mockResolvedValue({
      id: 'service-consulta',
      nombre: 'Consulta general',
      estado: false,
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Inactivar servicio' }));

    expect(ratesApi.deactivateService).toHaveBeenCalledWith('service-consulta');
    expect(await screen.findByText('USD 20.00 · Activa')).toBeInTheDocument();
  });

  it('CP-025-09 recepcion@vetmanage.local no puede cambiar la tarifa semilla USD 25.00 de Consulta general en Sucursal Centro', async () => {
    vi.mocked(schedulingApi.listBranches).mockResolvedValue([
      { id: 'branch-centro', nombre: 'Sucursal Centro', salas: [] },
    ]);
    vi.mocked(schedulingApi.listServices).mockResolvedValue([
      { id: 'service-consulta-general', nombre: 'Consulta general', duracionMaximaMin: 30 },
    ]);
    vi.mocked(ratesApi.list).mockResolvedValue([{
      ...makeRate('rate-seed', 25),
      servicioId: 'service-consulta-general',
      sucursalId: 'branch-centro',
      servicio: { id: 'service-consulta-general', nombre: 'Consulta general', estado: true },
      sucursal: { id: 'branch-centro', nombre: 'Sucursal Centro', estado: true },
    }]);

    renderPage(true, false, {
      id: 'seed-receptionist',
      firstName: 'Lucía',
      lastName: 'Mendoza',
      email: 'recepcion@vetmanage.local',
      roles: [{ name: 'receptionist', displayName: 'Recepcionista' }],
      permissions: ['rates:read'],
    });
    expect(await screen.findByText('Tarifas')).toBeInTheDocument();
    expect(screen.getByText('Sucursal Centro · Consulta general')).toBeInTheDocument();
    expect(screen.getByText('USD 25.00 · Activa')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inactivar servicio' })).not.toBeInTheDocument();
    expect(ratesApi.update).not.toHaveBeenCalled();
  });

  it('CP-025-09 muestra el mensaje exacto ante un 403 y conserva el catálogo', async () => {
    const user = userEvent.setup();
    vi.mocked(ratesApi.list).mockResolvedValue([makeRate('rate-20', 20)]);
    vi.mocked(ratesApi.update).mockRejectedValue(new ApiError('Forbidden', 403));
    renderPage();

    await user.type(await screen.findByLabelText('Tarifa'), '25.00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(FORBIDDEN_RATE_MESSAGE);
    expect(screen.getByText('USD 20.00 · Activa')).toBeInTheDocument();
  });

  it('CP-025-09 muestra acceso denegado sin rates:read', () => {
    renderPage(false, false);
    expect(screen.getByRole('alert')).toHaveTextContent(FORBIDDEN_RATE_MESSAGE);
  });
});
