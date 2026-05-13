import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string) || '/api',
  timeout: 10000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('qt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auth
export const authApi = {
  login: (badge_id: string, pin: string) =>
    api.post('/auth/login', { badge_id, pin }).then(r => r.data),
  validateBadge: (badge_id: string) =>
    api.post('/auth/validate-badge', { badge_id }).then(r => r.data),
};

// Users
export const usersApi = {
  list: () => api.get('/users').then(r => r.data),
  create: (data: { name: string; badge_id: string; role: string; pin?: string }) =>
    api.post('/users', data).then(r => r.data),
  update: (id: number, data: Partial<{ name: string; badge_id: string; role: string; pin: string; active: boolean }>) =>
    api.put(`/users/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/users/${id}`).then(r => r.data),
};

// Operations
export const operationsApi = {
  list: () => api.get('/operations').then(r => r.data),
  listAll: () => api.get('/operations', { params: { all: '1' } }).then(r => r.data),
  get: (id: number) => api.get(`/operations/${id}`).then(r => r.data),
  getFields: (id: number, part_number: string) =>
    api.get(`/operations/${id}/fields`, { params: { part_number } }).then(r => r.data),
  create: (data: { code: string; name: string; description?: string }) =>
    api.post('/operations', data).then(r => r.data),
  update: (id: number, data: Partial<{ code: string; name: string; description: string; active: boolean }>) =>
    api.put(`/operations/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/operations/${id}`).then(r => r.data),
};

// Fields (templates)
export const fieldsApi = {
  list: (operation_id?: number, part_number?: string) =>
    api.get('/fields', { params: { operation_id, part_number } }).then(r => r.data),
  listTemplates: () => api.get('/fields/templates').then(r => r.data),
  create: (data: {
    part_number: string; operation_id: number; name: string; description?: string;
    unit?: string; nominal_value?: number | null; min_value: number; max_value: number; order_index?: number;
  }) => api.post('/fields', data).then(r => r.data),
  update: (id: number, data: Partial<{
    name: string; description: string; unit: string;
    nominal_value: number | null; min_value: number; max_value: number; order_index: number; active: boolean;
  }>) => api.put(`/fields/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/fields/${id}`).then(r => r.data),
  copy: (data: { source_part: string; source_operation_id: number; target_part: string }) =>
    api.post('/fields/copy', data).then(r => r.data),
};

// Inspections
export const inspectionsApi = {
  start: (data: { job_number: string; part_number: string; operation_id: number; operator_badge?: string }) =>
    api.post('/inspections', data).then(r => r.data),
  get: (id: number) => api.get(`/inspections/${id}`).then(r => r.data),
  measure: (id: number, field_id: number, value: number) =>
    api.put(`/inspections/${id}/measure`, { field_id, value }).then(r => r.data),
  validate: (id: number, badge_id: string) =>
    api.post(`/inspections/${id}/validate`, { badge_id }).then(r => r.data),
};

// Reports
export const reportsApi = {
  listInspections: (params?: { from?: string; to?: string; status?: string; operation_id?: number; limit?: number; offset?: number }) =>
    api.get('/reports/inspections', { params }).then(r => r.data),
  getInspection: (id: number) => api.get(`/reports/inspections/${id}`).then(r => r.data),
  deleteInspection: (id: number) => api.delete(`/reports/inspections/${id}`).then(r => r.data),
};

export default api;
