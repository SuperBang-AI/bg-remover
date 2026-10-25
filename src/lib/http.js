const BASE_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
};

/**
 * Fonts come from Google Fonts, images can be blob: URLs created by the client.
 * Everything else is same-origin. JSON-LD blocks are data, not executable code.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
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

export function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: withBaseHeaders({
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    }),
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
