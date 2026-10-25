import { apiError, htmlResponse, jsonResponse, textResponse } from './lib/http.js';
import { renderHome } from './pages/home.js';
import { renderNotFound } from './pages/not-found.js';
import { handleRemove } from './routes/remove.js';
import { handleAuthCallback, handleAuthStart, handleLogout, handleMe, loadViewer } from './routes/auth.js';
import { DEFAULT_PROVIDER_ID, isProviderReady } from './services/remover.js';

/**
 * One Worker, two jobs: server-rendered pages for humans and crawlers, JSON/PNG
 * for the browser. Static assets (CSS, JS, favicon) are served by Cloudflare
 * before this handler is ever reached.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    /* ------------------------------------------------------------- auth */

    if (pathname === '/auth/google' && request.method === 'GET') {
      return handleAuthStart(request, env);
    }

    if (pathname === '/auth/google/callback' && request.method === 'GET') {
      return handleAuthCallback(request, env);
    }

    if (pathname === '/api/auth/logout') {
      return handleLogout(request, env);
    }

    if (pathname === '/api/me') {
      if (request.method !== 'GET') {
        return apiError('method_not_allowed', 'Use GET for this endpoint.', 405, { allow: 'GET' });
      }
      return handleMe(request, env);
    }

    /* ------------------------------------------------------------- tool */

    if (pathname === '/api/remove') {
      if (request.method !== 'POST') {
        return apiError('method_not_allowed', 'Use POST for this endpoint.', 405, { allow: 'POST' });
      }
      return handleRemove(request, env);
    }

    if (pathname === '/api/health') {
      return jsonResponse({
        ok: true,
        provider: (env.BG_PROVIDER || DEFAULT_PROVIDER_ID).trim(),
        providerConfigured: isProviderReady(env),
        ts: new Date().toISOString(),
      });
    }

    if (pathname.startsWith('/api/')) {
      return apiError('not_found', 'Unknown API endpoint.', 404);
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return apiError('method_not_allowed', 'Method not allowed.', 405, { allow: 'GET, HEAD' });
    }

    if (pathname === '/') {
      const viewer = await loadViewer(env, request).catch((error) => {
        // A database hiccup must not take the landing page down: it renders as
        // signed out and the header shows the sign-in button.
        console.error('[home] could not load the viewer', error.message);
        return null;
      });
      return htmlResponse(
        renderHome({ origin: url.origin, providerReady: isProviderReady(env), viewer }),
        // The header is per-visitor now, so this HTML must never be shared.
        { headers: { 'cache-control': 'private, max-age=0, must-revalidate' } },
      );
    }

    if (pathname === '/robots.txt') {
      return textResponse(
        [
          'User-agent: *',
          'Allow: /',
          'Disallow: /api/',
          'Disallow: /auth/',
          '',
          `Sitemap: ${url.origin}/sitemap.xml`,
          '',
        ].join('\n'),
      );
    }

    if (pathname === '/sitemap.xml') {
      const lastmod = new Date().toISOString().slice(0, 10);
      return textResponse(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '  <url>',
          `    <loc>${url.origin}/</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          '    <changefreq>weekly</changefreq>',
          '    <priority>1.0</priority>',
          '  </url>',
          '</urlset>',
          '',
        ].join('\n'),
        { contentType: 'application/xml; charset=utf-8' },
      );
    }

    return htmlResponse(renderNotFound({ origin: url.origin }), { status: 404 });
  },
};
