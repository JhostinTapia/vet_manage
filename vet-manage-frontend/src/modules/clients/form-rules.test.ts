import { describe, expect, it } from 'vitest';
import { ApiError } from '../../infrastructure/api/http-client';
import {
  buildClientInput, describeApiError, INVALID_ADDRESS, INVALID_EMAIL, INVALID_IDENTIFICATION, INVALID_PHONE,
  MAIL_FAILED, MISSING_FIELDS, registrationOutcome, validateRegistration,
} from './form-rules';
import type { Form } from './form-rules';

const valid: Form = {
  identification: '1710034065',
  firstName: 'María',
  lastName: 'López',
  email: 'maria@clinica.com',
  phone: '0991234567',
  address: '',
};

const COMBINED_MESSAGE = 'Por favor, ingrese un correo y número de teléfono válido';

describe('validateRegistration', () => {
  it('no reporta errores con los datos completos', () => {
    expect(validateRegistration(valid)).toEqual({ errors: {}, missing: false });
  });

  it('marca los campos obligatorios vacíos, incluido el teléfono', () => {
    const { errors, missing } = validateRegistration({ ...valid, phone: '  ', firstName: '  ', email: '  ' });

    expect(missing).toBe(true);
    expect(errors).toEqual({ firstName: MISSING_FIELDS, email: MISSING_FIELDS, phone: MISSING_FIELDS });
  });

  it('rechaza una cédula corta o con verificador incorrecto', () => {
    for (const identification of ['11045', '1104567890']) {
      const { errors, missing } = validateRegistration({ ...valid, identification });

      expect(missing).toBe(false);
      expect(errors.identification).toBe(INVALID_IDENTIFICATION);
    }
  });

  it('rechaza un correo inválido con el mensaje combinado', () => {
    const { errors } = validateRegistration({ ...valid, email: 'ana@clinica' });

    expect(errors.email).toBe(COMBINED_MESSAGE);
  });

  it.each(['099123456', '09912345678', '0123456789', '+593991234567', '12ab'])(
    'rechaza el teléfono inválido %s con el mensaje combinado',
    (phone) => {
      const { errors } = validateRegistration({ ...valid, phone });

      expect(errors.phone).toBe(COMBINED_MESSAGE);
    },
  );

  it('acepta un teléfono de 10 dígitos con prefijo 09', () => {
    expect(validateRegistration({ ...valid, phone: '0999999999' }).errors).toEqual({});
  });

  it('rechaza una dirección que supera el máximo permitido', () => {
    expect(validateRegistration({ ...valid, address: 'a'.repeat(256) }).errors.address).toBe(INVALID_ADDRESS);
  });

  it('acepta una dirección de 255 caracteres', () => {
    expect(validateRegistration({ ...valid, address: 'a'.repeat(255) }).errors).toEqual({});
  });
});

describe('buildClientInput', () => {
  it('recorta los datos, omite la dirección vacía y envía siempre el teléfono y el rol cliente', () => {
    expect(buildClientInput({ ...valid, address: '  ' })).toEqual({
      identification: '1710034065',
      firstName: 'María',
      lastName: 'López',
      email: 'maria@clinica.com',
      phone: '0991234567',
      address: undefined,
      roles: ['client'],
    });
  });

  it('incluye la dirección cuando se ingresa', () => {
    const input = buildClientInput({ ...valid, phone: ' 0991234567 ', address: ' Av. Amazonas 123 ' });

    expect(input.phone).toBe('0991234567');
    expect(input.address).toBe('Av. Amazonas 123');
    expect(input.roles).toEqual(['client']);
  });
});

describe('describeApiError', () => {
  it('resalta la cédula o el correo según el código de la API', () => {
    const duplicated = new ApiError('Número de cédula ya registrado', 409, { code: 'CLIENT_IDENTIFICATION_TAKEN' });
    const taken = new ApiError('El correo ya se encuentra registrado', 409, { code: 'CLIENT_EMAIL_TAKEN' });

    expect(describeApiError(duplicated)).toEqual({ message: duplicated.message, errors: { identification: duplicated.message } });
    expect(describeApiError(taken).errors).toEqual({ email: taken.message });
  });

  it('usa el mensaje combinado para errores de correo y teléfono', () => {
    const invalidEmail = new ApiError('Ingrese un correo electrónico válido', 400, { code: 'CLIENT_INVALID_EMAIL' });
    const invalidPhone = new ApiError('Ingrese un teléfono válido', 400, { code: 'CLIENT_INVALID_PHONE' });

    expect(describeApiError(invalidEmail)).toEqual({ message: INVALID_EMAIL, errors: { email: INVALID_EMAIL } });
    expect(describeApiError(invalidPhone)).toEqual({ message: INVALID_PHONE, errors: { phone: INVALID_PHONE } });
  });

  it('resalta dirección y nombres según el código de la API', () => {
    const address = new ApiError(INVALID_ADDRESS, 400, { code: 'CLIENT_INVALID_ADDRESS' });
    const name = new ApiError('Los nombres y apellidos no pueden superar 100 caracteres', 400, { code: 'CLIENT_INVALID_NAME' });

    expect(describeApiError(address).errors).toEqual({ address: INVALID_ADDRESS });
    expect(describeApiError(name).errors).toEqual({ firstName: name.message, lastName: name.message });
  });

  it('resalta los campos que la API lista en errors', () => {
    const error = new ApiError(MISSING_FIELDS, 400, { code: 'CLIENT_MISSING_FIELDS', errors: ['email', 'phone', 'otro'] });

    expect(describeApiError(error).errors).toEqual({ email: MISSING_FIELDS, phone: MISSING_FIELDS });
  });

  it('informa de la falta de conexión ante un error desconocido', () => {
    expect(describeApiError(new TypeError('Failed to fetch'))).toEqual({
      message: 'No se pudo conectar con el servidor. Intente nuevamente.',
      errors: {},
    });
  });
});

describe('registrationOutcome', () => {
  it('muestra el mensaje exacto cuando se enviaron las credenciales', () => {
    expect(registrationOutcome({ existingPerson: false, passwordAssigned: true, credentialsSent: true })).toEqual({
      type: 'success',
      message: 'Cliente registrado exitosamente',
    });
  });

  it('advierte cuando no se pudo enviar el correo', () => {
    expect(registrationOutcome({ existingPerson: false, passwordAssigned: true, credentialsSent: false })).toEqual({
      type: 'warning',
      message: MAIL_FAILED,
    });
  });

  it('muestra el mismo mensaje al reutilizar una persona existente', () => {
    expect(registrationOutcome({ existingPerson: true, passwordAssigned: false, credentialsSent: false })).toEqual({
      type: 'success',
      message: 'Cliente registrado exitosamente',
    });
  });
});
