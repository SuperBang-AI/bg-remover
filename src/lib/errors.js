/**
 * Every failure that originates outside our code (provider down, bad key,
 * rate limit) is funnelled through this error so the route layer never has to
 * know which vendor we are calling.
 */
export class ProviderError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ProviderError';
    this.code = code;
    this.status = options.status ?? 502;
    /** Text meant for the end user. Falls back to a neutral sentence. */
    this.publicMessage = options.publicMessage ?? 'The background removal service is unavailable right now. Please try again in a moment.';
  }
}
