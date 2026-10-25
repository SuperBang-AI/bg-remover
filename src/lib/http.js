const BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

/**
 * Fonts come from Google Fonts, avatars from Google's image host, images can be
 * blob: URLs created by the client. Everything else is same-origin. JSON-LD
 * blocks are data, not executable code.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' blob: data: https://*.googleusercontent.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  "script-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export function withBaseHeaders(headers = {}) {
  return { ...BASE_HEADERS, ...headers };
}

/** A Response that can carry more than one Set-Cookie. */
function withCookies(headers, cookies = []) {
  if (!cookies.length) return withBaseHeaders(headers);
  const merged = new Headers(withBaseHeaders(headers));
  for (const cookie of cookies) {
    if (cookie) merged.append('set-cookie', cookie);
  }
  return merged;
}

export function jsonResponse(payload, { status = 200, headers = {}, cookies = [] } = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: withCookies(
      {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        ...headers,
      },
      cookies,
    ),
  });
}

/**
 * 302 with optional Set-Cookie. Never cached: a redirect that carries a session
 * must not be replayable from an intermediary.
 */
export function redirectResponse(location, { status = 302, cookies = [] } = {}) {
  return new Response(null, {
    status,
    headers: withCookies({ location, 'cache-control': 'no-store' }, cookies),
  });
}

export function htmlResponse(markup, { status = 200, headers = {} } = {}) {
  return new Response(markup, {
    status,
    headers: withBaseHeaders({
      'content-type': 'text/html; charset=utf-8',
      // HTML is server-rendered per request; let the CDN revalidate so copy and
      // structured data are always current.
      'cache-control': 'public, max-age=0, must-revalidate',
      'content-security-policy': CONTENT_SECURITY_POLICY,
      ...headers,
    }),
  });
}

export function textResponse(body, { contentType = 'text/plain; charset=utf-8', headers = {} } = {}) {
  return new Response(body, {
    headers: withBaseHeaders({
      'content-type': contentType,
      'cache-control': 'public, max-age=3600',
      ...headers,
    }),
  });
}

export function apiError(code, message, status, extra = {}) {
  return jsonResponse({ error: { code, message, ...extra } }, { status });
}
