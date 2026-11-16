const statusMessages = {
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'The requested resource could not be found.',
  422: 'Some of the submitted information is invalid.',
  429: 'Too many requests. Please try again shortly.',
  500: 'The server could not complete the request.',
};

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR', details, cause } = {}) {
    super(message, { cause });
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getErrorMessage(error) {
  if (error instanceof ApiError) return error.message;
  if (error?.name === 'AbortError') return 'The request timed out. Please try again.';
  if (error instanceof TypeError) return 'Unable to reach the server. Check your connection and try again.';
  return 'An unexpected error occurred. Please try again.';
}

export function createHttpError(response, payload) {
  const message = statusMessages[response.status]
    ?? (response.status >= 500 ? 'The server could not complete the request.' : 'The request could not be completed.');
  return new ApiError(message, {
    status: response.status,
    code: `HTTP_${response.status}`,
    details: payload,
  });
}
