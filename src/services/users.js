/**
 * Account records and the "who is this request" lookup.
 *
 * A user row is created on first sign-in and then updated on every sign-in, so
 * a renamed Google account or a new avatar shows up without a migration.
 */

export function isDatabaseReady(env) {
  return Boolean(env && env.DB && typeof env.DB.prepare === 'function');
}

/**
 * @param {object} env
 * @param {{sub: string, email: string, name?: string, picture?: string}} claims
 * @returns {Promise<{id: string, created: boolean}>}
 */
export async function upsertUser(env, claims) {
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE google_sub = ?1')
    .bind(claims.sub)
    .first();

  if (existing) {
    await env.DB.prepare(
      'UPDATE users SET email = ?1, name = ?2, avatar_url = ?3, last_login_at = ?4 WHERE id = ?5',
    )
      .bind(claims.email, claims.name ?? null, claims.picture ?? null, now, existing.id)
      .run();
    return { id: existing.id, created: false };
  }

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      `INSERT INTO users (id, google_sub, email, name, avatar_url, created_at, last_login_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
      .bind(id, claims.sub, claims.email, claims.name ?? null, claims.picture ?? null, now, now)
      .run();
    return { id, created: true };
  } catch (error) {
    // Two tabs signing in at once: the unique index on google_sub wins, and the
    // loser simply reads the row the winner wrote.
    const raced = await env.DB.prepare('SELECT id FROM users WHERE google_sub = ?1')
      .bind(claims.sub)
      .first();
    if (raced) return { id: raced.id, created: false };
    throw error;
  }
}

/** @returns {Promise<{id: string, email: string, name: string|null, avatarUrl: string|null}|null>} */
export async function findUser(env, userId) {
  const row = await env.DB.prepare('SELECT id, email, name, avatar_url FROM users WHERE id = ?1')
    .bind(userId)
    .first();
  if (!row) return null;
  return { id: row.id, email: row.email, name: row.name ?? null, avatarUrl: row.avatar_url ?? null };
}

export function publicView(user, { credits, freeGranted }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    credits,
    freeGranted,
  };
}
