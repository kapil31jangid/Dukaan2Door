const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_KEY = 'd2d_access_token';

export function resolveAssetUrl(value?: string | null): string | null {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  // Demo catalogue assets ship with the frontend, unlike retailer uploads
  // which are served by the API under /uploads.
  if (value.startsWith('/images/')) return value;
  return `${API_BASE_URL}${value}`;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  // A demo commonly opens customer, retailer, and rider accounts in separate
  // tabs. Per-tab storage prevents one login from silently replacing another
  // tab's API identity while its header still shows the previous user.
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function removeToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, ...customConfig } = options;

  let url = `${API_BASE_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const config: RequestInit = {
    ...customConfig,
    headers,
    signal: controller.signal,
  };

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new ApiError('The API request timed out. Check that the backend is running and reachable.', 408);
    throw new ApiError(err.message || 'Network connection failed', 0);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (response.status === 401) {
    // Unauthorized / token expired
    removeToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?expired=true';
    }
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage = data?.detail || data?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

/** Upload a file using multipart/form-data. The browser sets Content-Type + boundary automatically. */
export async function uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });
  } catch (err: any) {
    throw new ApiError(err.message || 'Network connection failed', 0);
  }

  if (response.status === 401) {
    removeToken();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login?expired=true';
    }
    throw new ApiError('Session expired. Please log in again.', 401);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.detail || `Upload failed (${response.status})`, response.status, data);
  }
  return data as T;
}
