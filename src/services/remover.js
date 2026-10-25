import { ProviderError } from '../lib/errors.js';
import { removeBgProvider } from './providers/removebg.js';

/**
 * Provider registry.
 *
 * The rest of the app only ever calls removeBackground(). Swapping vendors means
 * adding one module to ./providers and one line here, then setting BG_PROVIDER
 * in the environment. No caller changes.
 *
 * To add Photoroom later, for example:
 *   1. src/services/providers/photoroom.js  (POST https://sdk.photoroom.com/v1/segment)
 *   2. import + add to REGISTRY below
 *   3. wrangler secret put PHOTOROOM_API_KEY, then BG_PROVIDER="photoroom"
 */
const REGISTRY = new Map([[removeBgProvider.id, removeBgProvider]]);

export const DEFAULT_PROVIDER_ID = removeBgProvider.id;

export function resolveProvider(env) {
  const id = (env.BG_PROVIDER || DEFAULT_PROVIDER_ID).trim();
  const provider = REGISTRY.get(id);
  if (!provider) {
    throw new ProviderError('provider_unknown', `BG_PROVIDER "${id}" is not registered.`, {
      status: 500,
      publicMessage: 'Background removal is misconfigured on this deployment.',
    });
  }
  return provider;
}

/** Whether the configured provider has everything it needs to run. */
export function isProviderReady(env) {
  try {
    return resolveProvider(env).isConfigured(env);
  } catch {
    return false;
  }
}

/**
 * Single entry point used by the HTTP layer.
 * @param {object} env Worker environment
 * @param {{bytes: ArrayBuffer, mimeType: string, filename: string}} input
 */
export async function removeBackground(env, input) {
  const provider = resolveProvider(env);

  if (!provider.isConfigured(env)) {
    throw new ProviderError('provider_not_configured', `Provider "${provider.id}" is not configured.`, {
      status: 503,
      publicMessage:
        'Background removal is not switched on for this build yet. The upload and comparison interface is ready; the removal key still has to be set.',
    });
  }

  const startedAt = Date.now();
  const result = await provider.remove(env, input);

  return {
    ...result,
    provider: provider.id,
    durationMs: Date.now() - startedAt,
  };
}
