import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { breedApi } from '../services/breed.service';
import { speciesApi } from '../services/species.service';
import type { Breed } from '../types';
import { BreedsPage } from './breeds-page';

vi.mock('../services/breed.service', () => ({
  breedApi: {
    listBreeds: vi.fn(),
    registerBreed: vi.fn(),
    updateBreed: vi.fn(),
    inactivateBreed: vi.fn(),
    activateBreed: vi.fn(),
  },
}));
vi.mock('../services/species.service', () => ({ speciesApi: { listActiveSpecies: vi.fn() } }));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

const showToast = vi.fn();
const confirm = vi.fn(async () => true);

const sampleBreeds: Breed[] = [
  {
    id: 'br-1',
    name: 'Labrador',
    description: 'Perro amigable',
    isActive: true,
    speciesId: 'sp-1',
    species: { id: 'sp-1', name: 'Canino' },
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm }}>
      <BreedsPage />
    </ToastContext.Provider>,
  );
}

describe('BreedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set(['breeds:read', 'breeds:create', 'breeds:update', 'breeds:change-status', 'species:read']);
    confirm.mockResolvedValue(true);
    vi.mocked(breedApi.listBreeds).mockResolvedValue(sampleBreeds);
    vi.mocked(speciesApi.listActiveSpecies).mockResolvedValue([
      { id: 'sp-1', name: 'Canino' },
      { id: 'sp-2', name: 'Felino' },
    ]);
  });

  it('registra una raza, muestra la confirmación y cierra el formulario', async () => {
    vi.mocked(breedApi.registerBreed).mockResolvedValue({
      id: 'br-2',
      name: 'Poodle',
      description: null,
      isActive: true,
      speciesId: 'sp-1',
      createdAt: '2026-11-18T00:00:00.000Z',
      updatedAt: '2026-11-18T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    await screen.findByRole('option', { name: 'Canino' });
    await userEvent.type(screen.getByLabelText(/nombre de la raza/i), 'Poodle');
    await userEvent.selectOptions(screen.getByLabelText(/especie/i), 'sp-1');
    await userEvent.click(screen.getByRole('button', { name: /guardar raza/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(breedApi.registerBreed).toHaveBeenCalledWith({ name: 'Poodle', speciesId: 'sp-1', description: undefined });
    expect(showToast).toHaveBeenCalledWith('Raza registrada exitosamente', 'success');
  });

  it('muestra el error y recarga las especies cuando el registro falla', async () => {
    vi.mocked(breedApi.registerBreed).mockRejectedValue(new Error('La especie seleccionada está inactiva'));
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    await screen.findByRole('option', { name: 'Canino' });
    await userEvent.type(screen.getByLabelText(/nombre de la raza/i), 'Labrador');
    await userEvent.selectOptions(screen.getByLabelText(/especie/i), 'sp-1');
    await userEvent.click(screen.getByRole('button', { name: /guardar raza/i }));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('La especie seleccionada está inactiva', 'error'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(speciesApi.listActiveSpecies).toHaveBeenCalledTimes(2);
  });

  it('cierra el formulario con Cancelar sin registrar nada', async () => {
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(breedApi.registerBreed).not.toHaveBeenCalled();
  });

  it('oculta "Nueva raza" y "Editar" a quien solo consulta razas', async () => {
    permissions = new Set(['breeds:read']);
    renderPage();

    await screen.findByText('Labrador');
    expect(screen.queryByRole('button', { name: /nueva raza/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inactivar|activar/i })).not.toBeInTheDocument();
  });

  it('inactiva una raza solo después de confirmar y actualiza su disponibilidad', async () => {
    vi.mocked(breedApi.inactivateBreed).mockResolvedValue({
      id: 'br-1',
      isActive: false,
      updatedAt: '2026-11-26T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar Labrador' }));

    expect(confirm).toHaveBeenCalledWith(
      '¿Confirmas que deseas inactivar la raza "Labrador"?',
      'Sí, inactivar',
      'danger',
    );
    await waitFor(() => expect(breedApi.inactivateBreed).toHaveBeenCalledWith('br-1'));
    expect(await screen.findByText('Inactiva')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Raza inactivada correctamente', 'success');
  });

  it('conserva el estado al cancelar la confirmación', async () => {
    confirm.mockResolvedValueOnce(false);
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar Labrador' }));

    expect(breedApi.inactivateBreed).not.toHaveBeenCalled();
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('activa una raza inactiva después de confirmar', async () => {
    vi.mocked(breedApi.listBreeds).mockResolvedValue([{ ...sampleBreeds[0], isActive: false }]);
    vi.mocked(breedApi.activateBreed).mockResolvedValue({
      id: 'br-1',
      isActive: true,
      updatedAt: '2026-11-26T00:00:00.000Z',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Activar Labrador' }));

    await waitFor(() => expect(breedApi.activateBreed).toHaveBeenCalledWith('br-1'));
    expect(await screen.findByText('Activa')).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith('Raza activada correctamente', 'success');
  });

  it('actualiza una raza exitosamente y muestra toast de confirmación', async () => {
    vi.mocked(breedApi.updateBreed).mockResolvedValue({
      ...sampleBreeds[0],
      name: 'Labrador Retriever',
      speciesId: 'sp-2',
      species: { id: 'sp-2', name: 'Felino' },
      description: 'Descripción actualizada',
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Felino' });

    const nameInput = within(dialog).getByLabelText(/nombre de la raza/i);
    const speciesSelect = within(dialog).getByLabelText(/especie/i);
    const descInput = within(dialog).getByLabelText(/descripción/i);

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Labrador Retriever');
    await userEvent.selectOptions(speciesSelect, 'sp-2');
    await userEvent.clear(descInput);
    await userEvent.type(descInput, 'Descripción actualizada');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(breedApi.updateBreed).toHaveBeenCalledWith('br-1', {
        name: 'Labrador Retriever',
        speciesId: 'sp-2',
        description: 'Descripción actualizada',
      });
    });
    expect(showToast).toHaveBeenCalledWith('Raza actualizada exitosamente', 'success');
    expect(await screen.findByText('Labrador Retriever')).toBeInTheDocument();
  });

  it('permite actualizar una raza dejando la descripción vacía', async () => {
    vi.mocked(breedApi.updateBreed).mockResolvedValue({
      ...sampleBreeds[0],
      description: null,
    });
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });

    await userEvent.clear(within(dialog).getByLabelText(/descripción/i));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(breedApi.updateBreed).toHaveBeenCalledWith('br-1', {
        name: 'Labrador',
        speciesId: 'sp-1',
        description: undefined,
      });
    });
  });

  it('impide actualizar si se elimina el nombre o la especie', async () => {
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });

    await userEvent.clear(within(dialog).getByLabelText(/nombre de la raza/i));
    await userEvent.selectOptions(within(dialog).getByLabelText(/especie/i), '');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

    expect(within(dialog).getByText('El nombre de la raza es obligatorio')).toBeInTheDocument();
    expect(within(dialog).getByText('Debes asociar la raza a una especie')).toBeInTheDocument();
    expect(breedApi.updateBreed).not.toHaveBeenCalled();
  });

  it('descarta los cambios al presionar Cancelar en edición', async () => {
    renderPage();
    await screen.findByText('Labrador');

    await userEvent.click(screen.getByRole('button', { name: 'Editar Labrador' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Canino' });

    const nameInput = within(dialog).getByLabelText(/nombre de la raza/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Cambio descartado');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(breedApi.updateBreed).not.toHaveBeenCalled();
    expect(screen.getByText('Labrador')).toBeInTheDocument();
  });
});
