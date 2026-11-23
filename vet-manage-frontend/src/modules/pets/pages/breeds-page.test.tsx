import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { BreedsPage } from './breeds-page';
import { breedApi } from '../services/breed.service';
import { speciesApi } from '../services/species.service';

vi.mock('../services/breed.service', () => ({ breedApi: { registerBreed: vi.fn() } }));
vi.mock('../services/species.service', () => ({ speciesApi: { listActiveSpecies: vi.fn() } }));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

const showToast = vi.fn();

function renderPage() {
  return render(
      <ToastContext.Provider value={{ showToast, dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <BreedsPage />
    </ToastContext.Provider>,
  );
}

describe('BreedsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissions = new Set(['breeds:read', 'breeds:create', 'species:read']);
    vi.mocked(speciesApi.listActiveSpecies).mockResolvedValue([{ id: 'sp-1', name: 'Canino' }]);
  });

  it('registra una raza, muestra la confirmación y cierra el formulario', async () => {
    vi.mocked(breedApi.registerBreed).mockResolvedValue({} as never);
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    await screen.findByRole('option', { name: 'Canino' });
    await userEvent.type(screen.getByLabelText(/nombre de la raza/i), 'Labrador');
    await userEvent.selectOptions(screen.getByLabelText(/especie/i), 'sp-1');
    await userEvent.click(screen.getByRole('button', { name: /guardar raza/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(breedApi.registerBreed).toHaveBeenCalledWith({ name: 'Labrador', speciesId: 'sp-1', description: undefined });
    expect(showToast).toHaveBeenCalledWith('Raza registrada exitosamente', 'success');
  });

  it('muestra el error y recarga las especies cuando el registro falla', async () => {
    vi.mocked(breedApi.registerBreed).mockRejectedValue(new Error('La especie seleccionada está inactiva'));
    renderPage();

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

    await userEvent.click(screen.getByRole('button', { name: /nueva raza/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(breedApi.registerBreed).not.toHaveBeenCalled();
  });

  it('oculta "Nueva raza" a quien solo consulta razas', () => {
    permissions = new Set(['breeds:read']);
    renderPage();

    expect(screen.queryByRole('button', { name: /nueva raza/i })).not.toBeInTheDocument();
  });
});
