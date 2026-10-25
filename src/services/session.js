/**
 * Stateless session: a compact token in an HttpOnly cookie, signed with
 * HMAC-SHA256 under SESSION_SECRET. No session table, no server-side state, so
 * a request only costs one signature check.
 *
 * Token layout: base64url(json payload) "." base64url(hmac)
 * The payload carries only the user id; everything else is read from D1 so a
 * renamed account or a topped-up balance is never stale.
 */
import { parseCookies, serializeCookie, clearCookie, isSecureRequest } from '../lib/cookies.js';

const COOKIE_NAME = 'cutout_session';
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

/** @type {Map<string, Promise<CryptoKey>>} */
const keyCache = new Map();

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value) {
  const normalised = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getKey(secret) {
  let cached = keyCache.get(secret);
  if (!cached) {
    cached = crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign', 'verify'],
    );
    keyCache.set(secret, cached);
  }
  return cached;
}

export function isSessionConfigured(env) {
  return typeof env.SESSION_SECRET === 'string' && env.SESSION_SECRET.trim().length >= 16;
}

/** @returns {Promise<string|null>} signed token, or null when the secret is missing */
export async function issueSession(env, userId) {
  if (!isSessionConfigured(env)) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload = { uid: userId, iat: now, exp: now + TTL_SECONDS };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getKey(env.SESSION_SECRET.trim());
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/** @returns {Promise<{uid: string}|null>} payload when the signature and expiry hold */
export async function verifySession(env, token) {
  if (!token || !isSessionConfigured(env)) return null;

  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let valid = false;
  try {
    const key = await getKey(env.SESSION_SECRET.trim());
    valid = await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), encoder.encode(body));
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body)));
    if (!payload || typeof payload.uid !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** User id from the request's session cookie, or null. */
export async function readSessionUserId(env, request) {
  const token = parseCookies(request.headers.get('cookie'))[COOKIE_NAME];
  if (!token) return null;
  const payload = await verifySession(env, token);
  return payload?.uid ?? null;
}

/** @returns {Promise<string>} `set-cookie` value */
export async function sessionCookie(request, env, userId) {
  const token = await issueSession(env, userId);
  if (!token) return '';
  return serializeCookie(COOKIE_NAME, token, {
    path: '/',
    maxAge: TTL_SECONDS,
    httpOnly: true,
    secure: isSecureRequest(request),
    // Lax, not None: the cookie has to survive the top level redirect back from
    // Google, and nothing about this app needs a cross-site cookie.
    sameSite: 'Lax',
  });
}

export function expiredSessionCookie(request) {
  return clearCookie(COOKIE_NAME, { path: '/', secure: isSecureRequest(request), sameSite: 'Lax' });
}
