import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { speciesApi } from '../services/species.service';
import type { Species } from '../types';
import { SpeciesPage } from './species-page';

vi.mock('../services/species.service', () => ({
  speciesApi: {
    listSpecies: vi.fn(),
    registerSpecies: vi.fn(),
    updateSpecies: vi.fn(),
  },
}));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

const sampleSpecies: Species[] = [
  {
    id: 'sp-1',
    name: 'Canino',
    description: 'Perros domésticos',
    isActive: true,
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
];

function renderPage() {
  const showToast = vi.fn();
  render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <SpeciesPage />
    </ToastContext.Provider>,
  );
  return { showToast };
}

describe('SpeciesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set();
    vi.mocked(speciesApi.listSpecies).mockResolvedValue(sampleSpecies);
  });

  it('muestra "Nueva especie" con el permiso species:create (Veterinario)', async () => {
    permissions = new Set(['species:read', 'species:create']);
    renderPage();

    expect(screen.getByRole('button', { name: /nueva especie/i })).toBeInTheDocument();
    expect(await screen.findByText('Canino')).toBeInTheDocument();
  });

  it('oculta "Nueva especie" y "Editar" a quien solo consulta especies', async () => {
    permissions = new Set(['species:read']);
    renderPage();

    await screen.findByText('Canino');
    expect(screen.queryByRole('button', { name: /nueva especie/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('actualiza una especie exitosamente y muestra toast de confirmación', async () => {
    permissions = new Set(['species:read', 'species:update']);
    vi.mocked(speciesApi.updateSpecies).mockResolvedValue({
      ...sampleSpecies[0],
      name: 'Canino doméstico',
      description: 'Mascotas caninas',
    });
    const { showToast } = renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/nombre de la especie/i);
    const descInput = within(dialog).getByLabelText(/descripción/i);

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Canino doméstico');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Mascotas caninas');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(speciesApi.updateSpecies).toHaveBeenCalledWith('sp-1', {
        name: 'Canino doméstico',
        description: 'Mascotas caninas',
      });
    });
    expect(showToast).toHaveBeenCalledWith('Especie actualizada exitosamente', 'success');
    expect(await screen.findByText('Canino doméstico')).toBeInTheDocument();
  });

  it('permite actualizar una especie dejando la descripción vacía', async () => {
    permissions = new Set(['species:read', 'species:update']);
    vi.mocked(speciesApi.updateSpecies).mockResolvedValue({
      ...sampleSpecies[0],
      description: null,
    });
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText(/descripción/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(speciesApi.updateSpecies).toHaveBeenCalledWith('sp-1', {
        name: 'Canino',
        description: undefined,
      });
    });
  });

  it('impide actualizar si se elimina el nombre de la especie', async () => {
    permissions = new Set(['species:read', 'species:update']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.clear(within(dialog).getByLabelText(/nombre de la especie/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(within(dialog).getByText('El nombre de la especie es obligatorio')).toBeInTheDocument();
    expect(speciesApi.updateSpecies).not.toHaveBeenCalled();
  });

  it('descarta los cambios al presionar Cancelar', async () => {
    permissions = new Set(['species:read', 'species:update']);
    renderPage();
    await screen.findByText('Canino');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Canino' }));
    const dialog = screen.getByRole('dialog');
    const nameInput = within(dialog).getByLabelText(/nombre de la especie/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cambio descartado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(speciesApi.updateSpecies).not.toHaveBeenCalled();
    expect(screen.getByText('Canino')).toBeInTheDocument();
  });
});
