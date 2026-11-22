import { ACCENT_EQUIVALENTS, MAX_SEARCH_VARIANTS } from '../../../clients/repositories/clients.repository.js';
import { normalizeSearch } from './normalize-search.js';

// Reutiliza la tabla de equivalencias de HU-06 para no tener dos criterios
// distintos de "sin tildes" entre clientes y pacientes.
export function patientSearchVariants(search: string): string[] {
  const normalized = normalizeSearch(search);
  let variants = [''];

  for (const char of normalized) {
    const options = ACCENT_EQUIVALENTS[char] ?? [char];
    const next: string[] = [];
    for (const variant of variants) {
      for (const option of options) {
        if (next.length >= MAX_SEARCH_VARIANTS) break;
        next.push(`${variant}${option}`);
      }
      if (next.length >= MAX_SEARCH_VARIANTS) break;
    }
    variants = next;
  }

  return variants;
}
