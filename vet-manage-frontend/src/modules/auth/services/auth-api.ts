import { getJson, postJson } from '../../../infrastructure/api/http-client';
import type { ChangePasswordInput, LoginCredentials, LoginResult, SessionProfile } from '../types';

export const authApi = {
  login(credentials: LoginCredentials) {
    return postJson<LoginResult, LoginCredentials>('/auth/login', credentials);
  },
  logout() {
    return postJson<null, Record<string, never>>('/auth/logout', {});
  },
  me() {
    return getJson<SessionProfile>('/auth/me');
  },
  changePassword(input: ChangePasswordInput) {
    return postJson<null, ChangePasswordInput>('/auth/change-password', input);
  },
};
