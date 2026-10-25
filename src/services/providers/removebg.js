import { ProviderError } from '../../lib/errors.js';

const ENDPOINT = 'https://api.remove.bg/v1.0/removebg';

/**
 * remove.bg adapter.
 *
 * Contract every provider in this folder must satisfy:
 *   id:            stable key used by BG_PROVIDER
 *   label:         human readable, used in logs
 *   isConfigured:  (env) => boolean, true when required secrets are present
 *   remove:        (env, { bytes, mimeType, filename }) => { bytes, mimeType }
 *
 * remove.bg is scheduled to hand background removal over to Leonardo.Ai on
 * 2026-12-01. When that happens, add a sibling module and register it in
 * ../remover.js. Nothing outside this folder needs to change.
 */
export const removeBgProvider = {
  id: 'remove_bg',
  label: 'remove.bg',

  isConfigured(env) {
    return typeof env.REMOVE_BG_API_KEY === 'string' && env.REMOVE_BG_API_KEY.trim() !== '';
  },

  async remove(env, { bytes, mimeType, filename }) {
    const form = new FormData();
    form.append('image_file', new Blob([bytes], { type: mimeType }), filename || 'upload');
    // size=auto lets the provider pick the highest resolution our credits allow.
    // format=png keeps the alpha channel, which is the whole point of the product.
    form.append('size', 'auto');
    form.append('format', 'png');

    let response;
    try {
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'X-Api-Key': env.REMOVE_BG_API_KEY.trim(),
          Accept: 'image/png',
        },
        body: form,
      });
    } catch (error) {
      throw new ProviderError('provider_unreachable', 'remove.bg request failed at the network level.', {
        cause: error,
        status: 504,
        publicMessage:
          'We could not reach the removal service. This is usually temporary, please try again in a moment.',
      });
    }

    if (!response.ok) {
      throw await mapProviderError(response);
    }

    const output = await response.arrayBuffer();
    if (output.byteLength === 0) {
      throw new ProviderError('provider_empty_result', 'remove.bg returned an empty body.', {
        status: 502,
        publicMessage: 'The removal service returned an empty image. Please try again.',
      });
    }

    return { bytes: output, mimeType: 'image/png' };
  },
};

/**
 * Turn the provider's HTTP failure into our own vocabulary. The provider body is
 * logged for operators but never forwarded to users: it can leak account state.
 */
async function mapProviderError(response) {
  const detail = await readProviderDetail(response);
  console.error('[remove.bg] upstream failure', response.status, detail);

  switch (response.status) {
    case 400:
      return new ProviderError('image_rejected', `remove.bg rejected the image: ${detail}`, {
        status: 422,
        publicMessage: 'We could not read that image. Try a different photo, or re-save it as JPG or PNG.',
      });
    case 402:
      return new ProviderError('provider_credits_exhausted', 'remove.bg account has no credits left.', {
        status: 503,
        publicMessage: 'The removal service is out of capacity right now. Please try again later.',
      });
    case 403:
      return new ProviderError('provider_auth_failed', 'remove.bg rejected the API key.', {
        status: 503,
        publicMessage: 'Background removal is temporarily unavailable. Please try again later.',
      });
    case 429:
      return new ProviderError('provider_rate_limited', 'remove.bg rate limit hit.', {
        status: 429,
        publicMessage: 'Too many images at once. Give it a few seconds and try again.',
      });
    default:
      return new ProviderError('provider_error', `remove.bg returned HTTP ${response.status}: ${detail}`, {
        status: 502,
      });
  }
}

async function readProviderDetail(response) {
  try {
    const text = await response.text();
    if (!text) return '(no body)';
    try {
      const parsed = JSON.parse(text);
      const first = parsed?.errors?.[0];
      return first?.detail || first?.title || text.slice(0, 300);
    } catch {
      return text.slice(0, 300);
    }
  } catch {
    return '(unreadable body)';
  }
}
