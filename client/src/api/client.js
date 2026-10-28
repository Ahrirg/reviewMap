/** An HTTP failure carrying the server's message and, when known, the field. */
export class ApiError extends Error {
  constructor(status, message, field) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
  }
}

const FRIENDLY = {
  0: 'Nepavyko pasiekti serverio. Patikrinkite ryšį.',
  500: 'Serverio klaida. Bandykite dar kartą.',
  502: 'Serverio klaida. Bandykite dar kartą.',
  503: 'Serveris šiuo metu nepasiekiamas.',
};

/**
 * Statuses whose Lithuanian wording wins over the server's message. The server
 * speaks English like the rest of the backend, which is tolerable for a
 * validation detail but not for the two errors every user can hit.
 */
const AUTH_MESSAGES = {
  401: 'Sesija baigėsi. Prisijunkite iš naujo.',
  403: 'Neturite teisių šiam veiksmui.',
  429: 'Per daug bandymų. Pabandykite po kelių minučių.',
};

let onAuthError = null;

/**
 * Register a listener for 401 and 403 anywhere in the app.
 *
 * A 401 means the cookie stopped resolving mid-session, so the app has to go
 * back to the login screen; a 403 means the role changed under it. Requests to
 * /api/session are exempt: a wrong password is a 401 the login screen handles
 * itself, and bouncing it back to the login screen would be a loop.
 */
export function setAuthErrorHandler(handler) {
  onAuthError = handler;
}

const SESSION_URL = '/api/session';

function reportAuthError(status, url) {
  if (status !== 401 && status !== 403) return;
  if (typeof url === 'string' && url.startsWith(SESSION_URL)) return;
  onAuthError?.(status);
}

const messageFor = (status, body) =>
  AUTH_MESSAGES[status] ?? body?.error ?? FRIENDLY[status] ?? `Klaida (${status})`;

async function parseBody(response) {
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('application/json')) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function handle(response, url) {
  if (response.status === 204) return null;

  const body = await parseBody(response);
  if (response.ok) return body;

  reportAuthError(response.status, url);
  throw new ApiError(response.status, messageFor(response.status, body), body?.field);
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, FRIENDLY[0]);
  }
  return handle(response, url);
}

export const getJson = (url, options) => request(url, { method: 'GET', ...options });

export const sendJson = (url, body, options = {}) =>
  request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...options,
  });

export const del = (url, options) => request(url, { method: 'DELETE', ...options });

/**
 * POST multipart with upload progress.
 *
 * fetch() exposes no upload progress event, so anything carrying a file goes
 * through XMLHttpRequest instead. onProgress receives a 0..1 fraction.
 */
export function uploadWithProgress(url, formData, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'json';

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    });

    xhr.addEventListener('load', () => {
      const body = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve(body ?? null);
        return;
      }
      reportAuthError(xhr.status, url);
      reject(new ApiError(xhr.status, messageFor(xhr.status, body), body?.field));
    });

    xhr.addEventListener('error', () => reject(new ApiError(0, FRIENDLY[0])));
    xhr.addEventListener('timeout', () => reject(new ApiError(0, 'Įkėlimas užtruko per ilgai.')));
    xhr.addEventListener('abort', () =>
      reject(new DOMException('Upload aborted', 'AbortError')),
    );

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}
