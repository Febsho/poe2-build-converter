/**
 * Resolve a pobb.in (or compatible paste host) URL into a raw PoB export code.
 *
 * pobb.in serves the raw code at `/<id>/raw`. We accept full URLs or bare IDs
 * and normalize them before fetching.
 */
const SUPPORTED_HOSTS = ['pobb.in', 'www.pobb.in'];

export function isPobbinUrl(input) {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return SUPPORTED_HOSTS.includes(url.hostname);
    } catch {
      return false;
    }
  }
  return false;
}

function toRawUrl(input) {
  const url = new URL(input.trim());
  if (!SUPPORTED_HOSTS.includes(url.hostname)) {
    throw new Error(`Unsupported host: ${url.hostname}`);
  }

  // Path is like /abc123 ; the raw code is at /abc123/raw.
  let path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/raw')) {
    return `${url.origin}${path}`;
  }
  const id = path.split('/').filter(Boolean)[0];
  if (!id) {
    throw new Error('Could not find a build id in the pobb.in URL');
  }
  return `${url.origin}/${id}/raw`;
}

export async function fetchPobbinCode(input, { timeoutMs = 10000 } = {}) {
  const rawUrl = toRawUrl(input);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: { Accept: 'text/plain', 'User-Agent': 'pob-to-poe2-buildplanner' },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('pobb.in request timed out');
    }
    throw new Error(`Failed to reach pobb.in: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new Error(`pobb.in returned HTTP ${res.status} for ${rawUrl}`);
  }

  const body = (await res.text()).trim();
  if (!body) {
    throw new Error('pobb.in returned an empty body');
  }
  return body;
}
