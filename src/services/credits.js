/**
 * The credit ledger.
 *
 * Balance is never a column: it is SUM(delta). Every movement is a row with a
 * (ref_id, reason) pair that the database keeps unique, so retries cannot
 * double charge and a failed job cannot refund twice.
 *
 * Charging is one statement — INSERT ... SELECT ... WHERE balance >= 1 — which
 * is what makes it safe on D1, where a multi-statement transaction is not
 * available to application code.
 */

export const SIGNUP_BONUS = 3;
export const REASON = {
  signupBonus: 'signup_bonus',
  purchase: 'purchase',
  jobCharge: 'job_charge',
  jobRefund: 'job_refund',
  manual: 'manual',
};

export async function getBalance(env, userId) {
  const row = await env.DB.prepare(
    'SELECT COALESCE(SUM(delta), 0) AS balance FROM credits_ledger WHERE user_id = ?1',
  )
    .bind(userId)
    .first();
  return Number(row?.balance ?? 0);
}

export async function hasSignupBonus(env, userId) {
  const row = await env.DB.prepare(
    `SELECT 1 AS claimed FROM credits_ledger WHERE user_id = ?1 AND reason = 'signup_bonus' LIMIT 1`,
  )
    .bind(userId)
    .first();
  return Boolean(row);
}

/**
 * Grant the one-time welcome credits.
 * @returns {Promise<boolean>} true only for the call that actually inserted the row
 */
export async function grantSignupBonus(env, userId) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO credits_ledger (id, user_id, delta, reason, ref_id, created_at)
     VALUES (?1, ?2, ?3, 'signup_bonus', ?2, ?4)`,
  )
    .bind(crypto.randomUUID(), userId, SIGNUP_BONUS, Date.now())
    .run();
  return changed(result) > 0;
}

/**
 * Take one credit, but only when at least one is available.
 * @returns {Promise<boolean>} false means the balance was already zero
 */
export async function chargeOne(env, userId, jobId) {
  const result = await env.DB.prepare(
    `INSERT INTO credits_ledger (id, user_id, delta, reason, ref_id, created_at)
     SELECT ?1, ?2, -1, 'job_charge', ?3, ?4
     WHERE (SELECT COALESCE(SUM(delta), 0) FROM credits_ledger WHERE user_id = ?2) >= 1`,
  )
    .bind(crypto.randomUUID(), userId, jobId, Date.now())
    .run();
  return changed(result) > 0;
}

/** Give the credit back. Idempotent per job id. */
export async function refundOne(env, userId, jobId) {
  const result = await env.DB.prepare(
    `INSERT OR IGNORE INTO credits_ledger (id, user_id, delta, reason, ref_id, created_at)
     VALUES (?1, ?2, 1, 'job_refund', ?3, ?4)`,
  )
    .bind(crypto.randomUUID(), userId, jobId, Date.now())
    .run();
  return changed(result) > 0;
}

/**
 * Job metadata for the account page and for operator debugging. Never the
 * image itself. A logging failure must not break a successful removal, so the
 * caller gets a boolean instead of an exception.
 */
export async function recordJob(env, job) {
  try {
    await env.DB.prepare(
      `INSERT INTO jobs (id, user_id, status, input_bytes, input_format, provider, duration_ms, error_code, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
      .bind(
        job.id,
        job.userId,
        job.status,
        job.inputBytes ?? null,
        job.inputFormat ?? null,
        job.provider ?? 'remove_bg',
        job.durationMs ?? null,
        job.errorCode ?? null,
        Date.now(),
      )
      .run();
    return true;
  } catch (error) {
    console.error('[credits] could not record job', job.id, error.message);
    return false;
  }
}

function changed(result) {
  return Number(result?.meta?.changes ?? 0);
}
