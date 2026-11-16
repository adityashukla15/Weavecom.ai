import { appendResourceId, buildEndpoint } from './endpoints.js';
import { ApiError, createHttpError } from './errors.js';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() ?? '';
const requestTimeout = 15000;
let accessToken = null;

if (configuredBaseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(configuredBaseUrl);
  } catch (cause) {
    throw new Error('VITE_API_BASE_URL must be a valid absolute URL.', { cause });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('VITE_API_BASE_URL must use HTTP or HTTPS.');
  }
  if (parsedUrl.username || parsedUrl.password) {
    throw new Error('VITE_API_BASE_URL must not contain credentials.');
  }
}

const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
export const isApiConfigured = Boolean(baseUrl);

export function setAccessToken(token) {
  accessToken = token || null;
}

export function clearAccessToken() {
  accessToken = null;
}

async function readPayload(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    try {
      return await response.json();
    } catch (cause) {
      throw new ApiError('The server returned an invalid response.', {
        status: response.status,
        code: 'INVALID_RESPONSE',
        cause,
      });
    }
  }
  return response.text();
}

export async function request(path, { method = 'GET', body, headers, signal } = {}) {
  const endpoint = buildEndpoint(path);
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeout);
  const abortFromCaller = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  const requestHeaders = new Headers(headers);
  if (accessToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }
  let requestBody = body;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  if (body !== undefined && !isFormData && !isBlob) {
    requestHeaders.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: controller.signal,
      credentials: 'omit',
    });
    const payload = await readPayload(response);
    if (!response.ok) {
      if (response.status === 401) {
        window.dispatchEvent(new Event('panelverse:unauthorized'));
      }
      throw createHttpError(response, payload);
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) {
      throw new ApiError('The request timed out. Please try again.', {
        code: 'REQUEST_TIMEOUT',
        cause: error,
      });
    }
    throw new ApiError('Unable to reach the server. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
      cause: error,
    });
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export const apiClient = {
  get: (path, query) => request(buildEndpoint(path, query)),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  resource: appendResourceId,
};
