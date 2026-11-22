import { useCallback, useEffect, useState } from 'react';
import { PawIcon, PlusIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { BreedForm } from '../components/breed-form';
import { breedApi } from '../services/breed.service';
import { speciesApi } from '../services/species.service';
import type { RegisterBreedDraft, SpeciesOption } from '../types';

export function BreedsPage() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [species, setSpecies] = useState<SpeciesOption[]>([]);
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  const loadSpecies = useCallback(async () => {
    setSpeciesLoading(true);
    try {
      setSpecies(await speciesApi.listActiveSpecies());
    } catch (cause) {
      setSpecies([]);
      showToast(cause instanceof Error ? cause.message : 'No se pudieron cargar las especies', 'error');
    } finally {
      setSpeciesLoading(false);
    }
  }, [showToast]);

  // Recarga las especies cada vez que se abre el modal
  const openModal = () => {
    setModalOpen(true);
    void loadSpecies();
  };

  useEffect(() => {
    // Permite cerrar el modal con Escape salvo mientras se guarda
    if (!isModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) setModalOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, loading]);

  const handleRegister = async (draft: RegisterBreedDraft) => {
    setLoading(true);
    try {
      await breedApi.registerBreed(draft);
      showToast('Raza registrada exitosamente', 'success');
      setModalOpen(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al registrar raza', 'error');
      // Refresca las especies por si alguna fue desactivada, y relanza para que el form muestre el error
      void loadSpecies();
      throw cause;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {hasPermission('breeds:create') && (
        <div className="species-toolbar">
          <button type="button" className="button button--primary" onClick={openModal}>
            <PlusIcon size={16} />
            Nueva raza
          </button>
        </div>
      )}

      <div className="catalog-empty" role="status">
        <span className="catalog-empty__icon">
          <PawIcon size={22} />
        </span>
        <strong>El listado de razas estará disponible próximamente</strong>
        <p>Desde aquí se podrán consultar las razas registradas por especie.</p>
      </div>

      {isModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setModalOpen(false);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="breed-modal-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="breed-modal-title">Nueva raza</h3>
                <p>Asóciala a una especie activa para agregarla al catálogo.</p>
              </div>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Cerrar"
                onClick={() => setModalOpen(false)}
                disabled={loading}
              >
                ×
              </button>
            </div>
            <div className="modal-card__body">
              <BreedForm
                species={species}
                speciesLoading={speciesLoading}
                onSubmit={handleRegister}
                onCancel={() => setModalOpen(false)}
                isLoading={loading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
