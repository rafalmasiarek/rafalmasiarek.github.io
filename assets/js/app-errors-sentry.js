// assets/js/app-errors-sentry.js
/*!
 *
 * app-errors-sentry.js
 *
 * Optional Sentry reporter adapter for AppErrors. Load this file after
 * app-errors.js (and after the Sentry SDK, in any order relative to it —
 * window.Sentry is only checked at report time, not at load time).
 *
 * If AppErrors is missing, this file is a no-op. If Sentry is missing or
 * broken, the middleware silently no-ops and never breaks the page.
 */
(function (global) {
  'use strict';

  var AppErrors = global.AppErrors;
  if (!AppErrors || !AppErrors.middleware) {
    return;
  }

  var SEVERITY_MAP = {
    info: 'info',
    warning: 'warning',
    error: 'error',
    critical: 'fatal'
  };

  function sentry(options) {
    options = options && typeof options === 'object' ? options : {};

    return function appErrorsSentry(event, next) {
      try {
        var Sentry = global.Sentry;
        if (Sentry && typeof Sentry.captureException === 'function') {
          var errorToCapture = event.error instanceof Error ? event.error : new Error(event.message);

          var scopeOptions = {
            level: SEVERITY_MAP[event.severity] || 'error',
            tags: {
              code: event.code,
              component: event.component,
              operation: event.operation,
              handled: String(event.handled)
            }
          };

          if (options.includeMetadata !== false && event.metadata) {
            scopeOptions.extra = { appErrors: event.metadata, id: event.id, environment: event.environment };
          }

          Sentry.captureException(errorToCapture, scopeOptions);
        }
      } catch (reportingError) {
        try {
          console.error('[AppErrors:sentry] reporting failed:', reportingError);
        } catch (_ignored) {
          // Nothing left to fall back to.
        }
      }

      return next();
    };
  }

  AppErrors.middleware.sentry = sentry;
})(window);
