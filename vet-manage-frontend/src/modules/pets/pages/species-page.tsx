import { useEffect, useState } from 'react';
import { PawIcon, PlusIcon } from '../../../common/components/icons';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { SpeciesForm } from '../components/species-form';
import { speciesApi } from '../services/species.service';
import type { RegisterSpeciesDraft, Species } from '../types';

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function SpeciesPage() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState<Species | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();
  const { hasPermission } = useAuth();

  const canCreate = hasPermission('species:create');
  const canUpdate = hasPermission('species:update');
  const modalOpen = isCreateOpen || editingSpecies !== null;

  useEffect(() => {
    let cancelled = false;
    speciesApi.listSpecies()
      .then((items) => {
        if (!cancelled) {
          setSpecies(items);
          setListError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setListError(cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo de especies.');
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) {
        setCreateOpen(false);
        setEditingSpecies(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen, submitting]);

  const closeModal = () => {
    if (submitting) return;
    setCreateOpen(false);
    setEditingSpecies(null);
  };

  const handleRegister = async (draft: RegisterSpeciesDraft) => {
    setSubmitting(true);
    try {
      const created = await speciesApi.registerSpecies(draft);
      setSpecies((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name, 'es')));
      showToast('Especie registrada exitosamente', 'success');
      setCreateOpen(false);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al registrar especie', 'error');
      throw cause;
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (draft: RegisterSpeciesDraft) => {
    if (!editingSpecies) return;
    setSubmitting(true);
    try {
      const updated = await speciesApi.updateSpecies(editingSpecies.id, draft);
      setSpecies((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      );
      showToast('Especie actualizada exitosamente', 'success');
      setEditingSpecies(null);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'Error al actualizar especie', 'error');
      throw cause;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {canCreate && (
        <div className="species-toolbar">
          <button type="button" className="button button--primary" onClick={() => setCreateOpen(true)}>
            <PlusIcon size={16} />
            Nueva especie
          </button>
        </div>
      )}

      {listLoading ? (
        <div className="empty-state">Cargando especies…</div>
      ) : listError ? (
        <div className="inline-notice inline-notice--error" role="alert">{listError}</div>
      ) : species.length === 0 ? (
        <div className="catalog-empty" role="status">
          <span className="catalog-empty__icon">
            <PawIcon size={22} />
          </span>
          <strong>No hay especies registradas</strong>
          <p>Registra una nueva especie para comenzar a clasificar a los pacientes.</p>
        </div>
      ) : (
        <div className="catalog-card">
          <div className="catalog-card__heading">
            <div className="species-card__title">
              <span className="species-card__icon" aria-hidden="true">
                <PawIcon size={18} />
              </span>
              <div>
                <h3>Especies registradas</h3>
                <p>Especies habilitadas para el registro de pacientes y razas.</p>
              </div>
            </div>
            <span className="species-count-badge">
              {species.length} {species.length === 1 ? 'especie' : 'especies'}
            </span>
          </div>
          <div className="product-table-wrap">
            <table className="product-table species-table" aria-label="Especies">
              <thead>
                <tr>
                  <th className="species-table__name">Nombre</th>
                  <th className="species-table__description">Descripción</th>
                  <th className="species-table__date">Actualizada</th>
                  <th className="species-table__status">Estado</th>
                  {canUpdate && <th className="species-table__actions">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {species.map((item) => (
                  <tr key={item.id}>
                    <td className="species-table__name">
                      <div className="species-name-cell">
                        <span className="species-row-icon" aria-hidden="true">
                          <PawIcon size={15} />
                        </span>
                        <strong>{item.name}</strong>
                      </div>
                    </td>
                    <td className="species-table__description">
                      {item.description ? (
                        <span className="species-desc-cell">
                          <NoteIcon />
                          <span>{item.description}</span>
                        </span>
                      ) : (
                        <span className="species-desc-empty">Sin descripción</span>
                      )}
                    </td>
                    <td className="species-table__date">
                      <span className="species-date-cell">
                        <CalendarIcon />
                        <span>{formatShortDate(item.updatedAt)}</span>
                      </span>
                    </td>
                    <td className="species-table__status">
                      <span className={`status-badge status-badge--${item.isActive ? 'active' : 'inactive'}`}>
                        {item.isActive ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    {canUpdate && (
                      <td className="species-table__actions">
                        <button
                          type="button"
                          className="species-icon-btn"
                          aria-label={`Editar ${item.name}`}
                          title="Editar especie"
                          data-tooltip="Editar especie"
                          onClick={() => setEditingSpecies(item)}
                        >
                          <EditIcon />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="species-modal-title">
            <div className="modal-card__heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3 id="species-modal-title">{editingSpecies ? 'Editar especie' : 'Nueva especie'}</h3>
                <p>
                  {editingSpecies
                    ? 'Actualiza el nombre o la descripción de la especie seleccionada.'
                    : 'Completa los datos para agregarla al catálogo.'}
                </p>
              </div>
              <button
                type="button"
                className="modal-card__close"
                aria-label="Cerrar"
                onClick={closeModal}
                disabled={submitting}
              >
                ×
              </button>
            </div>
            <div className="modal-card__body">
              {editingSpecies ? (
                <SpeciesForm
                  key={editingSpecies.id}
                  initialValue={{ name: editingSpecies.name, description: editingSpecies.description }}
                  submitLabel="Guardar cambios"
                  onSubmit={handleUpdate}
                  onCancel={closeModal}
                  isLoading={submitting}
                />
              ) : (
                <SpeciesForm onSubmit={handleRegister} onCancel={closeModal} isLoading={submitting} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
