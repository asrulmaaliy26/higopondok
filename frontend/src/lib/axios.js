import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useLoadingStore } from '../store/loadingStore';

// Gunakan hostname yang sama dengan frontend tapi arahkan ke port 8000 (backend Laravel)
// Jika diakses dari HP via IP lokal (misal: 192.168.x.x), ini akan otomatis mengarah ke 192.168.x.x:8000
const baseApiUrl = window.location.hostname === 'localhost' || window.location.hostname.match(/^[0-9.]+$/)
  ? `http://${window.location.hostname}:8000` 
  : ''; // Jika production di hosting, gunakan relative path

const baseURL = `${baseApiUrl}/api`;

export const getStorageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/storage/')
    ? path.substring(9)
    : path.startsWith('storage/')
    ? path.substring(8)
    : path.startsWith('/')
    ? path.substring(1)
    : path;
  return `${baseApiUrl}/storage/${cleanPath}`;
};

export const getPublicUrl = (path) => {
  if (!path) return null;
  return `${baseApiUrl}/${path}`;
};

const api = axios.create({
    baseURL: baseURL,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    // Hanya picu loading global untuk request mutasi (POST, PUT, PATCH, DELETE)
    // atau jika config secara eksplisit menentukan showLoading: true.
    // Polling dan background fetch GET akan berjalan senyap.
    const isMutatingMethod = config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase());
    const shouldShowLoading = config.showLoading === true || (config.showLoading !== false && isMutatingMethod);

    if (shouldShowLoading) {
        useLoadingStore.getState().startLoading();
        config._startedLoading = true;
    }

    const store = useAuthStore.getState();
    if (store.token) {
        config.headers.Authorization = `Bearer ${store.token}`;
    }
    if (store.originalAdmin && store.user) {
        config.headers['X-Impersonate-User-Id'] = store.user.id;
    }
    return config;
}, (error) => {
    if (error.config?._startedLoading) {
        useLoadingStore.getState().stopLoading();
    }
    return Promise.reject(error);
});

// Response Interceptor
api.interceptors.response.use(
  (response) => {
    if (response.config?._startedLoading) {
      useLoadingStore.getState().stopLoading();
    }
    return response;
  },
  (error) => {
    if (error.config?._startedLoading) {
      useLoadingStore.getState().stopLoading();
    }
    // Global Error Handling
    if (error.response && error.response.status === 401) {
      const store = useAuthStore.getState();
      
      // Jika error 401 terjadi saat menyamar (impersonating), kembalikan ke akun Admin asli
      if (store.originalAdmin) {
        store.stopImpersonating();
        window.location.href = '/dashboard/users';
        return Promise.reject(error);
      }

      // Token tidak valid atau sesi habis — bersihkan Zustand store dengan benar
      store.logout();
      
      // Redirect ke login hanya jika bukan sudah di halaman login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
