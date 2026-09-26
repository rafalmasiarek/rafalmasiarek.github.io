// assets/js/app-errors.js
/*!
 *
 * app-errors.js
 *
 * Provider-agnostic browser error handling core.
 *
 * Design principles:
 *   - Zero-dependency, zero-vendor. Works with no external error-reporting
 *     provider loaded at all.
 *   - Never a single point of failure: a broken middleware, a broken
 *     reporter, or a missing provider SDK must never break the host page.
 *   - Domain-agnostic: this file must remain copy-pasteable into another
 *     browser project unchanged. It ships with no application-specific
 *     error codes; those are added at runtime via AppErrors.registerCode().
 *
 * See assets/js/app-errors.md for the full reference.
 */
(function (global) {
  'use strict';

  if (global.AppErrors) {
    // Already loaded (e.g. duplicate <script> tag) — do not clobber state.
    return;
  }

  var VERSION = '1.0.0';

  // ---------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------

  var DEFAULT_CONFIG = {
    environment: 'production',
    defaultSeverity: 'error',
    captureGlobalErrors: false,
    captureUnhandledRejections: false,
    includeStack: true,
    exposeInternalMessages: false,
    maxMetadataDepth: 4,
    maxMetadataItems: 50,
    maxStringLength: 1000,
    deduplicate: true,
    autoDefaults: true
  };

  var config = shallowMerge({}, DEFAULT_CONFIG);

  var SEVERITIES = ['info', 'warning', 'error', 'critical'];

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function shallowMerge(target, source) {
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
    return target;
  }

  function internalLog() {
    var args = ['[AppErrors]'].concat(Array.prototype.slice.call(arguments));
    try {
      console.error.apply(console, args);
    } catch (_ignored) {
      // Nothing left to fall back to.
    }
  }

  function configure(partial) {
    if (!isPlainObject(partial)) {
      if (partial !== undefined) {
        internalLog('configure() expects a plain object, ignoring invalid value:', partial);
      }
      return shallowMerge({}, config);
    }

    var next = shallowMerge({}, config);

    Object.keys(partial).forEach(function (key) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_CONFIG, key)) {
        internalLog('configure(): unknown config key "' + key + '", ignoring.');
        return;
      }

      var value = partial[key];
      var currentType = typeof DEFAULT_CONFIG[key];
      if (typeof value !== currentType) {
        internalLog('configure(): "' + key + '" expected ' + currentType + ', got ' + typeof value + ', ignoring.');
        return;
      }

      if (key === 'defaultSeverity' && SEVERITIES.indexOf(value) === -1) {
        internalLog('configure(): invalid defaultSeverity "' + value + '", ignoring.');
        return;
      }

      next[key] = value;
    });

    var wasAutoDefaults = config.autoDefaults;
    shallowMerge(config, next);

    if (wasAutoDefaults && config.autoDefaults === false) {
      disableAutoDefaults();
    }

    if (config.captureGlobalErrors || config.captureUnhandledRejections) {
      installGlobalCapture({
        errors: config.captureGlobalErrors,
        rejections: config.captureUnhandledRejections
      });
    }

    return shallowMerge({}, config);
  }

  function getConfig() {
    return shallowMerge({}, config);
  }

  // ---------------------------------------------------------------------
  // Error code registry
  // ---------------------------------------------------------------------

  // Only truly domain-agnostic codes live here. Application-specific codes
  // must be added via AppErrors.registerCode() by the code that owns them.
  var CODE_REGISTRY = {
    UNEXPECTED_ERROR: {
      severity: 'error',
      publicMessage: 'An unexpected error occurred.',
      category: 'generic'
    },
    NETWORK_REQUEST_FAILED: {
      severity: 'error',
      publicMessage: 'A network request failed. Please try again.',
      category: 'network'
    },
    NETWORK_TIMEOUT: {
      severity: 'warning',
      publicMessage: 'The request timed out. Please try again.',
      category: 'network'
    },
    NETWORK_ABORTED: {
      severity: 'info',
      publicMessage: 'The request was cancelled.',
      category: 'network'
    }
  };

  var CODE_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;

  function registerCode(code, definition) {
    if (typeof code !== 'string' || !CODE_NAME_PATTERN.test(code)) {
      internalLog('registerCode(): invalid code name, expected UPPER_SNAKE_CASE, got:', code);
      return;
    }
    if (!isPlainObject(definition)) {
      internalLog('registerCode(): definition for "' + code + '" must be a plain object, ignoring.');
      return;
    }

    var severity = definition.severity;
    if (severity !== undefined && SEVERITIES.indexOf(severity) === -1) {
      internalLog('registerCode(): invalid severity for "' + code + '", ignoring severity.');
      severity = undefined;
    }

    CODE_REGISTRY[code] = {
      severity: severity || config.defaultSeverity,
      publicMessage: typeof definition.publicMessage === 'string' ? definition.publicMessage : undefined,
      category: typeof definition.category === 'string' ? definition.category : undefined
    };
  }

  function getCodeDefinition(code) {
    var def = CODE_REGISTRY[code];
    return def ? shallowMerge({}, def) : undefined;
  }

  function getCodes() {
    var out = {};
    Object.keys(CODE_REGISTRY).forEach(function (name) {
      out[name] = name;
    });
    return out;
  }

  // ---------------------------------------------------------------------
  // AppError
  // ---------------------------------------------------------------------

  function generateId() {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  // ---------------------------------------------------------------------
  // Session-scoped request/trace id (X-Amzn-Trace-Id-style: one UUID v4
  // per tab session, shared by every script, sent on every backend call)
  // ---------------------------------------------------------------------

  var REQUEST_ID_STORAGE_KEY = 'appErrorsRequestId';
  var inMemoryRequestId = null;

  function generateUuidV4() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = [];
      for (var i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
      return hex.slice(0, 4).join('') + '-' + hex.slice(4, 6).join('') + '-' +
        hex.slice(6, 8).join('') + '-' + hex.slice(8, 10).join('') + '-' + hex.slice(10, 16).join('');
    }
    // Last-resort, non-cryptographic fallback — still UUID v4 shaped.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getRequestId() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        var existing = sessionStorage.getItem(REQUEST_ID_STORAGE_KEY);
        if (existing) return existing;
        var fresh = generateUuidV4();
        sessionStorage.setItem(REQUEST_ID_STORAGE_KEY, fresh);
        return fresh;
      }
    } catch (_ignored) {
      // sessionStorage unavailable — fall back to an in-memory id.
    }
    if (!inMemoryRequestId) {
      inMemoryRequestId = generateUuidV4();
    }
    return inMemoryRequestId;
  }

  function AppError(message, options) {
    options = isPlainObject(options) ? options : {};

    var errorOptions = options.cause !== undefined ? { cause: options.cause } : undefined;
    Error.call(this, message, errorOptions);

    // Some engines don't apply `message`/`cause` via Error.call on a
    // subclassed instance consistently — set explicitly to be safe.
    this.message = message;
    if (options.cause !== undefined && this.cause === undefined) {
      this.cause = options.cause;
    }

    this.name = 'AppError';
    this.id = generateId();
    this.code = typeof options.code === 'string' ? options.code : undefined;
    this.severity = SEVERITIES.indexOf(options.severity) !== -1 ? options.severity : undefined;
    this.publicMessage = typeof options.publicMessage === 'string' ? options.publicMessage : undefined;
    this.metadata = isPlainObject(options.metadata) ? options.metadata : {};
    this.component = typeof options.component === 'string' ? options.component : undefined;
    this.operation = typeof options.operation === 'string' ? options.operation : undefined;
    this.handled = options.handled !== false;
    this.timestamp = new Date().toISOString();

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, AppError);
    }
  }

  AppError.prototype = Object.create(Error.prototype);
  AppError.prototype.constructor = AppError;

  // ---------------------------------------------------------------------
  // Safe serializer
  // ---------------------------------------------------------------------

  function truncateString(str) {
    var max = config.maxStringLength;
    if (str.length <= max) return str;
    return str.slice(0, max) + '…(truncated)';
  }

  function serializeError(err) {
    var out = { name: err.name, message: truncateString(String(err.message || '')) };
    if (config.includeStack && typeof err.stack === 'string') {
      out.stack = err.stack;
    }
    return out;
  }

  function safeSerialize(value, depth, seen) {
    try {
      if (value === null || value === undefined) return value;

      var type = typeof value;
      if (type === 'string') return truncateString(value);
      if (type === 'number' || type === 'boolean') return value;
      if (type === 'function') return '[Function]';

      if (depth > config.maxMetadataDepth) return '[MaxDepthExceeded]';

      if (value instanceof Error) return serializeError(value);

      if (typeof Node !== 'undefined' && value instanceof Node) {
        return '[DOMNode:' + (value.nodeName || 'unknown') + ']';
      }

      if (typeof Event !== 'undefined' && value instanceof Event) {
        return { type: value.type };
      }

      if (typeof Response !== 'undefined' && value instanceof Response) {
        return { url: value.url, status: value.status, ok: value.ok };
      }

      if (Array.isArray(value)) {
        if (seen.indexOf(value) !== -1) return '[Circular]';
        seen = seen.concat([value]);
        var arr = [];
        for (var i = 0; i < value.length && i < config.maxMetadataItems; i++) {
          arr.push(safeSerialize(value[i], depth + 1, seen));
        }
        return arr;
      }

      if (type === 'object') {
        if (seen.indexOf(value) !== -1) return '[Circular]';
        seen = seen.concat([value]);
        var out = {};
        var keys = Object.keys(value).slice(0, config.maxMetadataItems);
        for (var k = 0; k < keys.length; k++) {
          var key = keys[k];
          try {
            out[key] = safeSerialize(value[key], depth + 1, seen);
          } catch (getterError) {
            out[key] = '[Unserializable]';
          }
        }
        return out;
      }

      return String(value);
    } catch (fatal) {
      return '[SerializationError]';
    }
  }

  function safeSerializeMetadata(value) {
    if (!isPlainObject(value)) return {};
    return safeSerialize(value, 0, []);
  }

  // ---------------------------------------------------------------------
  // Redaction
  // ---------------------------------------------------------------------

  var DEFAULT_SENSITIVE_KEYS = [
    'password', 'passwd', 'secret', 'token', 'authorization', 'cookie',
    'csrf', 'recaptcha', 'email', 'message', 'body', 'pgp', 'private_key', 'api_key'
  ];

  function isSensitiveKey(key, sensitiveKeys) {
    var lower = String(key).toLowerCase();
    return sensitiveKeys.some(function (needle) {
      return lower.indexOf(needle) !== -1;
    });
  }

  function redactValue(value, sensitiveKeys, depth) {
    if (depth > config.maxMetadataDepth) return value;
    if (Array.isArray(value)) {
      return value.map(function (item) {
        return redactValue(item, sensitiveKeys, depth + 1);
      });
    }
    if (isPlainObject(value)) {
      var out = {};
      Object.keys(value).forEach(function (key) {
        if (isSensitiveKey(key, sensitiveKeys)) {
          out[key] = '[REDACTED]';
        } else {
          out[key] = redactValue(value[key], sensitiveKeys, depth + 1);
        }
      });
      return out;
    }
    return value;
  }

  // ---------------------------------------------------------------------
  // Normalization
  // ---------------------------------------------------------------------

  function normalizeInput(input) {
    if (input instanceof AppError) {
      return {
        error: input,
        message: input.message,
        code: input.code,
        severity: input.severity,
        publicMessage: input.publicMessage,
        metadata: input.metadata,
        component: input.component,
        operation: input.operation,
        handled: input.handled
      };
    }

    if (input instanceof Error) {
      return { error: input, message: input.message, metadata: {} };
    }

    if (typeof input === 'string') {
      return { error: new Error(input), message: input, metadata: {} };
    }

    if (isPlainObject(input) && typeof input.message === 'string') {
      return {
        error: new Error(input.message),
        message: input.message,
        metadata: { originalValue: safeSerializeMetadata(input) }
      };
    }

    return {
      error: new Error('Unknown error'),
      message: 'Unknown error',
      code: 'UNEXPECTED_ERROR',
      metadata: input === null || input === undefined ? {} : { originalValue: safeSerialize(input, 0, []) }
    };
  }

  function buildEvent(input, context) {
    context = isPlainObject(context) ? context : {};
    var normalized = normalizeInput(input);

    var code = normalized.code || context.code || 'UNEXPECTED_ERROR';
    var registryDef = CODE_REGISTRY[code];

    var severity = normalized.severity || context.severity || (registryDef && registryDef.severity) || config.defaultSeverity;
    var publicMessage = normalized.publicMessage || context.publicMessage ||
      (registryDef && registryDef.publicMessage) || 'An unexpected error occurred.';

    // Serialize each metadata source through the safe serializer BEFORE
    // merging: a plain shallowMerge would read properties directly and
    // could throw on a hostile getter, defeating the whole point of the
    // safe serializer.
    var mergedMetadata = shallowMerge(
      shallowMerge({}, safeSerializeMetadata(normalized.metadata || {})),
      safeSerializeMetadata(context.metadata || {})
    );

    return {
      id: generateId(),
      name: 'AppErrorEvent',
      code: code,
      message: normalized.message,
      publicMessage: publicMessage,
      severity: severity,
      component: context.component || normalized.component,
      operation: context.operation || normalized.operation,
      handled: context.handled !== undefined ? context.handled !== false : (normalized.handled !== false),
      timestamp: new Date().toISOString(),
      environment: config.environment,
      metadata: mergedMetadata,
      cause: normalized.error && normalized.error.cause !== undefined ? normalized.error.cause : undefined,
      error: normalized.error
    };
  }

  // ---------------------------------------------------------------------
  // Middleware pipeline
  // ---------------------------------------------------------------------

  var middlewares = [];

  function use(fn, name) {
    if (typeof fn !== 'function') {
      internalLog('use(): middleware must be a function, ignoring.');
      return function noop() {};
    }
    var entry = { fn: fn, name: name || fn.name || 'anonymous' };
    middlewares.push(entry);
    return function remove() {
      var idx = middlewares.indexOf(entry);
      if (idx !== -1) middlewares.splice(idx, 1);
    };
  }

  function runPipeline(event) {
    var failures = [];
    var ranMiddleware = [];
    var cursor = 0;
    var snapshot = middlewares.slice();

    function next() {
      var current = cursor;
      cursor += 1;
      if (current >= snapshot.length) return Promise.resolve();

      var entry = snapshot[current];
      var calledNext = false;

      function guardedNext() {
        if (calledNext) {
          internalLog('middleware "' + entry.name + '" called next() more than once; ignoring.');
          return Promise.resolve();
        }
        calledNext = true;
        return next();
      }

      ranMiddleware.push(entry.name);

      return Promise.resolve()
        .then(function () {
          return entry.fn(event, guardedNext);
        })
        .catch(function (err) {
          failures.push({ middleware: entry.name, error: err });
          internalLog('middleware "' + entry.name + '" threw:', err);
        })
        .then(function () {
          if (!calledNext) return Promise.resolve();
        });
    }

    return next().then(function () {
      return { failures: failures, ranMiddleware: ranMiddleware };
    });
  }

  // ---------------------------------------------------------------------
  // Dedup
  // ---------------------------------------------------------------------

  var reportedInstances = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  function isDuplicate(input) {
    if (!config.deduplicate || !reportedInstances) return false;
    if (!(input instanceof Error)) return false;
    return reportedInstances.has(input);
  }

  function markReported(input) {
    if (reportedInstances && input instanceof Error) {
      reportedInstances.add(input);
    }
  }

  // ---------------------------------------------------------------------
  // report()
  // ---------------------------------------------------------------------

  function report(input, context) {
    if (isDuplicate(input)) {
      return Promise.resolve({ event: null, deduplicated: true, ranMiddleware: [], failures: [] });
    }

    var event;
    try {
      event = buildEvent(input, context);
      markReported(input);
    } catch (buildError) {
      internalLog('failed to build error event:', buildError);
      try {
        console.error(input, context);
      } catch (_ignored) {}
      return Promise.resolve({
        event: null,
        deduplicated: false,
        ranMiddleware: [],
        failures: [{ middleware: 'core', error: buildError }]
      });
    }

    var promise = runPipeline(event)
      .then(function (result) {
        return { event: event, deduplicated: false, ranMiddleware: result.ranMiddleware, failures: result.failures };
      })
      .catch(function (err) {
        internalLog('pipeline crashed unexpectedly:', err);
        return { event: event, deduplicated: false, ranMiddleware: [], failures: [{ middleware: 'pipeline', error: err }] };
      });

    // Callers are never required to await report(); make sure a rejected
    // promise never surfaces as an unhandled rejection.
    promise.catch(function () {});

    return promise;
  }

  function createError(message, options) {
    return new AppError(message, options);
  }

  // ---------------------------------------------------------------------
  // Global capture
  // ---------------------------------------------------------------------

  var errorListener = null;
  var rejectionListener = null;

  function installGlobalCapture(options) {
    options = isPlainObject(options) ? options : {};

    if (options.errors !== false && !errorListener && typeof global.addEventListener === 'function') {
      errorListener = function (event) {
        report(event.error || event.message, {
          component: 'global',
          operation: 'window-error',
          handled: false,
          metadata: {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
          }
        });
      };
      global.addEventListener('error', errorListener);
    }

    if (options.rejections !== false && !rejectionListener && typeof global.addEventListener === 'function') {
      rejectionListener = function (event) {
        report(event.reason, {
          component: 'global',
          operation: 'unhandled-rejection',
          handled: false
        });
      };
      global.addEventListener('unhandledrejection', rejectionListener);
    }

    return function disable() {
      if (errorListener) {
        global.removeEventListener('error', errorListener);
        errorListener = null;
      }
      if (rejectionListener) {
        global.removeEventListener('unhandledrejection', rejectionListener);
        rejectionListener = null;
      }
    };
  }

  function captureGlobalErrors(options) {
    options = isPlainObject(options) ? options : { errors: true, rejections: true };
    config.captureGlobalErrors = options.errors !== false;
    config.captureUnhandledRejections = options.rejections !== false;
    return installGlobalCapture(options);
  }

  // ---------------------------------------------------------------------
  // Built-in middleware
  // ---------------------------------------------------------------------

  var CONSOLE_METHOD_BY_SEVERITY = {
    info: 'info',
    warning: 'warn',
    error: 'error',
    critical: 'error'
  };

  function consoleMiddleware() {
    return function appErrorsConsole(event, next) {
      var method = CONSOLE_METHOD_BY_SEVERITY[event.severity] || 'error';
      var label = '[' + event.severity.toUpperCase() + '] ' + event.code +
        (event.component ? ' (' + event.component + (event.operation ? '/' + event.operation : '') + ')' : '');
      try {
        console[method](label + ':', event.message, event);
      } catch (_ignored) {
        internalLog('console middleware failed to log event', event);
      }
      return next();
    };
  }

  function metadataMiddleware() {
    return function appErrorsMetadata(event, next) {
      try {
        var loc = global.location || {};
        var nav = global.navigator || {};
        event.metadata = event.metadata || {};
        if (!event.metadata.browser) {
          event.metadata.browser = {
            url: loc.href,
            pathname: loc.pathname,
            hostname: loc.hostname,
            userAgent: nav.userAgent,
            language: nav.language,
            online: nav.onLine,
            viewport: (global.innerWidth || 0) + 'x' + (global.innerHeight || 0)
          };
        }
      } catch (err) {
        internalLog('metadata middleware failed:', err);
      }
      return next();
    };
  }

  function redactMiddleware(options) {
    options = isPlainObject(options) ? options : {};
    var sensitiveKeys = DEFAULT_SENSITIVE_KEYS.concat(Array.isArray(options.keys) ? options.keys : [])
      .map(function (k) { return String(k).toLowerCase(); });

    return function appErrorsRedact(event, next) {
      try {
        if (event.metadata) {
          event.metadata = redactValue(event.metadata, sensitiveKeys, 0);
        }
      } catch (err) {
        internalLog('redact middleware failed:', err);
      }
      return next();
    };
  }

  var defaultMiddlewareHandles = [];

  function enableAutoDefaults() {
    if (defaultMiddlewareHandles.length) return;
    defaultMiddlewareHandles.push(use(redactMiddleware(), 'redact'));
    defaultMiddlewareHandles.push(use(metadataMiddleware(), 'metadata'));
    defaultMiddlewareHandles.push(use(consoleMiddleware(), 'console'));
  }

  function disableAutoDefaults() {
    defaultMiddlewareHandles.forEach(function (remove) { remove(); });
    defaultMiddlewareHandles = [];
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  var AppErrors = {
    version: VERSION,
    Error: AppError,
    codes: getCodes(),
    configure: configure,
    getConfig: getConfig,
    registerCode: registerCode,
    getCodeDefinition: getCodeDefinition,
    report: report,
    use: use,
    createError: createError,
    captureGlobalErrors: captureGlobalErrors,
    getRequestId: getRequestId,
    middleware: {
      console: consoleMiddleware,
      metadata: metadataMiddleware,
      redact: redactMiddleware
    }
  };

  // Keep AppErrors.codes live as new codes get registered.
  var originalRegisterCode = registerCode;
  registerCode = function (code, definition) {
    originalRegisterCode(code, definition);
    AppErrors.codes = getCodes();
  };
  AppErrors.registerCode = registerCode;

  if (config.autoDefaults) {
    enableAutoDefaults();
  }

  global.AppErrors = AppErrors;
})(window);
