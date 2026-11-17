const KEYS = { assistant: ['local', 'relay.assistant'], client: ['session', 'relay.client'] };
const store = (kind) => (kind === 'local' ? window.localStorage : window.sessionStorage);

export function getSession(role) {
  try {
    const [kind, key] = KEYS[role];
    return JSON.parse(store(kind).getItem(key) || 'null');
  } catch {
    return null;
  }
}
export function setSession(role, value) {
  const [kind, key] = KEYS[role];
  try {
    if (value) store(kind).setItem(key, JSON.stringify(value));
    else store(kind).removeItem(key);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, role = 'assistant', auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) {
    const s = getSession(role);
    if (s?.token) headers.authorization = `Bearer ${s.token}`;
  }
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && auth) {
      setSession(role, null);
      window.dispatchEvent(new CustomEvent('relay:signed-out', { detail: role }));
    }
    throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  }
  return data;
}
