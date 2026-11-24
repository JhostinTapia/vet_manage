import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '../../../common/components/toast';
import { ApiError } from '../../../infrastructure/api/http-client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../../auth/auth-context';
import { RequirePermission } from '../../auth/components/require-permission';
import { usersApi } from '../services/users-api';
import type { UserDetail, UserListItem, UserPage, UserStatus } from '../types';
import { UsersPage } from './users-page';

vi.mock('../services/users-api', () => ({
  usersApi: {
    list: vi.fn(),
    assignableRoles: vi.fn(),
    changeStatus: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
}));

function makeUser(id: string, firstName: string, lastName: string, status: UserStatus = 'ACTIVE'): UserListItem {
  return {
    id,
    identification: `99${id}`,
    firstName,
    lastName,
    email: `${id}@example.test`,
    roles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
    status,
  };
}

function makePage(page: number, total: number): UserPage {
  const size = Math.min(20, Math.max(0, total - (page - 1) * 20));
  return {
    items: Array.from({ length: size }, (_, index) => makeUser(`u${page}-${index}`, `Usuario${page}${index}`, `Apellido${page}${index}`)),
    total,
    page,
    pageSize: 20,
  };
}

function renderPage(overrides: Partial<AuthContextValue> = {}) {
  const auth: AuthContextValue = {
    status: 'authenticated',
    session: null,
    login: vi.fn(async () => ({
      mustChangePassword: false,
      user: { id: 'admin', firstName: 'Ana', lastName: 'Admin', email: 'admin@example.test', roles: [], permissions: [] },
    })),
    logout: vi.fn(async () => undefined),
    hasPermission: () => true,
    ...overrides,
  };

  return render(
    <AuthContext.Provider value={auth}>
      <ToastProvider>
        <MemoryRouter>
          <RequirePermission permission="users:read">
            <UsersPage />
          </RequirePermission>
        </MemoryRouter>
      </ToastProvider>
    </AuthContext.Provider>,
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usersApi.assignableRoles).mockResolvedValue([
      { name: 'veterinarian', displayName: 'Veterinario', description: null },
      { name: 'cashier', displayName: 'Cajero', description: null },
    ]);
    vi.mocked(usersApi.list).mockResolvedValue({
      items: [makeUser('1', 'Ana', 'Aguilar', 'INACTIVE'), makeUser('2', 'Luis', 'Mena')],
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  it('muestra la lista inicial con cédula, nombre, correo, roles y estado', async () => {
    renderPage();

    const table = await screen.findByRole('table', { name: 'Usuarios' });
    expect(table).toBeInTheDocument();
    expect(within(table).getByText('Ana Aguilar')).toBeInTheDocument();
    expect(within(table).getByText('1@example.test')).toBeInTheDocument();
    expect(within(table).getAllByText('Veterinario')).toHaveLength(2);
    expect(within(table).getByText('Inactivo')).toBeInTheDocument();
    expect(screen.getByText('2 usuarios')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
    expect(usersApi.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('combina búsqueda, rol y estado y reinicia la página', async () => {
    renderPage();
    await screen.findByText('Ana Aguilar');

    await userEvent.type(screen.getByLabelText('Buscar usuarios'), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por rol'), 'veterinarian');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'INACTIVE');

    await waitFor(() => {
      expect(usersApi.list).toHaveBeenLastCalledWith({
        q: 'Pérez',
        role: 'veterinarian',
        status: 'INACTIVE',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('conserva los filtros al avanzar de página', async () => {
    vi.mocked(usersApi.list).mockImplementation(async (query = {}) => makePage(query.page ?? 1, 45));
    renderPage();
    await userEvent.type(screen.getByLabelText('Buscar usuarios'), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por rol'), 'veterinarian');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'ACTIVE');
    await screen.findByText(/Usuario10/);

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => {
      expect(usersApi.list).toHaveBeenLastCalledWith({
        q: 'Pérez',
        role: 'veterinarian',
        status: 'ACTIVE',
        page: 2,
        pageSize: 20,
      });
    });
    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getByText(/Usuario20/)).toBeInTheDocument();
  });

  it('muestra el mensaje sin resultados y no renderiza filas', async () => {
    vi.mocked(usersApi.list).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('No se encontraron usuarios')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('recarga el listado sin búsqueda al borrar todo el campo', async () => {
    renderPage();
    await screen.findByText('Ana Aguilar');

    await userEvent.type(screen.getByLabelText('Buscar usuarios'), 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por rol'), 'veterinarian');

    await waitFor(() => {
      expect(usersApi.list).toHaveBeenLastCalledWith({
        q: 'Pérez',
        role: 'veterinarian',
        page: 1,
        pageSize: 20,
      });
    });

    await userEvent.clear(screen.getByLabelText('Buscar usuarios'));

    await waitFor(() => {
      expect(usersApi.list).toHaveBeenLastCalledWith({
        role: 'veterinarian',
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('restablece búsqueda y filtros con Limpiar búsqueda', async () => {
    renderPage();
    await screen.findByText('Ana Aguilar');

    const searchInput = screen.getByLabelText('Buscar usuarios');
    await userEvent.type(searchInput, 'Pérez');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por rol'), 'veterinarian');
    await userEvent.selectOptions(screen.getByLabelText('Filtrar por estado'), 'INACTIVE');

    await userEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));

    expect(searchInput).toHaveValue('');
    expect(screen.getByLabelText('Filtrar por rol')).toHaveValue('');
    expect(screen.getByLabelText('Filtrar por estado')).toHaveValue('');
    await waitFor(() => {
      expect(usersApi.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 });
    });
  });

  it('niega la vista a un usuario sin users:read', () => {
    renderPage({ hasPermission: () => false });

    expect(screen.getByText('No tiene permisos para realizar esta acción')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(usersApi.list).not.toHaveBeenCalled();
  });

  it('muestra Inactivar para activos, Activar para inactivos y oculta ambos para dados de baja', async () => {
    vi.mocked(usersApi.list).mockResolvedValue({
      items: [
        makeUser('1', 'Luis', 'Torres', 'ACTIVE'),
        makeUser('2', 'Ana', 'Aguilar', 'INACTIVE'),
        makeUser('3', 'Carlos', 'Baja', 'DEACTIVATED'),
      ],
      total: 3,
      page: 1,
      pageSize: 20,
    });

    renderPage();
    const table = await screen.findByRole('table', { name: 'Usuarios' });
    const rows = within(table).getAllByRole('row').slice(1);

    expect(within(rows[0]).getByRole('button', { name: 'Inactivar' })).toBeInTheDocument();
    expect(within(rows[1]).getByRole('button', { name: 'Activar' })).toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
    expect(within(rows[2]).queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('oculta Inactivar y Activar cuando no tiene permiso users:change-status', async () => {
    renderPage({ hasPermission: (permission) => permission === 'users:read' });
    await screen.findByRole('table', { name: 'Usuarios' });

    expect(screen.queryByRole('button', { name: 'Inactivar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activar' })).not.toBeInTheDocument();
  });

  it('inactiva una cuenta tras confirmar el diálogo y actualiza el estado', async () => {
    vi.mocked(usersApi.changeStatus).mockResolvedValue({ id: '2', status: 'INACTIVE' });
    renderPage();
    await screen.findByText('Luis Mena');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Luis Mena/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(usersApi.changeStatus).toHaveBeenCalledWith('2', 'INACTIVE');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Cuenta inactivada correctamente');
    expect(screen.getByRole('status').closest('.toast')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancela la inactivación sin llamar a la API', async () => {
    renderPage();
    await screen.findByText('Luis Mena');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(usersApi.changeStatus).not.toHaveBeenCalled();
  });

  it('activa una cuenta inactiva tras confirmar el diálogo', async () => {
    vi.mocked(usersApi.changeStatus).mockResolvedValue({ id: '1', status: 'ACTIVE' });
    renderPage();
    await screen.findByText('Ana Aguilar');

    await userEvent.click(screen.getByRole('button', { name: 'Activar' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(usersApi.changeStatus).toHaveBeenCalledWith('1', 'ACTIVE');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Cuenta activada correctamente');
    expect(screen.getByRole('status').closest('.toast')).not.toBeNull();
  });

  it('muestra el mensaje de error del backend si se rechaza el cambio de estado', async () => {
    vi.mocked(usersApi.changeStatus).mockRejectedValue(new Error('No puede inactivar su propia cuenta'));
    renderPage();
    await screen.findByText('Luis Mena');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No puede inactivar su propia cuenta');
    expect(alert.closest('.toast')).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  describe('Actualizar datos de usuario (HU-53)', () => {
    const detail = (overrides: Partial<UserDetail> = {}): UserDetail => ({
      id: '2',
      identification: '1710034065',
      firstName: 'Luis',
      lastName: 'Mena',
      email: '2@example.test',
      phone: '0991111111',
      status: 'ACTIVE',
      roles: [{ name: 'veterinarian', displayName: 'Veterinario' }],
      ...overrides,
    });

    beforeEach(() => {
      vi.mocked(usersApi.get).mockResolvedValue(detail());
    });

    it('muestra Editar en activos e inactivos y Ver datos en dados de baja', async () => {
      vi.mocked(usersApi.list).mockResolvedValue({
        items: [makeUser('1', 'Luis', 'Torres'), makeUser('2', 'Ana', 'Aguilar', 'INACTIVE'), makeUser('3', 'Luis', 'Ríos', 'DEACTIVATED')],
        total: 3,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      const rows = within(await screen.findByRole('table', { name: 'Usuarios' })).getAllByRole('row').slice(1);

      expect(within(rows[0]).getByRole('button', { name: 'Editar a Luis Torres' })).toBeInTheDocument();
      expect(within(rows[1]).getByRole('button', { name: 'Editar a Ana Aguilar' })).toBeInTheDocument();
      expect(within(rows[2]).queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
      expect(within(rows[2]).getByRole('button', { name: 'Ver datos de Luis Ríos' })).toBeInTheDocument();
    });

    it('oculta Editar sin el permiso users:update', async () => {
      renderPage({ hasPermission: (permission) => permission === 'users:read' });
      await screen.findByText('Luis Mena');

      expect(screen.queryByRole('button', { name: /^Editar/ })).not.toBeInTheDocument();
    });

    it('consulta los datos y abre el formulario con la cédula bloqueada', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));

      const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' });
      expect(usersApi.get).toHaveBeenCalledWith('2');
      expect(within(dialog).getByLabelText(/cédula/i)).toBeDisabled();
      expect(within(dialog).getByLabelText(/teléfono/i)).toHaveValue('0991111111');
    });

    it('muestra un toast de error si no puede consultar al usuario', async () => {
      vi.mocked(usersApi.get).mockRejectedValue(new Error('Usuario no encontrado'));
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Usuario no encontrado');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('guarda, cierra el formulario, actualiza la fila y muestra el toast de la HU', async () => {
      vi.mocked(usersApi.update).mockResolvedValue({ ...detail({ firstName: 'Luis Alberto', phone: '0992222222' }), noticeSent: null });
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' });

      await userEvent.clear(within(dialog).getByLabelText(/teléfono/i));
      await userEvent.type(within(dialog).getByLabelText(/teléfono/i), '0992222222');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      await waitFor(() => expect(usersApi.update).toHaveBeenCalledWith('2', {
        firstName: 'Luis', lastName: 'Mena', email: '2@example.test', phone: '0992222222',
      }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(await screen.findByRole('status')).toHaveTextContent('Datos actualizados correctamente');
      expect(screen.getByText('Luis Alberto Mena')).toBeInTheDocument();
    });

    it('agrega una advertencia si no se pudo avisar al correo anterior', async () => {
      vi.mocked(usersApi.update).mockResolvedValue({ ...detail({ email: 'nuevo@example.test' }), noticeSent: false });
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' });

      await userEvent.clear(within(dialog).getByLabelText(/correo electrónico/i));
      await userEvent.type(within(dialog).getByLabelText(/correo electrónico/i), 'nuevo@example.test');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Datos actualizados correctamente')).toBeInTheDocument();
      expect(await screen.findByText('No se pudo enviar el aviso al correo anterior')).toBeInTheDocument();
    });

    it('mantiene el formulario y resalta el correo repetido que rechaza la API', async () => {
      vi.mocked(usersApi.update).mockRejectedValue(
        new ApiError('El correo ya se encuentra registrado', 409, { code: 'USER_EMAIL_TAKEN', errors: ['email'] }),
      );
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' });

      await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent('El correo ya se encuentra registrado');
      expect(within(dialog).getByLabelText(/correo electrónico/i)).toHaveAttribute('aria-invalid', 'true');
    });

    it('cancela sin llamar a la API', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Editar a Luis Mena' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar usuario' });

      await userEvent.type(within(dialog).getByLabelText(/teléfono/i), '9');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(usersApi.update).not.toHaveBeenCalled();
    });

    it('muestra la ficha de un usuario dado de baja solo para consulta', async () => {
      vi.mocked(usersApi.list).mockResolvedValue({ items: [makeUser('3', 'Luis', 'Ríos', 'DEACTIVATED')], total: 1, page: 1, pageSize: 20 });
      vi.mocked(usersApi.get).mockResolvedValue(detail({ id: '3', firstName: 'Luis', lastName: 'Ríos', status: 'DEACTIVATED' }));
      renderPage();
      await userEvent.click(await screen.findByRole('button', { name: 'Ver datos de Luis Ríos' }));

      const dialog = await screen.findByRole('dialog', { name: 'Datos del usuario' });
      for (const field of [/cédula/i, /teléfono/i, /nombres/i, /apellidos/i, /correo electrónico/i]) {
        expect(within(dialog).getByLabelText(field)).toBeDisabled();
      }
      expect(within(dialog).queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
      const closeButtons = within(dialog).getAllByRole('button', { name: 'Cerrar' });
      await userEvent.click(closeButtons[closeButtons.length - 1]);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
