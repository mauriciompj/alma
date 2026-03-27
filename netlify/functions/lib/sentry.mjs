/**
 * ALMA — Sentry Error Tracking
 * Wraps Netlify function handlers with automatic error capture
 */

import * as Sentry from '@sentry/node';

const DSN = process.env.SENTRY_DSN || '';

let initialized = false;

function ensureInit() {
  if (initialized || !DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.CONTEXT || 'production', // Netlify sets CONTEXT
    tracesSampleRate: 0.1, // 10% of transactions for performance
    beforeSend(event) {
      // Strip sensitive data from breadcrumbs
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(b => {
          if (b.data?.body) b.data.body = '[REDACTED]';
          if (b.data?.headers?.authorization) b.data.headers.authorization = '[REDACTED]';
          return b;
        });
      }
      return event;
    },
  });
  initialized = true;
}

/**
 * Wrap a Netlify function handler with Sentry error tracking.
 * Captures unhandled errors and adds context (function name, IP, action).
 */
export function withSentry(functionName, handler) {
  return async (req, context) => {
    ensureInit();
    if (!DSN) return handler(req, context);

    try {
      const response = await handler(req, context);

      // Capture 5xx responses as warnings
      if (response.status >= 500) {
        Sentry.captureMessage(`${functionName} returned ${response.status}`, {
          level: 'warning',
          tags: { function: functionName, status: response.status },
        });
      }

      return response;
    } catch (error) {
      Sentry.captureException(error, {
        tags: { function: functionName },
        extra: {
          method: req.method,
          url: req.url,
          ip: req.headers.get('x-forwarded-for') || 'unknown',
        },
      });
      await Sentry.flush(2000);

      // Re-throw so Netlify logs the error too
      throw error;
    }
  };
}

/**
 * Manually capture an error with context (for caught errors)
 */
export function captureError(error, context = {}) {
  ensureInit();
  if (!DSN) return;
  Sentry.captureException(error, { extra: context });
}

/**
 * Manually capture a warning message
 */
export function captureWarning(message, context = {}) {
  ensureInit();
  if (!DSN) return;
  Sentry.captureMessage(message, { level: 'warning', extra: context });
}
