import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({ baseURL: API_URL });

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (typeof window !== 'undefined') localStorage.setItem('token', token);
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (typeof window !== 'undefined') localStorage.removeItem('token');
  }
}

if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export const authApi = {
  register: (email: string, name: string, password: string) =>
    api.post('/auth/register', { email, name, password }),
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
};

export const meetingsApi = {
  create: (data: any) => api.post('/meetings', data),
  list: () => api.get('/meetings'),
  get: (id: string) => api.get(`/meetings/${id}`),
  update: (id: string, data: any) => api.patch(`/meetings/${id}`, data),
  cancel: (id: string) => api.delete(`/meetings/${id}`),
  confirm: (id: string, slotStart: string) =>
    api.post(`/meetings/${id}/confirm`, { slotStart }),
  getSlots: (id: string) => api.get(`/meetings/${id}/slots`),
  addParticipant: (id: string, email: string, name?: string) =>
    api.post(`/meetings/${id}/participants`, { email, name }),
  removeParticipant: (id: string, participantId: string) =>
    api.delete(`/meetings/${id}/participants/${participantId}`),
  resendInvite: (id: string, participantId: string) =>
    api.post(`/meetings/${id}/participants/${participantId}/resend`),
};

export const inviteApi = {
  getDetails: (token: string) => api.get(`/invite/${token}`),
  decline: (token: string) => api.post(`/invite/${token}/decline`),
};

export const calendarsApi = {
  list: () => api.get('/calendars'),
  remove: (id: string) => api.delete(`/calendars/${id}`),
  getGoogleAuthUrl: (configId?: string) =>
    api.get('/calendars/auth/google', { params: configId ? { configId } : {} }),
  getMicrosoftAuthUrl: (configId?: string) =>
    api.get('/calendars/auth/microsoft', { params: configId ? { configId } : {} }),
};

export const oauthConfigsApi = {
  list: (provider?: 'GOOGLE' | 'MICROSOFT') =>
    api.get('/oauth-configs', { params: provider ? { provider } : {} }),
  create: (data: { provider: 'GOOGLE' | 'MICROSOFT'; label: string; clientId: string; clientSecret: string; isDefault?: boolean }) =>
    api.post('/oauth-configs', data),
  setDefault: (id: string) => api.post(`/oauth-configs/${id}/default`),
  remove: (id: string) => api.delete(`/oauth-configs/${id}`),
};
