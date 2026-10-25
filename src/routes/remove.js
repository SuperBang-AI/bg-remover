import { apiError, withBaseHeaders } from '../lib/http.js';
import { ProviderError } from '../lib/errors.js';
import { MAX_BYTES, sanitizeFilename, sniffImageType } from '../lib/validate.js';
import { removeBackground } from '../services/remover.js';

/**
 * POST /api/remove  (multipart/form-data, field "image")
 *
 * Success: 200 with PNG bytes, so the browser can render the result with a
 * single object URL and no base64 bloat. Failure: JSON with a code the client
 * can switch on and a message that is safe to show users.
 */
export async function handleRemove(request, env) {
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

  try {
    const result = await removeBackground(env, {
      bytes,
      mimeType: detectedType,
      filename: sanitizeFilename(file.name),
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
      }),
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      // Operator detail stays in the log; the user gets the sanitised sentence.
      console.error(`[remove] ${error.code}: ${error.message}`);
      if (error.code === 'provider_not_configured' || error.code === 'provider_unknown') {
        return apiError(error.code, error.publicMessage, error.status, { configured: false });
      }
      return apiError(error.code, error.publicMessage, error.status);
    }

    console.error('[remove] unexpected failure', error);
    return apiError('internal_error', 'Something went wrong on our side. Please try again.', 500);
  }
}
