import axios from 'axios';

/**
 * NVIP platform API client for the /api/v1 endpoints (architecture doc §9).
 *
 *   REACT_APP_NVIP_API_URL     NVIP backend origin, e.g. http://localhost:8000
 *   REACT_APP_NVIP_USE_MOCKS   'false' to call the real backend; anything else serves mock data
 */
const base = (
  process.env.REACT_APP_NVIP_API_URL ||
  'http://localhost:8000'
).replace(/\/+$/, '');

export const USE_MOCKS = process.env.REACT_APP_NVIP_USE_MOCKS !== 'false';

export const SESSION_KEY = 'nvip_session';

export const http = axios.create({
  baseURL: `${base}/api/v1`,
  headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
});

http.interceptors.request.use((config) => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (session?.token) config.headers.Authorization = `Bearer ${session.token}`;
  } catch {
    /* no session — anonymous request (marketplace, demo/quote forms) */
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) window.dispatchEvent(new CustomEvent('nvip:unauthorized'));
    return Promise.reject(error);
  },
);

/** Serve `mock` (after a short delay, so loading states are visible) or run the real request. */
export async function call(request, mock) {
  if (USE_MOCKS) {
    // Short delay so loading states are visible in the browser; none under test.
    if (process.env.NODE_ENV !== 'test') await new Promise((r) => setTimeout(r, 250));
    // Copy plain-data mocks so a page mutating its result can't corrupt the fixture.
    return typeof mock === 'function' ? mock() : JSON.parse(JSON.stringify(mock));
  }
  const res = await request();
  return res.data;
}

/** A readable message from an axios error, for toasts and error states. */
export function errorMessage(err) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  return err?.message || 'Something went wrong';
}
