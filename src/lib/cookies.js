/**
 * Cookie plumbing. Workers have no cookie jar, so every read is a header parse
 * and every write is an explicit `set-cookie` append.
 */

export function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out[name] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{path?: string, maxAge?: number, httpOnly?: boolean, secure?: boolean, sameSite?: 'Lax'|'Strict'|'None'}} opts
 */
export function serializeCookie(name, value, opts = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${opts.path ?? '/'}`);
  if (typeof opts.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`);
  if (opts.httpOnly !== false) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

/** A cookie that is already expired, used to clear one. */
export function clearCookie(name, opts = {}) {
  return serializeCookie(name, '', { ...opts, maxAge: 0 });
}

/**
 * http://localhost is the one origin browsers refuse a Secure cookie on, so the
 * flag follows the scheme instead of being hardcoded true.
 */
export function isSecureRequest(request) {
  return new URL(request.url).protocol === 'https:';
}
