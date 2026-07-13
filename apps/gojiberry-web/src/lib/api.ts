import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011/api/v1';

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
  register: (email: string, name: string, password: string, companyName?: string) =>
    api.post('/auth/register', { email, name, password, companyName }),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
};

export const icpApi = {
  create: (prompt: string) => api.post('/icp', { prompt }),
  list: () => api.get('/icp'),
  get: (id: string) => api.get(`/icp/${id}`),
};

export const leadsApi = {
  generate: (icpProfileId: string, count?: number) =>
    api.post('/leads/generate', { icpProfileId, count }),
  sourceReal: (domains: string[], opts?: { icpProfileId?: string; department?: string; seniority?: string }) =>
    api.post('/leads/source-real', { domains, ...opts }),
  list: (icpProfileId?: string) => api.get('/leads', { params: icpProfileId ? { icpProfileId } : {} }),
  get: (id: string) => api.get(`/leads/${id}`),
};

export const signalsApi = {
  list: (leadId: string) => api.get(`/leads/${leadId}/signals`),
  refresh: (leadId: string) => api.post(`/leads/${leadId}/signals/refresh`),
};

export const messagesApi = {
  generate: (leadId: string, campaignId?: string) =>
    api.post('/messages/generate', { leadId, campaignId }),
  list: (leadId?: string) => api.get('/messages', { params: leadId ? { leadId } : {} }),
  update: (id: string, data: { subject?: string; body?: string }) =>
    api.patch(`/messages/${id}`, data),
  send: (id: string) => api.post(`/messages/${id}/send`),
};

export const campaignsApi = {
  create: (data: { name: string; icpProfileId?: string; steps: any[] }) =>
    api.post('/campaigns', data),
  list: () => api.get('/campaigns'),
  get: (id: string) => api.get(`/campaigns/${id}`),
  setStatus: (id: string, status: string) => api.patch(`/campaigns/${id}/status`, { status }),
  enroll: (id: string, leadIds: string[]) => api.post(`/campaigns/${id}/enroll`, { leadIds }),
};
