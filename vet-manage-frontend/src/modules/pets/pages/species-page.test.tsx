import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContext } from '../../../common/components/toast-context';
import { SpeciesPage } from './species-page';

vi.mock('../services/species.service', () => ({ speciesApi: { registerSpecies: vi.fn() } }));

let permissions = new Set<string>();
vi.mock('../../auth/auth-context', () => ({
  useAuth: () => ({ hasPermission: (permission: string) => permissions.has(permission) }),
}));

function renderPage() {
  return render(
      <ToastContext.Provider value={{ showToast: vi.fn(), dismissToast: vi.fn(), confirm: vi.fn(async () => true) }}>
      <SpeciesPage />
    </ToastContext.Provider>,
  );
}

describe('SpeciesPage', () => {
  beforeEach(() => {
    permissions = new Set();
  });

  it('muestra "Nueva especie" con el permiso species:create (Veterinario)', () => {
    permissions = new Set(['species:read', 'species:create']);
    renderPage();

    expect(screen.getByRole('button', { name: /nueva especie/i })).toBeInTheDocument();
  });

  it('oculta "Nueva especie" a quien solo consulta especies', () => {
    permissions = new Set(['species:read']);
    renderPage();

    expect(screen.queryByRole('button', { name: /nueva especie/i })).not.toBeInTheDocument();
  });
});
