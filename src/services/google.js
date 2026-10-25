/**
 * Google OAuth 2.0, authorisation code flow with PKCE.
 *
 * Everything here is protocol; nothing here touches the database or the
 * response. The route layer composes it.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export class AuthError extends Error {
  constructor(code, message, publicMessage = 'Sign-in failed. Please try again.') {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

export function isOAuthConfigured(env) {
  return (
    typeof env.GOOGLE_CLIENT_ID === 'string' &&
    env.GOOGLE_CLIENT_ID.trim() !== '' &&
    typeof env.GOOGLE_CLIENT_SECRET === 'string' &&
    env.GOOGLE_CLIENT_SECRET.trim() !== ''
  );
}

export function buildAuthorizationUrl({ clientId, redirectUri, state, codeChallenge }) {
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // Let people pick the account instead of silently reusing the last one.
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export function redirectUriFor(request) {
  return `${new URL(request.url).origin}/auth/google/callback`;
}

/** @returns {Promise<object>} verified identity claims from the id_token */
export async function exchangeCodeForClaims(env, { code, codeVerifier, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_CLIENT_ID.trim(),
    client_secret: env.GOOGLE_CLIENT_SECRET.trim(),
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  let response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    });
  } catch (error) {
    throw new AuthError('token_unreachable', `Google token endpoint unreachable: ${error.message}`);
  }

  const text = await response.text();
  if (!response.ok) {
    // Never log the code or the secret; the body carries the reason and is safe.
    console.error('[auth] token exchange failed', response.status, text.slice(0, 300));
    throw new AuthError('token_exchange_failed', `Google returned HTTP ${response.status} for the code exchange.`);
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new AuthError('token_response_invalid', 'Google token response was not JSON.');
  }

  if (!payload.id_token) {
    throw new AuthError('missing_id_token', 'Google did not return an id_token for this code.');
  }

  const claims = decodeJwtPayload(payload.id_token);
  assertClaims(claims, env.GOOGLE_CLIENT_ID.trim());
  return claims;
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new AuthError('id_token_malformed', 'id_token is not a three part JWT.');
  try {
    const normalised = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalised + '='.repeat((4 - (normalised.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AuthError('id_token_malformed', 'id_token payload could not be decoded.');
  }
}

/**
 * The token came straight from Google's token endpoint over TLS, so the
 * signature adds nothing; what still matters is that the token was minted for
 * this client and is not expired.
 */
function assertClaims(claims, clientId) {
  if (!claims || typeof claims !== 'object') {
    throw new AuthError('id_token_malformed', 'id_token payload is empty.');
  }
  if (claims.aud !== clientId) {
    throw new AuthError('id_token_audience', `id_token audience mismatch.`);
  }
  if (!VALID_ISSUERS.has(claims.iss)) {
    throw new AuthError('id_token_issuer', `id_token issuer ${claims.iss} is not Google.`);
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) {
    throw new AuthError('id_token_expired', 'id_token is expired.');
  }
  if (!claims.sub || !claims.email) {
    throw new AuthError('id_token_incomplete', 'id_token has no subject or no email.');
  }
}

/** PKCE S256: base64url(sha256(verifier)) */
export async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let binary = '';
  for (const byte of buffer) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Open redirect guard: only same-origin absolute paths are honoured. */
export function safeNextPath(value, fallback = '/') {
  if (typeof value !== 'string' || value === '') return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return fallback;
  return value;
}
