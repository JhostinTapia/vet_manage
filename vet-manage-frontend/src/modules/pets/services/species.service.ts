import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { Species, RegisterSpeciesDraft, SpeciesOption } from '../types';

export const speciesApi = {
  listSpecies() {
    return getJson<Species[]>('/pets/species');
  },
  registerSpecies(draft: RegisterSpeciesDraft) {
    return postJson<Species, RegisterSpeciesDraft>('/pets/species', draft);
  },
  updateSpecies(id: string, draft: RegisterSpeciesDraft) {
    return patchJson<Species, RegisterSpeciesDraft>(`/pets/species/${id}`, draft);
  },
  listActiveSpecies() {
    return getJson<SpeciesOption[]>('/pets/species/active');
  },
};
