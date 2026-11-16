export function buildEndpoint(path, query) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new TypeError('API endpoint must be an absolute path on the configured API host.');
  }
  if (!query) return path;

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null) params.set(key, String(value));
  });
  const serialized = params.toString();
  return serialized ? `${path}${path.includes('?') ? '&' : '?'}${serialized}` : path;
}

export function appendResourceId(collectionPath, id) {
  if (id === undefined || id === null || id === '') {
    throw new TypeError('A resource ID is required.');
  }
  return `${buildEndpoint(collectionPath).replace(/\/$/, '')}/${encodeURIComponent(String(id))}`;
}
