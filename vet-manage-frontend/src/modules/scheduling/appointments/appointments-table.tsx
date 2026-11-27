import type { Appointment } from './types';
import { STATUS_LABELS, formatAppointmentDate } from './appointments-utils';

type AppointmentsTableProps = {
  appointments: Appointment[];
  canCancel: boolean;
  onCancel: (appointment: Appointment) => void;
};

export function AppointmentsTable({
  appointments,
  canCancel,
  onCancel,
}: AppointmentsTableProps) {
  return (
    <div className="product-table-wrap">
      <table className="product-table">
        <thead>
          <tr>
            <th>N.º cita</th>
            <th>Paciente</th>
            <th>Fecha y hora</th>
            <th>Sucursal</th>
            <th>Veterinario</th>
            <th>Consultorio</th>
            <th>Pago aprobado</th>
            <th>Estado</th>
            {canCancel && <th>Acciones</th>}
          </tr>
        </thead>

        <tbody>
          {appointments.map((appointment) => (
            <tr key={appointment.id}>
              <td>#{appointment.numero}</td>
              <td>{appointment.paciente}</td>
              <td>
                {formatAppointmentDate(appointment.fechaHora)}
              </td>
              <td>{appointment.sucursal}</td>
              <td>{appointment.veterinario}</td>
              <td>{appointment.sala}</td>
              <td>
                {appointment.tienePagoAprobado ? 'Sí' : 'No'}
              </td>
              <td>
                <span
                  className={`appointment-status appointment-status--${appointment.estado.toLowerCase()}`}
                >
                  {STATUS_LABELS[appointment.estado]}
                </span>
              </td>

              {canCancel && (
                <td>
                  {appointment.estado === 'PROGRAMADA' ? (
                    <button
                      className="button button--ghost"
                      type="button"
                      aria-label={`Cancelar cita ${appointment.numero}`}
                      onClick={() => onCancel(appointment)}
                    >
                      Cancelar
                    </button>
                  ) : (
                    <span>—</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
