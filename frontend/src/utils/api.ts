const API_BASE = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' && window.location.port === '5173'
    ? 'http://localhost:8000/api'
    : '/api');

class ApiClient {
  private token: string | null = localStorage.getItem('access_token');

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('access_token');
    }
  }

  getToken() {
    return this.token;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // Setup headers
    const headers = new Headers(options.headers || {});
    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    
    // Set default content type
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'omit', // We don't need credentials unless calling refresh
    };

    // If calling refresh, we must include cookies
    if (endpoint === '/auth/refresh') {
      config.credentials = 'include';
    }

    let response = await fetch(url, config);

    // If 401 and we have an access token, try refreshing once
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/refresh') {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          this.setToken(refreshData.access_token);
          
          // Retry the original request
          headers.set('Authorization', `Bearer ${refreshData.access_token}`);
          response = await fetch(url, { ...config, headers });
        } else {
          // Refresh failed, clean token and redirect/throw
          this.setToken(null);
          window.location.hash = '#/login';
        }
      } catch (err) {
        this.setToken(null);
        window.location.hash = '#/login';
      }
    }

    if (!response.ok) {
      let errorDetail = 'Có lỗi xảy ra';
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch (e) {
        // Not JSON
      }
      throw new Error(typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail);
    }

    // Check if it's a blob (for Excel export)
    const contentType = response.headers.get('Content-Type');
    if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      return response.blob();
    }

    return response.json();
  }

  get(endpoint: string, headers?: any) {
    return this.request(endpoint, { method: 'GET', headers });
  }

  post(endpoint: string, body: any, headers?: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers,
    });
  }

  put(endpoint: string, body: any, headers?: any) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers,
    });
  }

  delete(endpoint: string, headers?: any) {
    return this.request(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();

// API ENDPOINTS SERVICES

export const authService = {
  login: async (payload: any) => {
    const data = await api.post('/auth/login', payload);
    api.setToken(data.access_token);
    return data;
  },
  logout: async () => {
    try {
      await api.post('/auth/logout', {});
    } finally {
      api.setToken(null);
    }
  },
  me: () => api.get('/auth/me'),
  getOperatorInfo: (operatorId: string) => api.get(`/auth/operator-info/${operatorId}`),
};

export const vehicleService = {
  listTypes: () => api.get('/vehicles/types'),
  createType: (data: any) => api.post('/vehicles/types', data),
  deleteType: (id: number) => api.delete(`/vehicles/types/${id}`),
  list: (params?: { type_id?: number; status_code?: string }) => {
    let url = '/vehicles/list';
    const queryParts = [];
    if (params?.type_id) queryParts.push(`type_id=${params.type_id}`);
    if (params?.status_code) queryParts.push(`status_code=${params.status_code}`);
    if (queryParts.length > 0) url += `?${queryParts.join('&')}`;
    return api.get(url);
  },
  get: (id: string) => api.get(`/vehicles/${id}`),
  create: (data: any) => api.post('/vehicles', data),
  update: (id: string, data: any) => api.put(`/vehicles/${id}`, data),
  delete: (id: string) => api.delete(`/vehicles/${id}`),
};

export const operationService = {
  listChecklists: (vehicleTypeId?: number) => {
    const url = vehicleTypeId ? `/operations/checklist-items?vehicle_type_id=${vehicleTypeId}` : '/operations/checklist-items';
    return api.get(url);
  },
  list: (params?: { vehicle_id?: string; work_date?: string }) => {
    let url = '/operations/list';
    const queryParts = [];
    if (params?.vehicle_id) queryParts.push(`vehicle_id=${params.vehicle_id}`);
    if (params?.work_date) queryParts.push(`work_date=${params.work_date}`);
    if (queryParts.length > 0) url += `?${queryParts.join('&')}`;
    return api.get(url);
  },
  get: (id: number) => api.get(`/operations/${id}`),
  start: (data: any) => api.post('/operations/start', data),
  end: (id: number, data: any) => api.post(`/operations/end/${id}`, data),
};

export const failureService = {
  list: (params?: { vehicle_id?: string; is_repaired?: boolean }) => {
    let url = '/failures/list';
    const query = [];
    if (params?.vehicle_id) query.push(`vehicle_id=${params.vehicle_id}`);
    if (params?.is_repaired !== undefined) query.push(`is_repaired=${params.is_repaired}`);
    if (query.length > 0) url += `?${query.join('&')}`;
    return api.get(url);
  },
  reportDuringShift: (data: any) => {
    const url = `/failures/during-shift?vehicle_id=${data.vehicle_id}&category_id=${data.category_id}&description=${encodeURIComponent(data.description)}&severity=${data.severity}&operation_id=${data.operation_id}&repaired_in_shift=${data.repaired_in_shift}&parts_used=${encodeURIComponent(data.parts_used || '')}&repair_note=${encodeURIComponent(data.repair_note || '')}&failure_time_str=${data.failure_time_str || ''}&repair_start_str=${data.repair_start_str || ''}&repair_end_str=${data.repair_end_str || ''}&repair_option=${data.repair_option || ''}`;
    return api.post(url, {});
  },
  reportOutOfShift: (data: any) => {
    const url = `/failures/out-of-shift?vehicle_id=${data.vehicle_id}&category_id=${data.category_id}&description=${encodeURIComponent(data.description)}&severity=${data.severity}`;
    return api.post(url, {});
  },
  reportBeforeShift: (data: any) => {
    let url = `/failures/before-shift?vehicle_id=${data.vehicle_id}&category_id=${data.category_id}&description=${encodeURIComponent(data.description)}&severity=${data.severity}`;
    if (data.operation_id) {
      url += `&operation_id=${data.operation_id}`;
    }
    return api.post(url, {});
  },
  uploadAttachment: (failureId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/failures/${failureId}/attachments`, formData);
  },
  adminUpdate: (id: number, data: any) => api.put(`/failures/${id}/admin-update`, data),
};

export const repairService = {
  list: (failureId?: number) => {
    const url = failureId ? `/repairs/list?failure_id=${failureId}` : '/repairs/list';
    return api.get(url);
  },
  start: (data: any) => api.post('/repairs/start', data),
  end: (id: number, data: any) => api.post(`/repairs/end/${id}`, data),
  getAssignableOperators: () => api.get('/repairs/assignable-operators'),
  assign: (data: { failure_id: number; mechanic_id: string }) => api.post('/repairs/assign', data),
};

export const dashboardService = {
  summary: () => api.get('/dashboard/summary'),
};

export const settingsService = {
  list: () => api.get('/settings'),
  update: (id: number, value: string) => api.put(`/settings/${id}`, { value }),
};

export const reportsService = {
  metrics: (startDate?: string, endDate?: string) => {
    let url = '/reports/metrics';
    const query = [];
    if (startDate) query.push(`start_date=${startDate}`);
    if (endDate) query.push(`end_date=${endDate}`);
    if (query.length > 0) url += `?${query.join('&')}`;
    return api.get(url);
  },
  analytics: (timeframe: string) => {
    return api.get(`/reports/analytics?timeframe=${timeframe}`);
  },
  exportExcel: async (startDate?: string, endDate?: string) => {
    let url = '/reports/export';
    const query = [];
    if (startDate) query.push(`start_date=${startDate}`);
    if (endDate) query.push(`end_date=${endDate}`);
    if (query.length > 0) url += `?${query.join('&')}`;
    
    const blob = await api.get(url);
    const downloadUrl = window.URL.createObjectURL(blob as Blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `Bao_cao_kpi_doixe_${new Date().toISOString().slice(0, 10)}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
  },
};

export const adminService = {
  listOperators: () => api.get('/admin/operators'),
  createOperator: (data: any) => api.post('/admin/operators', data),
  updateOperator: (id: string, data: any) => api.put(`/admin/operators/${id}`, data),
  deleteOperator: (id: string) => api.delete(`/admin/operators/${id}`),
  
  createChecklistItem: (data: any) => api.post('/admin/checklists', data),
  updateChecklistItem: (id: number, data: any) => api.put(`/admin/checklists/${id}`, data),
  deleteChecklistItem: (id: number) => api.delete(`/admin/checklists/${id}`),
  
  listFailureCategories: () => api.get('/admin/failure-categories'),
  createFailureCategory: (data: any) => api.post('/admin/failure-categories', data),
  updateFailureCategory: (id: number, data: any) => api.put(`/admin/failure-categories/${id}`, data),
  deleteFailureCategory: (id: number) => api.delete(`/admin/failure-categories/${id}`),
  
  listShifts: () => api.get('/admin/shifts'),
  createShift: (data: any) => api.post('/admin/shifts', data),
  updateShift: (id: number, data: any) => api.put(`/admin/shifts/${id}`, data),
  deleteShift: (id: number) => api.delete(`/admin/shifts/${id}`),
  
  listRoles: () => api.get('/admin/roles'),
  listAuditLogs: (params?: { table_name?: string; action?: string; operator_id?: string }) => {
    let url = '/admin/audit-logs';
    const query = [];
    if (params?.table_name) query.push(`table_name=${params.table_name}`);
    if (params?.action) query.push(`action=${params.action}`);
    if (params?.operator_id) query.push(`operator_id=${params.operator_id}`);
    if (query.length > 0) url += `?${query.join('&')}`;
    return api.get(url);
  },
};

export const importService = {
  importActivity: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/imports/activity', formData);
  },
  importChecklist: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/imports/checklist', formData);
  },
  importWeeklyReport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/imports/weekly-report', formData);
  },
  getWeeklyReportHistory: () => {
    return api.get('/imports/weekly-report/history');
  },
  deleteWeeklyReport: (workDate: string) => {
    return api.delete(`/imports/weekly-report/${workDate}`);
  },
};

