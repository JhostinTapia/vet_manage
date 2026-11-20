import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../auth/auth-context';
import { useToast } from '../../../common/components/toast-context';
import { ApiError } from '../../../infrastructure/api/http-client';
import { schedulingApi } from '../services/scheduling-api';
import type { WorkSchedule, WorkScheduleFormData, VeterinarianOption, Branch, DiaSemana } from '../types';

const DIAS_SEMANA: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

function generateTimeOptions(): string[] {
  const options: string[] = [];
  for (let h = 6; h <= 22; h++) {
    const hh = String(h).padStart(2, '0');
    options.push(`${hh}:00`);
    if (h < 22) {
      options.push(`${hh}:30`);
    }
  }
  return options;
}

const TIME_OPTIONS = generateTimeOptions();

const EMPTY_FORM: WorkScheduleFormData = {
  veterinarioId: '',
  sucursalId: '',
  diaSemana: 'LUNES',
  horaInicio: '',
  horaFin: '',
};

export function WorkSchedulesPage() {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();
  const canManage = hasPermission('work-schedules:manage');

  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [veterinarians, setVeterinarians] = useState<VeterinarianOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterSucursalId, setFilterSucursalId] = useState('');
  const [filterVeterinarioId, setFilterVeterinarioId] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkScheduleFormData>({ ...EMPTY_FORM });

  const loadSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const params: { veterinarioId?: string; sucursalId?: string } = {};
      if (filterVeterinarioId) params.veterinarioId = filterVeterinarioId;
      if (filterSucursalId) params.sucursalId = filterSucursalId;
      const data = await schedulingApi.listWorkSchedules(params);
      setSchedules(data);
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [filterVeterinarioId, filterSucursalId, showToast]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  useEffect(() => {
    Promise.all([
      schedulingApi.listBranches(),
      schedulingApi.listVeterinarians(),
    ]).then(([b, v]) => {
      setBranches(b);
      setVeterinarians(v);
    }).catch((err) => {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    });
  }, [showToast]);

  const openCreateModal = useCallback(() => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((schedule: WorkSchedule) => {
    setEditingId(schedule.id);
    setForm({
      veterinarioId: schedule.veterinarioId,
      sucursalId: schedule.sucursalId,
      diaSemana: schedule.diaSemana,
      horaInicio: schedule.horaInicio,
      horaFin: schedule.horaFin,
    });
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate required fields
    if (!form.veterinarioId || !form.sucursalId || !form.diaSemana || !form.horaInicio || !form.horaFin) {
      showToast('Todos los campos son obligatorios', 'error');
      return;
    }

    // Validate horaFin > horaInicio
    if (form.horaFin <= form.horaInicio) {
      showToast('La hora de fin debe ser posterior a la hora de inicio', 'error');
      return;
    }

    try {
      if (editingId) {
        await schedulingApi.updateWorkSchedule(editingId, form);
        showToast('Horario actualizado exitosamente', 'success');
      } else {
        await schedulingApi.createWorkSchedule(form);
        showToast('Horario creado exitosamente', 'success');
      }
      closeModal();
      await loadSchedules();
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    }
  }, [form, editingId, closeModal, loadSchedules, showToast]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('¿Está seguro de retirar este horario?')) return;

    try {
      await schedulingApi.deleteWorkSchedule(id);
      showToast('Horario eliminado exitosamente', 'success');
      await loadSchedules();
    } catch (err) {
      if (err instanceof ApiError) {
        showToast(err.message, 'error');
      } else {
        showToast('Ocurrió un error inesperado', 'error');
      }
    }
  }, [loadSchedules, showToast]);

  return (
    <div>
      <div className="page-header">
        <h1>Horarios Base de Atención</h1>
        {canManage && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            Nuevo horario
          </button>
        )}
      </div>

      <div className="filters-row">
        <select
          className="form-control"
          value={filterSucursalId}
          onChange={(e) => setFilterSucursalId(e.target.value)}
        >
          <option value="">Todas las sucursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>

        <select
          className="form-control"
          value={filterVeterinarioId}
          onChange={(e) => setFilterVeterinarioId(e.target.value)}
        >
          <option value="">Todos los veterinarios</option>
          {veterinarians.map((v) => (
            <option key={v.id} value={v.id}>{v.firstName} {v.lastName}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : schedules.length === 0 ? (
        <p>No hay horarios registrados</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Veterinario</th>
              <th>Día</th>
              <th>Sucursal</th>
              <th>Hora inicio</th>
              <th>Hora fin</th>
              {canManage && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>{s.veterinarioNombre}</td>
                <td>{s.diaSemana}</td>
                <td>{s.sucursalNombre}</td>
                <td>{s.horaInicio}</td>
                <td>{s.horaFin}</td>
                {canManage && (
                  <td>
                    <button className="btn btn-secondary" onClick={() => openEditModal(s)}>
                      Editar
                    </button>
                    <button className="btn btn-danger" onClick={() => handleDelete(s.id)}>
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingId ? 'Editar horario' : 'Nuevo horario'}</h2>

            <div className="form-group">
              <label className="form-label">Veterinario</label>
              <select
                className="form-control"
                value={form.veterinarioId}
                onChange={(e) => setForm({ ...form, veterinarioId: e.target.value })}
              >
                <option value="">Seleccione un veterinario</option>
                {veterinarians.map((v) => (
                  <option key={v.id} value={v.id}>{v.firstName} {v.lastName}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Sucursal</label>
              <select
                className="form-control"
                value={form.sucursalId}
                onChange={(e) => setForm({ ...form, sucursalId: e.target.value })}
              >
                <option value="">Seleccione una sucursal</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Día de la semana</label>
              <select
                className="form-control"
                value={form.diaSemana}
                onChange={(e) => setForm({ ...form, diaSemana: e.target.value as DiaSemana })}
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Hora inicio</label>
              <select
                className="form-control"
                value={form.horaInicio}
                onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
              >
                <option value="">Seleccione hora</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Hora fin</label>
              <select
                className="form-control"
                value={form.horaFin}
                onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
              >
                <option value="">Seleccione hora</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={closeModal}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                {editingId ? 'Guardar cambios' : 'Crear horario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
