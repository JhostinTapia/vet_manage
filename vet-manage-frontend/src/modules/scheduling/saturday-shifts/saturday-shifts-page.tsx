import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch, SaturdayShift, WorkSchedule } from '../types';
import {
  formatSaturdayLabel,
  getEligibleVeterinarians,
  getSaturdaysInRange,
  JUSTIFICACION_MAX,
  normalizeSaturdayShift,
  type SaturdayEligible,
} from './saturday-shifts-utils';
import '../work-schedules/work-schedules.css';
import './saturday-shifts.css';

function todayIso(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function SaturdayShiftsPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('saturday-shifts:manage');
  const canReadWorkSchedules = hasPermission('work-schedules:read');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [workSchedules, setWorkSchedules] = useState<WorkSchedule[]>([]);
  const [replacementSchedules, setReplacementSchedules] = useState<WorkSchedule[]>([]);
  const [shifts, setShifts] = useState<SaturdayShift[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [selectedVeterinarianIds, setSelectedVeterinarianIds] = useState<string[]>([]);
  const [substituteId, setSubstituteId] = useState('');
  const [replacementId, setReplacementId] = useState('');
  const [justificacion, setJustificacion] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [substitutionError, setSubstitutionError] = useState('');
  const [workScheduleError, setWorkScheduleError] = useState('');
  const [replacementScheduleError, setReplacementScheduleError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadShifts = useCallback(async () => {
    try {
      const loaded = await schedulingApi.listSaturdayShifts(sucursalId ? { sucursalId } : undefined);
      setShifts(loaded.map((shift) => normalizeSaturdayShift(shift)).filter((shift): shift is SaturdayShift => Boolean(shift)));
    } catch (cause) {
      showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los turnos.', 'error');
    }
  }, [sucursalId, showToast]);

  useEffect(() => {
    let active = true;
    schedulingApi.listBranches()
      .then((loaded) => { if (active) setBranches(loaded); })
      .catch((cause) => showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los datos.', 'error'));
    return () => { active = false; };
  }, [showToast]);

  useEffect(() => {
    if (!sucursalId) {
      return;
    }
    if (!canReadWorkSchedules) {
      return;
    }
    let active = true;
    schedulingApi.listWorkSchedules({ sucursalId })
      .then((loaded) => { if (active) setWorkSchedules(loaded); })
      .catch((cause) => {
        if (!active) return;
        setWorkSchedules([]);
        setWorkScheduleError(cause instanceof ApiError
          ? cause.message
          : 'No se pudieron cargar los horarios base de esta sucursal.');
      });
    return () => { active = false; };
  }, [sucursalId, canReadWorkSchedules]);

  useEffect(() => {
    let active = true;
    schedulingApi.listSaturdayShifts(sucursalId ? { sucursalId } : undefined)
      .then((loaded) => {
        if (active) setShifts(loaded.map((shift) => normalizeSaturdayShift(shift)).filter((shift): shift is SaturdayShift => Boolean(shift)));
      })
      .catch((cause) => {
        if (active) showToast(cause instanceof ApiError ? cause.message : 'No se pudieron cargar los turnos.', 'error');
      });
    return () => { active = false; };
  }, [sucursalId, showToast]);

  const eligible = useMemo(
    () => getEligibleVeterinarians(workSchedules, sucursalId),
    [workSchedules, sucursalId],
  );

  const rotationVeterinarians = useMemo(
    () => selectedVeterinarianIds
      .map((id) => eligible.find((vet) => vet.id === id))
      .filter((vet): vet is SaturdayEligible => Boolean(vet)),
    [eligible, selectedVeterinarianIds],
  );

  const preview = useMemo(
    () => selectedDates.map((date, index) => ({
      date,
      veterinarian: rotationVeterinarians[index % rotationVeterinarians.length],
    })).filter((item) => Boolean(item.veterinarian)),
    [selectedDates, rotationVeterinarians],
  );

  const canGenerate = Boolean(
    sucursalId &&
    selectedDates.length > 0 &&
    selectedVeterinarianIds.length > 0 &&
    eligible.length > 0 &&
    !generationError,
  );

  const selectedShift = shifts.find((shift) => shift.id === substituteId);
  useEffect(() => {
    if (!selectedShift) {
      return;
    }
    if (!canReadWorkSchedules) {
      return;
    }
    let active = true;
    schedulingApi.listWorkSchedules({ sucursalId: selectedShift.sucursalId })
      .then((loaded) => { if (active) setReplacementSchedules(loaded); })
      .catch((cause) => {
        if (!active) return;
        setReplacementSchedules([]);
        setReplacementScheduleError(cause instanceof ApiError
          ? cause.message
          : 'No se pudieron cargar los horarios base de esta sucursal.');
      });
    return () => { active = false; };
  }, [selectedShift, canReadWorkSchedules]);

  const replacementEligible = useMemo(() => {
    if (!selectedShift) return [];
    return getEligibleVeterinarians(replacementSchedules, selectedShift.sucursalId)
      .filter((vet) => vet.id !== selectedShift.veterinarioId);
  }, [selectedShift, replacementSchedules]);

  function toggleEligibleVeterinarian(id: string) {
    setSelectedVeterinarianIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function updateBranch(value: string) {
    setSucursalId(value);
    setWorkSchedules([]);
    setSelectedVeterinarianIds([]);
    setGenerationError('');
    setWorkScheduleError(value && !canReadWorkSchedules
      ? 'No tiene permiso para consultar los horarios base de los veterinarios.'
      : '');
  }

  function applyRange(from: string, to: string) {
    if (!from || !to) {
      setSelectedDates([]);
      setGenerationError('');
      return;
    }
    if (from > to) {
      setSelectedDates([]);
      setGenerationError('La fecha Desde debe ser anterior o igual a la fecha Hasta.');
      return;
    }
    if (from < todayIso()) {
      setSelectedDates([]);
      setGenerationError('No se pueden generar turnos para fechas pasadas.');
      return;
    }
    const saturdays = getSaturdaysInRange(from, to);
    if (saturdays.length > 12) {
      setSelectedDates([]);
      setGenerationError('El rango no puede incluir más de 12 sábados.');
      return;
    }
    setGenerationError('');
    setSelectedDates(saturdays);
  }

  function moveVeterinarian(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= selectedVeterinarianIds.length) return;
    setSelectedVeterinarianIds((current) => {
      const copy = [...current];
      [copy[index], copy[destination]] = [copy[destination], copy[index]];
      return copy;
    });
  }

  async function generate() {
    if (!canGenerate) return;
    setSaving(true);
    setGenerationError('');
    try {
      await schedulingApi.generateSaturdayShifts({
        sucursalId,
        fechas: selectedDates,
        veterinarioIds: selectedVeterinarianIds,
      });
      showToast('Turnos de sábado generados correctamente', 'success');
      await loadShifts();
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[] };
      setGenerationError(apiError.errors?.length
        ? apiError.errors.join(' ')
        : apiError.message ?? 'No se pudieron generar los turnos.');
    } finally {
      setSaving(false);
    }
  }

  async function substitute() {
    if (!substituteId || !replacementId || !justificacion.trim()) return;
    if (!window.confirm('¿Confirmar la sustitución de este turno?')) return;
    setSaving(true);
    setSubstitutionError('');
    try {
      await schedulingApi.substituteSaturdayShift(substituteId, {
        veterinarioId: replacementId,
        justificacion: justificacion.trim(),
      });
      showToast('Turno sustituido correctamente', 'success');
      setSubstituteId('');
      setReplacementId('');
      setJustificacion('');
      await loadShifts();
    } catch (cause) {
      const apiError = cause as { message?: string; errors?: string[]; citas?: string[] };
      const details = apiError.errors?.length
        ? apiError.errors
        : apiError.citas?.length ? apiError.citas : [];
      setSubstitutionError([apiError.message, ...details].filter(Boolean).join(' · '));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="inventory-page work-schedules-page saturday-shifts-page">
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
          <div className="saturday-generation">
            <div className="work-schedules-filters saturday-generation__basics">
              <label className="field">
                <span>Sucursal</span>
                <select value={sucursalId} onChange={(event) => updateBranch(event.target.value)}>
                  <option value="">Seleccione</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
                </select>
              </label>
              <div />
              <label className="field">
                <span>Desde</span>
                <input type="date" min={todayIso()} value={fromDate} onChange={(event) => {
                  const value = event.target.value;
                  setFromDate(value);
                  applyRange(value, toDate);
                }} />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input type="date" min={fromDate || todayIso()} value={toDate} onChange={(event) => {
                  const value = event.target.value;
                  setToDate(value);
                  applyRange(fromDate, value);
                }} />
              </label>
            </div>

            {generationError && <p className="form-error" role="alert">{generationError}</p>}
            {workScheduleError && <p className="form-error" role="alert">{workScheduleError}</p>}

            {selectedDates.length > 0 && (
              <fieldset className="saturday-selector">
                <legend>Sábados incluidos</legend>
                <div className="saturday-selector__grid">
                  {selectedDates.map((date) => (
                    <label key={date} className="scope-option saturday-date-option">
                      <input
                        className="scope-option__input"
                        type="checkbox"
                        checked={selectedDates.includes(date)}
                        onChange={() => setSelectedDates((current) => current.includes(date)
                          ? current.filter((item) => item !== date)
                          : [...current, date].sort())}
                      />
                      <span className="scope-option__label">{formatSaturdayLabel(date)}</span>
                      <span className="scope-option__check" aria-hidden="true">✓</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            {sucursalId && eligible.length === 0 && !workScheduleError && (
              <p className="form-error" role="alert">Esta sucursal no tiene veterinarios con jornada de sábado</p>
            )}

            {eligible.length > 0 && (
              <div className="saturday-rotation-grid">
                <fieldset className="saturday-selector">
                  <legend>Veterinarios elegibles</legend>
                  <div className="saturday-veterinarian-list">
                    {eligible.map((vet) => (
                      <label key={vet.id} className="scope-option">
                        <input
                          className="scope-option__input"
                          type="checkbox"
                          checked={selectedVeterinarianIds.includes(vet.id)}
                          onChange={() => toggleEligibleVeterinarian(vet.id)}
                        />
                        <span className="scope-option__label">{vet.name} ({vet.jornadas.join(', ')})</span>
                        <span className="scope-option__check" aria-hidden="true">✓</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {rotationVeterinarians.length > 0 && (
                  <fieldset className="saturday-selector">
                    <legend>Orden de rotación</legend>
                    <ol className="saturday-rotation-list">
                      {rotationVeterinarians.map((vet, index) => (
                        <li key={vet.id}>
                          <span><b>{index + 1}</b>. {vet.name} ({vet.jornadas.join(', ')})</span>
                          <span>
                            <button type="button" className="button button--ghost" disabled={index === 0} onClick={() => moveVeterinarian(index, -1)} aria-label={`Subir a ${vet.name}`}>Subir</button>
                            <button type="button" className="button button--ghost" disabled={index === rotationVeterinarians.length - 1} onClick={() => moveVeterinarian(index, 1)} aria-label={`Bajar a ${vet.name}`}>Bajar</button>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </fieldset>
                )}
              </div>
            )}

            {preview.length > 0 && (
              <div className="product-table-wrap saturday-preview">
                <h3>Vista previa</h3>
                <table className="product-table" aria-label="Vista previa de rotación">
                  <thead><tr><th>Sábado</th><th>Veterinario</th></tr></thead>
                  <tbody>{preview.map((item) => (
                    <tr key={item.date}>
                      <td>{formatSaturdayLabel(item.date)}</td>
                      <td>{item.veterinarian.name} ({item.veterinarian.jornadas.join(', ')})</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            <div className="saturday-actions">
              {!canGenerate && (
                <small>Seleccione una sucursal, sábados marcados y al menos un veterinario.</small>
              )}
              <button type="button" className="button button--primary" disabled={!canGenerate || saving} onClick={generate}>
                {saving ? 'Guardando…' : 'Generar y guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {canManage && (
        <div className="catalog-card work-schedules-card">
          <div className="catalog-card__heading"><h3>Sustituir veterinario</h3></div>
          <div className="work-schedules-filters saturday-substitution">
            <label className="field">
              <span>Turno</span>
              <select value={substituteId} onChange={(event) => {
                setSubstituteId(event.target.value);
                setReplacementId('');
                setSubstitutionError('');
                setReplacementSchedules([]);
                setReplacementScheduleError(event.target.value && !canReadWorkSchedules
                  ? 'No tiene permiso para consultar los horarios base de los veterinarios.'
                  : '');
              }}>
                <option value="">Seleccione</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {formatSaturdayLabel(shift.fecha.slice(0, 10))} · {shift.sucursalNombre} · Dr. {shift.veterinarioNombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Reemplazo</span>
              <select value={replacementId} disabled={!selectedShift} onChange={(event) => setReplacementId(event.target.value)}>
                <option value="">Seleccione</option>
                {replacementEligible.map((vet) => (
                  <option key={vet.id} value={vet.id}>{vet.name} ({vet.jornadas.join(', ')})</option>
                ))}
              </select>
            </label>
            {replacementScheduleError && <p className="form-error" role="alert">{replacementScheduleError}</p>}
            {selectedShift && replacementEligible.length === 0 && (
              <p className="form-error" role="alert">No hay otro veterinario con jornada de sábado en esta sucursal</p>
            )}
            <label className="field">
              <span>Justificación</span>
              <textarea
                rows={3}
                maxLength={JUSTIFICACION_MAX}
                value={justificacion}
                onChange={(event) => setJustificacion(event.target.value)}
                aria-invalid={!justificacion.trim() && justificacion.length > 0}
              />
              <small>{justificacion.length}/{JUSTIFICACION_MAX}</small>
              {selectedShift && !justificacion.trim() && <small className="field-error" role="alert">La justificación es obligatoria</small>}
            </label>
          </div>
          {substitutionError && <p className="form-problem" role="alert">{substitutionError}</p>}
          <div className="saturday-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={saving || !substituteId || !replacementId || !justificacion.trim()}
              onClick={substitute}
            >
              {saving ? 'Guardando…' : 'Sustituir'}
            </button>
          </div>
        </div>
      )}

      <div className="catalog-card work-schedules-card">
        <div className="catalog-card__heading"><h3>Turnos registrados</h3></div>
        {shifts.length === 0 ? <div className="empty-state">No hay turnos registrados.</div> : (
          <div className="product-table-wrap">
            <table className="product-table work-schedules-table" aria-label="Turnos de sábado">
              <thead><tr><th>Fecha</th><th>Sucursal</th><th>Veterinario</th><th>Jornada</th><th>Justificación</th></tr></thead>
              <tbody>{shifts.map((shift) => (
                <tr key={shift.id}>
                  <td>{formatSaturdayLabel(shift.fecha.slice(0, 10))}</td>
                  <td>{shift.sucursalNombre}</td>
                  <td>{shift.veterinarioNombre}</td>
                  <td>{shift.horaInicio}–{shift.horaFin}</td>
                  <td>{shift.justificacion ?? '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
