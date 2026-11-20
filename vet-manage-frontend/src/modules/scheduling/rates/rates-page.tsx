import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../../infrastructure/api/http-client';
import { useAuth } from '../../auth/auth-context';
import { schedulingApi } from '../services/scheduling-api';
import type { Branch, ClinicService } from '../types';
import { ratesApi, type Rate } from './rates-api';

export const INVALID_RATE_MESSAGE = 'Ingrese un importe mayor a cero con hasta dos decimales';
export const REQUIRED_RATE_MESSAGE = 'El campo tarifa es obligatorio';
export const FORBIDDEN_RATE_MESSAGE = 'No tiene permisos para esta acción';

export function RatesPage() {
  const { hasPermission } = useAuth();
  const canRead = hasPermission('rates:read');
  const canManage = hasPermission('rates:manage');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<ClinicService[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [branchId, setBranchId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!canRead) return;
    void Promise.all([schedulingApi.listBranches(), schedulingApi.listServices(), ratesApi.list()])
      .then(([branchItems, serviceItems, rateItems]) => {
        setBranches(branchItems);
        setServices(serviceItems);
        setRates(rateItems);
        if (branchItems[0]) setBranchId(branchItems[0].id);
        if (serviceItems[0]) setServiceId(serviceItems[0].id);
      })
      .catch((cause: unknown) => setError(cause instanceof ApiError && cause.status === 403
        ? FORBIDDEN_RATE_MESSAGE
        : cause instanceof Error ? cause.message : 'No se pudo cargar el catálogo de tarifas'));
  }, [canRead]);

  const filteredRates = useMemo(() => rates
    .filter((rate) => (!branchId || rate.sucursalId === branchId)
      && (!serviceId || rate.servicioId === serviceId)),
  [branchId, rates, serviceId]);

  function parseAmount(raw: string): number | null {
    if (raw.trim() === '') {
      setError(REQUIRED_RATE_MESSAGE);
      return null;
    }
    const normalized = raw.trim().replace(',', '.');
    if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      setError(INVALID_RATE_MESSAGE);
      return null;
    }
    const decimalPart = normalized.includes('.') ? normalized.split('.')[1] : '';
    if (decimalPart.length > 2) {
      setError(INVALID_RATE_MESSAGE);
      return null;
    }
    const value = Number(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      setError(INVALID_RATE_MESSAGE);
      return null;
    }
    return value;
  }

  async function save() {
    setError('');
    setMessage('');
    if (!canManage) {
      setError(FORBIDDEN_RATE_MESSAGE);
      return;
    }
    if (!branchId || !serviceId) return;
    const value = parseAmount(amount);
    if (value === null) return;
    const active = filteredRates.find((rate) => rate.estado);
    try {
      const saved = active
        ? await ratesApi.update(active.id, value)
        : await ratesApi.save({ servicioId: serviceId, sucursalId: branchId, importe: value });
      setRates((current) => active
        ? current.map((rate) => rate.id === active.id ? { ...rate, estado: false } : rate).concat(saved)
        : [...current, saved]);
      setAmount('');
      setMessage('Tarifa guardada correctamente');
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403
        ? FORBIDDEN_RATE_MESSAGE
        : cause instanceof Error ? cause.message : 'No se pudo guardar la tarifa');
    }
  }

  async function deactivateService() {
    if (!canManage) {
      setError(FORBIDDEN_RATE_MESSAGE);
      return;
    }
    if (!serviceId) return;
    try {
      await ratesApi.deactivateService(serviceId);
      setServices((current) => current.filter((service) => service.id !== serviceId));
      setServiceId('');
      setMessage('Servicio inactivado correctamente');
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403
        ? FORBIDDEN_RATE_MESSAGE
        : cause instanceof Error ? cause.message : 'No se pudo inactivar el servicio');
    }
  }

  if (!canRead) {
    return <section className="empty-page" role="alert"><h2>{FORBIDDEN_RATE_MESSAGE}</h2></section>;
  }

  return (
    <section className="scheduling-page">
      <div className="page-heading">
        <div><span className="eyebrow">Agenda</span><h2>Tarifas</h2><p>Mantenga el catálogo de tarifas por sucursal y servicio.</p></div>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <div className="rates-filters">
        <label className="field"><span>Sucursal</span>
          <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.nombre}</option>)}
          </select>
        </label>
        <label className="field"><span>Servicio</span>
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            {services.map((service) => <option key={service.id} value={service.id}>{service.nombre}</option>)}
          </select>
        </label>
      </div>
      {canManage && (
        <div className="rates-form">
          <label className="field"><span>Tarifa USD</span>
            <input aria-label="Tarifa" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="20.00" />
          </label>
          <button type="button" className="button button--primary" onClick={() => void save()}>Guardar</button>
          <button type="button" className="button button--ghost" onClick={() => void deactivateService()}>Inactivar servicio</button>
        </div>
      )}
      <div className="simple-list">
        {filteredRates.map((rate) => (
          <div className="simple-list__item" key={rate.id}>
            <div className="list-copy">
              <strong>{rate.sucursal.nombre} · {rate.servicio.nombre}</strong>
              <small>USD {Number(rate.importe).toFixed(2)} · {rate.estado ? 'Activa' : 'Inactiva'}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
