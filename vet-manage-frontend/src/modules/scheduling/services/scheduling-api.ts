import { getJson, postJson, putJson, deleteJson } from '../../../infrastructure/api/http-client';
import type { Branch, ClinicService, WorkSchedule, WorkScheduleFormData, VeterinarianOption } from '../types';

export const schedulingApi = {
  listBranches() {
    return getJson<Branch[]>('/scheduling/branches');
  },
  listServices() {
    return getJson<ClinicService[]>('/scheduling/services');
  },
  listWorkSchedules(params?: { veterinarioId?: string; sucursalId?: string }) {
    const query = new URLSearchParams();
    if (params?.veterinarioId) query.set('veterinarioId', params.veterinarioId);
    if (params?.sucursalId) query.set('sucursalId', params.sucursalId);
    const qs = query.toString();
    return getJson<WorkSchedule[]>(`/scheduling/work-schedules${qs ? `?${qs}` : ''}`);
  },
  listVeterinarians() {
    return getJson<VeterinarianOption[]>('/scheduling/work-schedules/veterinarians');
  },
  createWorkSchedule(data: WorkScheduleFormData) {
    return postJson<WorkSchedule, WorkScheduleFormData>('/scheduling/work-schedules', data);
  },
  updateWorkSchedule(id: string, data: Partial<WorkScheduleFormData>) {
    return putJson<WorkSchedule, Partial<WorkScheduleFormData>>(`/scheduling/work-schedules/${id}`, data);
  },
  deleteWorkSchedule(id: string) {
    return deleteJson<void>(`/scheduling/work-schedules/${id}`);
  },
};
