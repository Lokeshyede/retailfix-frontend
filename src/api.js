import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
};

const api = axios.create({ 
  baseURL: getBaseURL(),
  timeout: 10000 // 10 seconds timeout for mobile networks
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If it's a network error or timeout, we dispatch a custom event
    if (!error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error') {
      window.dispatchEvent(new CustomEvent('network-error', { detail: error.message }));
    }
    return Promise.reject(error);
  }
);

// ── Products ──────────────────────────────────────────────────────────────────
export const getProducts = () => api.get('/products').then(r => r.data);
export const createProduct = (data) => api.post('/products', data).then(r => r.data);
export const updateProduct = (id, data) => api.put(`/products/${id}`, data).then(r => r.data);
export const deleteProduct = (id) => api.delete(`/products/${id}`);

// ── Quotations ────────────────────────────────────────────────────────────────
export const getQuotations = () => api.get('/quotations').then(r => r.data);
export const saveQuotation = (data) => api.post('/quotations', data).then(r => r.data);
export const deleteQuotation = (id) => api.delete(`/quotations/${id}`);
export const getNextQuotationNumber = () => api.get('/quotations/next-number').then(r => r.data);

// ── Customers ─────────────────────────────────────────────────────────────────
export const getCustomers = () => api.get('/customers').then(r => r.data);
export const createCustomer = (data) => api.post('/customers', data).then(r => r.data);
export const updateCustomer = (id, data) => api.put(`/customers/${id}`, data).then(r => r.data);
export const deleteCustomer = (id) => api.delete(`/customers/${id}`);

// ── Backup & Restore ──────────────────────────────────────────────────────────
export const getBackupData = () => api.get('/backup').then(r => r.data);
export const restoreBackupData = (data) => api.post('/restore', data).then(r => r.data);

// ── Product Excel (CSV) Import/Export ─────────────────────────────────────────
export const exportProductsCSV = () => api.get('/products/export', { responseType: 'blob' }).then(r => r.data);
export const importProductsCSV = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/products/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(r => r.data);
};

