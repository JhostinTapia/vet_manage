import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch, SaturdayShift, VeterinarianOption } from '../types';

export function SaturdayShiftsPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('saturday-shifts:manage');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<VeterinarianOption[]>([]);
  const [shifts, setShifts] = useState<SaturdayShift[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [fechas, setFechas] = useState('2026-11-07,2026-11-14,2026-11-21');
  const [veterinarioIds, setVeterinarioIds] = useState('');
  const [substituteId, setSubstituteId] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [justificacion, setJustificacion] = useState('');

  const load = useCallback(async () => {
    try {
      setShifts(await schedulingApi.listSaturdayShifts(sucursalId ? { sucursalId } : undefined));
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los turnos.', 'error');
    }
  }, [sucursalId, showToast]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void load();
    }, 0);
    Promise.all([schedulingApi.listBranches(), schedulingApi.listVeterinarians()])
      .then(([loadedBranches, loadedVeterinarians]) => {
        setBranches(loadedBranches);
        setVeterinarians(loadedVeterinarians);
      })
      .catch((cause) => showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los datos.', 'error'));
    return () => window.clearTimeout(timeout);
  }, [load, showToast]);

  async function generate() {
    if (!sucursalId || !veterinarioIds.trim()) {
      showToast('Sucursal y veterinarios elegibles son obligatorios.', 'error');
      return;
    }
    try {
      await schedulingApi.generateSaturdayShifts({
        sucursalId,
        fechas: fechas.split(',').map((value) => value.trim()).filter(Boolean),
        veterinarioIds: veterinarioIds.split(',').map((value) => value.trim()).filter(Boolean),
      });
      showToast('Turnos de sábado generados correctamente', 'success');
      await load();
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudieron generar los turnos.', 'error');
    }
  }

  async function substitute() {
    if (!substituteId || !replacementId || !justificacion.trim()) {
      showToast('Turno, reemplazo y justificación son obligatorios.', 'error');
      return;
    }
    try {
      await schedulingApi.substituteSaturdayShift(substituteId, {
        veterinarioId: replacementId,
        justificacion: justificacion.trim(),
      });
      showToast('Turno sustituido correctamente', 'success');
      setSubstituteId('');
      setReplacementId('');
      setJustificacion('');
      await load();
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudo sustituir el turno.', 'error');
    }
  }

  return (
    <section className="inventory-page work-schedules-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda · Sábados</span>
          <h2>Turnos de sábado</h2>
          <p>Rotación por sucursal y sustituciones justificadas.</p>
        </div>
      </div>

      {canManage && (
        <div className="catalog-card work-schedules-card">
          <div className="catalog-card__heading"><h3>Generar rotación</h3></div>
          <div className="work-schedules-filters">
            <label className="field"><span>Sucursal</span><select value={sucursalId} onChange={(event) => setSucursalId(event.target.value)}><option value="">Seleccione</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}</select></label>
            <label className="field"><span>Fechas (YYYY-MM-DD separadas por coma)</span><input value={fechas} onChange={(event) => setFechas(event.target.value)} /></label>
            <label className="field"><span>Lista de veterinarios (IDs separados por coma)</span><input value={veterinarioIds} onChange={(event) => setVeterinarioIds(event.target.value)} /></label>
            <button type="button" className="button button--primary" onClick={generate}>Generar y guardar</button>
          </div>
        </div>
      )}

      {canManage && (
        <div className="catalog-card work-schedules-card">
          <div className="catalog-card__heading"><h3>Sustituir veterinario</h3></div>
          <div className="work-schedules-filters">
            <label className="field"><span>Turno</span><select value={substituteId} onChange={(event) => setSubstituteId(event.target.value)}><option value="">Seleccione</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.fecha} · {shift.sucursalNombre} · {shift.veterinarioNombre}</option>)}</select></label>
            <label className="field"><span>Reemplazo</span><select value={replacementId} onChange={(event) => setReplacementId(event.target.value)}><option value="">Seleccione</option>{veterinarians.map((veterinarian) => <option key={veterinarian.id} value={veterinarian.id}>{veterinarian.person.firstName} {veterinarian.person.lastName}</option>)}</select></label>
            <label className="field"><span>Justificación</span><input value={justificacion} onChange={(event) => setJustificacion(event.target.value)} /></label>
            <button type="button" className="button button--primary" onClick={substitute}>Sustituir</button>
          </div>
        </div>
      )}

      <div className="catalog-card work-schedules-card">
        <div className="catalog-card__heading"><h3>Turnos registrados</h3></div>
        {shifts.length === 0 ? <div className="empty-state">No hay turnos registrados.</div> : (
          <div className="product-table-wrap">
            <table className="product-table work-schedules-table" aria-label="Turnos de sábado">
              <thead><tr><th>Fecha</th><th>Sucursal</th><th>Veterinario</th><th>Jornada</th><th>Justificación</th></tr></thead>
              <tbody>{shifts.map((shift) => <tr key={shift.id}><td>{shift.fecha}</td><td>{shift.sucursalNombre}</td><td>{shift.veterinarioNombre}</td><td>{shift.horaInicio}–{shift.horaFin}</td><td>{shift.justificacion ?? '—'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
