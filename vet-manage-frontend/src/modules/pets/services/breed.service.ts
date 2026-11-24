import { getJson, patchJson, postJson } from '../../../infrastructure/api/http-client';
import type { Breed, RegisterBreedDraft, SpeciesOption } from '../types';

export const breedApi = {
  listBreeds() {
    return getJson<Breed[]>('/pets/breeds');
  },
  registerBreed(draft: RegisterBreedDraft) {
    return postJson<Breed, RegisterBreedDraft>('/pets/breeds', draft);
  },
  updateBreed(id: string, draft: RegisterBreedDraft) {
    return patchJson<Breed, RegisterBreedDraft>(`/pets/breeds/${encodeURIComponent(id)}`, draft);
  },
  // Razas activas de una especie, para el selector del registro de pacientes.
  listActiveBreeds(speciesId: string) {
    return getJson<SpeciesOption[]>(`/pets/species/${encodeURIComponent(speciesId)}/breeds`);
  },
};
