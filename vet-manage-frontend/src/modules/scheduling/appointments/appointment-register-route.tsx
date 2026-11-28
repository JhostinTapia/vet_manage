import { useNavigate } from 'react-router-dom';
import { AppointmentRegisterPage } from './appointment-register-page';

// Registro de cita abierto desde la lista de citas.
export function AppointmentRegisterRoute() {
  const navigate = useNavigate();
  return <AppointmentRegisterPage onBack={() => navigate('/appointments/appointments')} backLabel="Volver a citas" />;
}
