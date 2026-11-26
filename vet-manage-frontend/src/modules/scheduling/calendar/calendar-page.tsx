import { useEffect, useRef, useState } from "react";
import { calendarApi } from "./calendar-api";
import {
  dateLabel,
  localDate,
  navigateDate,
  periodDays,
  shiftDate,
  timeLabel,
} from "./calendar-dates";
import type {
  AppointmentDetail,
  AppointmentStatus,
  CalendarAppointment,
  CalendarBranch,
  CalendarData,
  CalendarView,
  ReservationSelection,
} from "./types";
import "./calendar.css";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  PROGRAMADA: "Programada",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  FINALIZADA: "Finalizada",
  CANCELADA: "Cancelada",
  NO_ASISTIO: "No asistió",
};
function Badge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`calendar-status calendar-status--${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
function Appointment({
  appointment,
  open,
}: {
  appointment: CalendarAppointment;
  open: () => void;
}) {
  return (
    <button className="calendar-appointment" onClick={open}>
      <strong>Cita #{appointment.numero}</strong>
      <span>
        {timeLabel(appointment.inicio)}–{timeLabel(appointment.fin)}
      </span>
      {localDate(new Date(appointment.inicio)) !==
        localDate(new Date(appointment.fin)) && (
        <small>
          {dateLabel(localDate(new Date(appointment.inicio)))} –{" "}
          {dateLabel(localDate(new Date(appointment.fin)))}
        </small>
      )}
      <span>Paciente: {appointment.paciente}</span>
      <span>Veterinario: {appointment.veterinario}</span>
      <Badge status={appointment.estado} />
    </button>
  );
}

export function CalendarPage() {
  const [branches, setBranches] = useState<CalendarBranch[]>([]);
  const [branch, setBranch] = useState("");
  const [date, setDate] = useState(localDate);
  const [view, setView] = useState<CalendarView>("dia");
  const [filter, setFilter] = useState<AppointmentStatus | "">("");
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [detailError, setDetailError] = useState("");
  const [selection, setSelection] = useState<ReservationSelection | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef(0);
  const detailTrigger = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let active = true;
    calendarApi
      .branches()
      .then((items) => {
        if (active) {
          setBranches(items);
          setBranch(items[0]?.id ?? "");
          if (!items.length) setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las sucursales",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [retry]);

  useEffect(() => {
    if (!branch || !date) return;
    let active = true;
    calendarApi
      .read(branch, date, view)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo cargar el calendario",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [branch, date, view, revision]);

  function clear() {
    setRevision((v) => v + 1);
    setData(null);
    setError("");
    setLoading(true);
    setSelection(null);
    requestId.current += 1;
    dialog.current?.close();
  }
  async function openDetail(id: string) {
    const current = ++requestId.current;
    detailTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDetail(null);
    setDetailError("");
    dialog.current?.showModal();
    try {
      const result = await calendarApi.detail(id, branch);
      if (current === requestId.current) setDetail(result);
    } catch (e) {
      if (current === requestId.current)
        setDetailError(
          e instanceof Error ? e.message : "No se pudo cargar el detalle",
        );
    }
  }
  const days = data ? periodDays(data.desde, data.hastaExclusiva) : [];
  const visible =
    data?.citas.filter((c) => !filter || c.estado === filter) ?? [];
  const offset = days.length
    ? (new Date(`${days[0]}T12:00:00Z`).getUTCDay() + 6) % 7
    : 0;

  return (
    <main className="calendar-page">
      <h1>Calendario de citas</h1>
      <p>Consulta por sucursal · Hora de Ecuador (America/Guayaquil)</p>
      <div className="calendar-controls">
        <label>
          Sucursal
          <select
            value={branch}
            onChange={(e) => {
              clear();
              setBranch(e.target.value);
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
                {b.estado ? "" : " (inactiva)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha
          <input
            type="date"
            required
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                clear();
                setDate(e.target.value);
              }
            }}
          />
        </label>
        <label>
          Vista
          <select
            value={view}
            onChange={(e) => {
              clear();
              setView(e.target.value as CalendarView);
            }}
          >
            <option value="dia">Día</option>
            <option value="semana">Semana</option>
            <option value="mes">Mes</option>
          </select>
        </label>
        <label>
          Estado
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as AppointmentStatus | "")
            }
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <nav className="calendar-controls" aria-label="Navegación del calendario">
        <button
          onClick={() => {
            clear();
            setDate(navigateDate(date, view, -1));
          }}
        >
          Anterior
        </button>
        <button
          onClick={() => {
            clear();
            setDate(localDate());
          }}
        >
          Hoy
        </button>
        <button
          onClick={() => {
            clear();
            setDate(navigateDate(date, view, 1));
          }}
        >
          Siguiente
        </button>
      </nav>
      <div className="calendar-legend" aria-label="Leyenda de estados">
        {(Object.keys(STATUS_LABELS) as AppointmentStatus[]).map((status) => (
          <Badge key={status} status={status} />
        ))}
      </div>
      {loading && <p role="status">Cargando calendario…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button
            onClick={() => {
              clear();
              if (!branch) setRetry((v) => v + 1);
            }}
          >
            Reintentar
          </button>
        </p>
      )}
      {!loading && !error && !branches.length && (
        <p>No hay sucursales para consultar.</p>
      )}
      {data && (
        <>
          <h2>
            {dateLabel(data.desde)} –{" "}
            {dateLabel(shiftDate(data.hastaExclusiva, -1))}
          </h2>
          <p>
            Las franjas no cambian al filtrar citas. Se necesita un veterinario
            y un consultorio libres.
          </p>
          {!visible.length && (
            <p role="status">No hay citas para los filtros seleccionados.</p>
          )}
          <div className={`calendar-days calendar-days--${view}`}>
            {view === "mes" &&
              ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
                <div className="calendar-weekday" key={day}>
                  {day}
                </div>
              ))}
            {view === "mes" &&
              Array.from({ length: offset }, (_, i) => (
                <div
                  className="calendar-spacer"
                  key={`empty-${i}`}
                  aria-hidden="true"
                />
              ))}
            {days.map((day) => {
              const start = new Date(`${day}T00:00:00-05:00`).getTime();
              const appointments = visible.filter(
                (c) =>
                  new Date(c.inicio).getTime() < start + 86400000 &&
                  new Date(c.fin).getTime() > start,
              );
              return (
                <section
                  className="calendar-day"
                  key={day}
                  aria-label={dateLabel(day)}
                >
                  <h3>{dateLabel(day)}</h3>
                  {appointments.map((c) => (
                    <Appointment
                      key={c.id}
                      appointment={c}
                      open={() => void openDetail(c.id)}
                    />
                  ))}
                  {!appointments.length && (
                    <p className="calendar-empty">Sin citas visibles</p>
                  )}
                  <details open={view === "dia"}>
                    <summary>Franjas del día</summary>
                    <ul className="calendar-slots">
                      {data.franjas
                        .filter((s) => s.fecha === day)
                        .map((slot) => (
                          <li key={slot.inicio}>
                            <button
                              disabled={slot.estado !== "Disponible"}
                              onClick={() =>
                                setSelection({
                                  sucursalId: branch,
                                  inicio: slot.inicio,
                                  fin: slot.fin,
                                })
                              }
                            >
                              {slot.hora} · {slot.estado}
                            </button>
                          </li>
                        ))}
                    </ul>
                  </details>
                </section>
              );
            })}
          </div>
        </>
      )}
      {selection && (
        <aside className="calendar-reservation" role="status">
          <strong>
            Franja seleccionada:{" "}
            {dateLabel(localDate(new Date(selection.inicio)))}{" "}
            {timeLabel(selection.inicio)}–{timeLabel(selection.fin)}
          </strong>
          <p>
            El flujo de reserva aún no está implementado. No se ha creado ni
            reservado una cita. La disponibilidad deberá comprobarse nuevamente
            al reservar.
          </p>
          <button onClick={() => setSelection(null)}>Cerrar aviso</button>
        </aside>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="calendar-detail-title"
        onClose={() => {
          requestId.current += 1;
          detailTrigger.current?.focus();
        }}
      >
        <h2 id="calendar-detail-title">
          Detalle de cita{detail ? ` #${detail.numero}` : ""}
        </h2>
        {!detail && !detailError && <p role="status">Cargando detalle…</p>}
        {detailError && <p role="alert">{detailError}</p>}
        {detail && (
          <>
            <Badge status={detail.estado} />
            <dl>
              {Object.entries({
                Inicio: `${dateLabel(localDate(new Date(detail.inicio)))} ${timeLabel(detail.inicio)}`,
                Fin: `${dateLabel(localDate(new Date(detail.fin)))} ${timeLabel(detail.fin)}`,
                Paciente: detail.paciente,
                Veterinario: detail.veterinario,
                Cliente: detail.cliente,
                Cédula: detail.cedula,
                Consultorio: detail.consultorio,
                Sucursal: detail.sucursal,
              }).map(([key, value]) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <button autoFocus onClick={() => dialog.current?.close()}>
          Cerrar detalle
        </button>
      </dialog>
    </main>
  );
}
