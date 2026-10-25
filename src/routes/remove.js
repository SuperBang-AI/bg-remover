import { apiError, withBaseHeaders } from '../lib/http.js';
import { ProviderError } from '../lib/errors.js';
import { MAX_BYTES, sanitizeFilename, sniffImageType } from '../lib/validate.js';
import { removeBackground, isProviderReady } from '../services/remover.js';
import { readSessionUserId } from '../services/session.js';
import { chargeOne, getBalance, recordJob, refundOne } from '../services/credits.js';
import { isDatabaseReady } from '../services/users.js';

/**
 * POST /api/remove  (multipart/form-data, field "image")
 *
 * Signed in only, one credit per successful removal. The order matters:
 *
 *   1. identity          — no session, nothing else to talk about (401)
 *   2. request shape     — reject bad files before any money moves (4xx)
 *   3. charge            — one atomic INSERT ... WHERE balance >= 1 (402 if it
 *                          matched no rows)
 *   4. provider call     — on any failure the credit is returned, which is the
 *                          only honest behaviour when the user got nothing
 *
 * Success is PNG bytes so the browser can paint the result from a single
 * object URL; failure is JSON with a code the client can switch on.
 */
export async function handleRemove(request, env) {
  if (!isDatabaseReady(env)) {
    return apiError('database_unavailable', 'Accounts are not configured on this deployment.', 503);
  }

  const userId = await readSessionUserId(env, request);
  if (!userId) {
    return apiError('auth_required', 'Sign in with Google to continue.', 401, { signInUrl: '/auth/google' });
  }

  // Nothing is charged for a request that could not have produced an image.
  if (!isProviderReady(env)) {
    return apiError(
      'provider_not_configured',
      'Background removal is not switched on for this build yet. The upload and comparison interface is ready; the removal key still has to be set.',
      503,
      { configured: false },
    );
  }

  const contentType = (request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('multipart/form-data')) {
    return apiError('unsupported_media_type', 'Send the image as multipart/form-data.', 415);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return apiError('bad_request', 'The upload could not be read. Please try again.', 400);
  }

  const file = form.get('image');
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return apiError('no_file', 'No image was received.', 400);
  }

  if (file.size === 0) {
    return apiError('empty_file', 'That file is empty.', 400);
  }

  if (file.size > MAX_BYTES) {
    return apiError('payload_too_large', 'That image is larger than 10 MB. Please resize it and try again.', 413, {
      maxBytes: MAX_BYTES,
    });
  }

  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength));
  const detectedType = sniffImageType(head);

  if (!detectedType) {
    return apiError('unsupported_media_type', 'Please upload a JPG, PNG or WEBP image.', 415);
  }

  const jobId = crypto.randomUUID();
  const charged = await chargeOne(env, userId, jobId);
  if (!charged) {
    return apiError(
      'out_of_credits',
      "You're out of credits. Get more to keep removing backgrounds.",
      402,
      { credits: 0 },
    );
  }

  try {
    const result = await removeBackground(env, {
      bytes,
      mimeType: detectedType,
      filename: sanitizeFilename(file.name),
    });

    const remaining = await getBalance(env, userId);
    await recordJob(env, {
      id: jobId,
      userId,
      status: 'ok',
      inputBytes: file.size,
      inputFormat: detectedType,
      provider: result.provider,
      durationMs: result.durationMs,
    });

    return new Response(result.bytes, {
      status: 200,
      headers: withBaseHeaders({
        'content-type': result.mimeType,
        'content-disposition': 'inline; filename="result.png"',
        // Results are never cached by us or by any intermediary.
        'cache-control': 'no-store',
        'x-bg-provider': result.provider,
        'x-bg-duration-ms': String(result.durationMs),
        'x-bg-input-type': detectedType,
        'x-credits-remaining': String(remaining),
      }),
    });
  } catch (error) {
    // The user got no image, so the credit goes back. Idempotent per job id.
    const refunded = await refundOne(env, userId, jobId);
    const remaining = refunded ? await getBalance(env, userId) : null;

    const code = error instanceof ProviderError ? error.code : 'internal_error';
    await recordJob(env, {
      id: jobId,
      userId,
      status: 'failed',
      inputBytes: file.size,
      inputFormat: detectedType,
      provider: 'remove_bg',
      errorCode: code,
    });

    if (error instanceof ProviderError) {
      // Operator detail stays in the log; the user gets the sanitised sentence.
      console.error(`[remove] ${error.code}: ${error.message}`);
      const message = refunded ? `${error.publicMessage} Your credit was refunded.` : error.publicMessage;
      if (error.code === 'provider_not_configured' || error.code === 'provider_unknown') {
        return apiError(error.code, message, error.status, { configured: false, creditsRefunded: refunded });
      }
      return apiError(error.code, message, error.status, {
        creditsRefunded: refunded,
        ...(remaining === null ? {} : { credits: remaining }),
      });
    }

    console.error('[remove] unexpected failure', error);
    return apiError(
      'internal_error',
      refunded
        ? 'Something went wrong on our side. Your credit was refunded.'
        : 'Something went wrong on our side. Please try again.',
      500,
      { creditsRefunded: refunded, ...(remaining === null ? {} : { credits: remaining }) },
    );
  }
}
