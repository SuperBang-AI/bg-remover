/**
 * Sign-in, sign-out and the "who am I" endpoint.
 *
 * Flow: GET /auth/google mints state + a PKCE verifier, parks both in a short
 * lived HttpOnly cookie, and sends the browser to Google. Google comes back to
 * /auth/google/callback, where the cookie is the only thing that can vouch for
 * the state parameter — that is what makes the round trip CSRF safe without
 * server-side state.
 */
import { apiError, jsonResponse, redirectResponse } from '../lib/http.js';
import { clearCookie, isSecureRequest, parseCookies, serializeCookie } from '../lib/cookies.js';
import {
  AuthError,
  buildAuthorizationUrl,
  exchangeCodeForClaims,
  isOAuthConfigured,
  pkceChallenge,
  randomToken,
  redirectUriFor,
  safeNextPath,
} from '../services/google.js';
import { expiredSessionCookie, isSessionConfigured, readSessionUserId, sessionCookie } from '../services/session.js';
import { getBalance, grantSignupBonus, hasSignupBonus, SIGNUP_BONUS } from '../services/credits.js';
import { findUser, isDatabaseReady, publicView, upsertUser } from '../services/users.js';

const OAUTH_COOKIE = 'cutout_oauth';
const OAUTH_COOKIE_PATH = '/auth/google';
const OAUTH_TTL_SECONDS = 600;

/** @returns {Promise<{user: object, credits: number, freeGranted: boolean}|null>} */
export async function loadViewer(env, request) {
  if (!isDatabaseReady(env)) return null;
  const userId = await readSessionUserId(env, request);
  if (!userId) return null;

  const user = await findUser(env, userId);
  if (!user) return null;

  const [credits, freeGranted] = await Promise.all([
    getBalance(env, userId),
    hasSignupBonus(env, userId),
  ]);
  return { user, credits, freeGranted };
}

/* ------------------------------------------------------------------ start */

export async function handleAuthStart(request, env) {
  if (!isOAuthConfigured(env)) {
    console.warn('[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set');
    return redirectResponse('/?auth=unconfigured');
  }
  if (!isSessionConfigured(env)) {
    console.warn('[auth] SESSION_SECRET is not set');
    return redirectResponse('/?auth=unconfigured');
  }
  if (!isDatabaseReady(env)) {
    console.warn('[auth] D1 binding DB is missing');
    return redirectResponse('/?auth=unconfigured');
  }

  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'), '/#tool');
  const state = randomToken(24);
  const verifier = randomToken(48);
  const challenge = await pkceChallenge(verifier);

  const authorizationUrl = buildAuthorizationUrl({
    clientId: env.GOOGLE_CLIENT_ID.trim(),
    redirectUri: redirectUriFor(request),
    state,
    codeChallenge: challenge,
  });

  return redirectResponse(authorizationUrl, {
    cookies: [
      serializeCookie(OAUTH_COOKIE, encodeState({ state, verifier, next }), {
        path: OAUTH_COOKIE_PATH,
        maxAge: OAUTH_TTL_SECONDS,
        httpOnly: true,
        secure: isSecureRequest(request),
        sameSite: 'Lax',
      }),
    ],
  });
}

/* --------------------------------------------------------------- callback */

export async function handleAuthCallback(request, env) {
  const url = new URL(request.url);
  const cookies = parseCookies(request.headers.get('cookie'));
  const parked = decodeState(cookies[OAUTH_COOKIE]);
  const clearParked = clearCookie(OAUTH_COOKIE, {
    path: OAUTH_COOKIE_PATH,
    secure: isSecureRequest(request),
    sameSite: 'Lax',
  });

  if (url.searchParams.get('error')) {
    console.warn('[auth] provider returned an error', url.searchParams.get('error'));
    return redirectResponse('/?auth=denied', { cookies: [clearParked] });
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || !parked || parked.state !== state) {
    console.warn('[auth] state check failed', { hasCode: Boolean(code), hasParked: Boolean(parked) });
    return redirectResponse('/?auth=state', { cookies: [clearParked] });
  }

  if (!isOAuthConfigured(env) || !isSessionConfigured(env) || !isDatabaseReady(env)) {
    return redirectResponse('/?auth=unconfigured', { cookies: [clearParked] });
  }

  let claims;
  try {
    claims = await exchangeCodeForClaims(env, {
      code,
      codeVerifier: parked.verifier,
      redirectUri: redirectUriFor(request),
    });
  } catch (error) {
    const detail = error instanceof AuthError ? error.code : 'unknown';
    console.error('[auth] code exchange failed', detail, error.message);
    return redirectResponse('/?auth=failed', { cookies: [clearParked] });
  }

  let session;
  try {
    const { id: userId, created } = await upsertUser(env, claims);
    // Only a brand new row can claim the bonus; the unique index is the arbiter.
    if (created) {
      const granted = await grantSignupBonus(env, userId);
      if (granted) console.log(`[auth] signup bonus granted (+${SIGNUP_BONUS})`, userId);
    }
    session = await sessionCookie(request, env, userId);
  } catch (error) {
    console.error('[auth] could not create the session', error.message);
    return redirectResponse('/?auth=failed', { cookies: [clearParked] });
  }

  if (!session) return redirectResponse('/?auth=failed', { cookies: [clearParked] });

  return redirectResponse(safeNextPath(parked.next, '/#tool'), {
    cookies: [clearParked, session],
  });
}

/* ------------------------------------------------------------------- me */

export async function handleMe(request, env) {
  if (!isDatabaseReady(env)) {
    return apiError('database_unavailable', 'Accounts are not configured on this deployment.', 503);
  }

  const viewer = await loadViewer(env, request);
  if (!viewer) {
    // Signed out is a normal state for this endpoint, not an error: the page
    // needs one call that always answers.
    return jsonResponse({ user: null, credits: 0, freeGranted: false, signupBonus: SIGNUP_BONUS });
  }

  return jsonResponse({
    user: publicView(viewer.user, { credits: viewer.credits, freeGranted: viewer.freeGranted }),
    credits: viewer.credits,
    freeGranted: viewer.freeGranted,
    signupBonus: SIGNUP_BONUS,
  });
}

/* --------------------------------------------------------------- logout */

export async function handleLogout(request, env) {
  if (request.method !== 'POST') {
    return apiError('method_not_allowed', 'Use POST to sign out.', 405, { allow: 'POST' });
  }
  return jsonResponse(
    { ok: true },
    { status: 200, cookies: [expiredSessionCookie(request)] },
  );
}

/* ---------------------------------------------------------------- state */

function encodeState(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeState(raw) {
  if (!raw) return null;
  try {
    const normalised = String(raw).replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed.state !== 'string' || typeof parsed.verifier !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
