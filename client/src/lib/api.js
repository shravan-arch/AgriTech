const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const apiRequest = async (path, options = {}) => {
  const { token, headers = {}, body, ...fetchOptions } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers: {
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    if (response.status !== 204) {
      throw new ApiError('The server returned an invalid response.', response.status);
    }
  }
  if (!response.ok) {
    const error = new ApiError(data?.message || 'The request could not be completed.', response.status);
    error.data = data;
    throw error;
  }
  return data;
};

export const fetchPhotoBlobUrl = async (photoId, token) => {
  const response = await fetch(`${API_BASE}/farms/photos/${photoId}/file`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new ApiError('Failed to load photograph image.', response.status);
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

