const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const DEFAULT_TIMEOUT_MS = 25000;

export const apiRequest = async (path, options = {}) => {
  const {
    token,
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT_MS,
    signal: userSignal,
    ...fetchOptions
  } = options;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('REQUEST_TIMEOUT'));
  }, timeout);

  const handleUserAbort = () => controller.abort(userSignal?.reason);
  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort(userSignal.reason);
    } else {
      userSignal.addEventListener('abort', handleUserAbort, { once: true });
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
    });
  } catch (fetchError) {
    if (fetchError?.name === 'AbortError' || controller.signal.aborted) {
      if (userSignal?.aborted) {
        throw new ApiError('Request was cancelled.', 0);
      }
      throw new ApiError(
        'The request took too long to complete. The server may be waking up or busy. Please try again.',
        408
      );
    }
    throw new ApiError(
      'Unable to connect to the server. Please check your internet connection or try again later.',
      0
    );
  } finally {
    clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener('abort', handleUserAbort);
    }
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    if (response.status === 204) {
      return null;
    }
    if (response.status === 504) {
      throw new ApiError('The server gateway timed out. Please try again in a few moments.', 504);
    }
    if (response.status === 502 || response.status === 503) {
      throw new ApiError('The service is temporarily unavailable. Please try again in a moment.', response.status);
    }
    throw new ApiError('The server returned an unparseable response.', response.status);
  }

  if (!response.ok) {
    const error = new ApiError(
      data?.message || data?.error || 'The request could not be completed.',
      response.status
    );
    error.data = data;
    throw error;
  }
  return data;
};

export const fetchPhotoBlobUrl = async (photoId, token, options = {}) => {
  const { timeout = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE}/farms/photos/${photoId}/file`, {
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new ApiError('Failed to load photograph image.', response.status);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } finally {
    clearTimeout(timer);
  }
};
