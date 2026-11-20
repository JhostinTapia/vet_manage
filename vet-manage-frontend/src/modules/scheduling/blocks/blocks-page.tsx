import { useEffect, useState } from 'react';
import { useToast } from '../../../common/components/toast-context';
import { useAuth } from '../../auth/auth-context';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch } from '../types';
import { BlockForm } from './block-form';
import { blocksApi } from './blocks-api';
import type { ScheduleBlock, ScheduleBlockDraft, Veterinarian } from './types';
import './blocks.css';

const formatDate = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

export function BlocksPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canCreate = hasPermission('schedule-blocks:create');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<Veterinarian[]>([]);
  const [branchFilter, setBranchFilter] = useState('');
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  // Cambia después de registrar un bloqueo para volver a cargar la lista.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    Promise.all([schedulingApi.listBranches(), blocksApi.listVeterinarians()])
      .then(([loadedBranches, loadedVets]) => {
        setBranches(loadedBranches);
        setVeterinarians(loadedVets);
      })
      .catch(() => showToast('No se pudieron cargar las sucursales y los veterinarios.', 'error'));
  }, [showToast]);

  useEffect(() => {
    let cancelled = false;
    blocksApi.list(branchFilter)
      .then((loaded) => { if (!cancelled) setBlocks(loaded); })
      .catch(() => { if (!cancelled) showToast('No se pudieron cargar los bloqueos.', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [branchFilter, reloadKey, showToast]);

  function changeFilter(sucursalId: string) {
    setLoading(true);
    setBranchFilter(sucursalId);
  }

  async function register(draft: ScheduleBlockDraft) {
    await blocksApi.create(draft);
    showToast('Bloqueo registrado correctamente', 'success');
    setLoading(true);
    setReloadKey((key) => key + 1);
  }

  return (
    <section className="inventory-page blocks-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Bloqueos</span>
          <h2>Bloqueos de horario</h2>
          <p>Impide reservas durante una ausencia o un mantenimiento. Un bloqueo no cancela citas: si afecta una, no se guarda.</p>
        </div>
      </div>

      {canCreate && <BlockForm branches={branches} veterinarians={veterinarians} onSubmit={register} />}

      <div className="catalog-card blocks-list">
        <div className="catalog-card__heading">
          <div><h3>Bloqueos vigentes</h3><p>Ordenados por fecha y hora.</p></div>
          <label className="field blocks-filter">
            <span>Sucursal</span>
            <select value={branchFilter} onChange={(event) => changeFilter(event.target.value)} aria-label="Filtrar por sucursal">
              <option value="">Todas</option>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="empty-state">Cargando bloqueos…</div>
        ) : blocks.length === 0 ? (
          <div className="empty-state"><strong>No hay bloqueos vigentes</strong></div>
        ) : (
          <div className="product-table-wrap">
            <table className="product-table">
              <thead>
                <tr><th>Fecha</th><th>Horario</th><th>Sucursal</th><th>Aplica a</th><th>Motivo</th><th>Registrado por</th></tr>
              </thead>
              <tbody>
                {blocks.map((block) => (
                  <tr key={block.id}>
                    <td>{formatDate(block.fecha)}</td>
                    <td>{block.horaInicio}–{block.horaFin}</td>
                    <td>{block.sucursal.nombre}</td>
                    <td>{block.veterinario ? block.veterinario.nombre : <span className="tag tag-red">Toda la sucursal</span>}</td>
                    <td>{block.motivo}</td>
                    <td>{block.registradoPor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
