import { useEffect, useState } from 'react';
import { PawIcon, PlusIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { SpeciesForm } from '../components/species-form';
import { speciesApi } from '../services/species.service';
import type { RegisterSpeciesDraft } from '../types';

export function SpeciesPage() {
  const [isModalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  useEffect(() => {
    if (!isModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) setModalOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, loading]);

  const handleRegister = async (draft: RegisterSpeciesDraft) => {
    setLoading(true);
    try {
      await speciesApi.registerSpecies(draft);
      showToast('Especie registrada exitosamente', 'success');
      setModalOpen(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al registrar especie', 'error');
      throw cause;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {hasPermission('species:create') && (
        <div className="species-toolbar">
          <button type="button" className="button button--primary" onClick={() => setModalOpen(true)}>
            <PlusIcon size={16} />
            Nueva especie
          </button>
        </div>
      )}

      <div className="catalog-empty" role="status">
        <span className="catalog-empty__icon">
          <PawIcon size={22} />
        </span>
        <strong>El listado de especies estará disponible próximamente</strong>
        <p>Desde aquí se podrán consultar las especies registradas.</p>
      </div>

      {isModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setModalOpen(false);
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="species-modal-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="species-modal-title">Nueva especie</h3>
                <p>Completa los datos para agregarla al catálogo.</p>
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
              <SpeciesForm onSubmit={handleRegister} onCancel={() => setModalOpen(false)} isLoading={loading} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
