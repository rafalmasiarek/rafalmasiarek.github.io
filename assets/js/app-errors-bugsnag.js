// assets/js/app-errors-bugsnag.js
/*!
 *
 * app-errors-bugsnag.js
 *
 * Optional Bugsnag reporter adapter for AppErrors. Load this file after
 * app-errors.js (and after the Bugsnag SDK, in any order relative to it —
 * window.Bugsnag is only checked at report time, not at load time).
 *
 * If AppErrors is missing, this file is a no-op. If Bugsnag is missing or
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
    critical: 'error'
  };

  function bugsnag(options) {
    options = options && typeof options === 'object' ? options : {};

    return function appErrorsBugsnag(event, next) {
      try {
        var Bugsnag = global.Bugsnag;
        if (Bugsnag && typeof Bugsnag.notify === 'function') {
          var errorToNotify = event.error instanceof Error ? event.error : new Error(event.message);

          Bugsnag.notify(errorToNotify, function (bsEvent) {
            bsEvent.severity = SEVERITY_MAP[event.severity] || 'error';
            bsEvent.context = event.operation || event.component || bsEvent.context;

            var metadata = {
              code: event.code,
              component: event.component,
              operation: event.operation,
              handled: event.handled,
              id: event.id,
              environment: event.environment
            };

            if (options.includeMetadata !== false && event.metadata) {
              metadata.details = event.metadata;
            }

            bsEvent.addMetadata('appErrors', metadata);
          });
        }
      } catch (reportingError) {
        try {
          console.error('[AppErrors:bugsnag] reporting failed:', reportingError);
        } catch (_ignored) {
          // Nothing left to fall back to.
        }
      }

      return next();
    };
  }

  AppErrors.middleware.bugsnag = bugsnag;
})(window);
