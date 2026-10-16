// Shared by the browser bundle and host runner. Never collect chat or request bodies.
export const TERMINAL_PREFIX = 'VARCAMP_GUIDE_TERMINAL ';
// Normalize camelCase, separator variants and casing before classifying any field.
const sensitiveField = name => /authorization|cookie|token|password|secret|credential|apikey|headers?|chat|participant|body|content/.test(name.replace(/[^a-z0-9]/gi, '').toLowerCase());
export function failureRecord(value, context = {}) {
  let redacted = false, truncated = false, serializationFailed = false, budget = 10000;
  const bytes = value => new TextEncoder().encode(value).length;
  const seen = new Set();
  const text = input => {
    let result = input.replace(/https?:\/\/[^\s)<>"']+/gi, raw => {
      try { const url = new URL(raw); if (url.username || url.password || url.search || url.hash) { redacted = true; url.username = ''; url.password = ''; url.search = url.search ? '?REDACTED' : ''; url.hash = url.hash ? '#REDACTED' : ''; } return url.href; } catch { return '[invalid URL]'; }
    }).replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi, () => { redacted = true; return '[REDACTED authorization]'; });
    // Scan key prefixes independently: a harmless outer `Error:` cannot swallow a
    // nested credential assignment, and quoted JSON keys use the same classifier.
    const assignment = /["']?([a-z][a-z0-9_-]*)["']?\s*[:=]\s*/gi;
    let match, cursor = 0, normalized = '';
    while ((match = assignment.exec(result))) {
      if (!sensitiveField(match[1])) continue;
      const rest = result.slice(assignment.lastIndex), length = rest.search(/[\r\n,;]/);
      const end = length < 0 ? result.length : assignment.lastIndex + length;
      normalized += result.slice(cursor, match.index) + `${match[1]}=[REDACTED]`;
      cursor = end; assignment.lastIndex = end; redacted = true;
    }
    result = normalized + result.slice(cursor);
    const limit = Math.min(4096, budget); if (bytes(result) > limit) {
      result = result.slice(0, limit); while (bytes(result) > limit) result = result.slice(0, -1); truncated = true;
    }
    budget -= bytes(result); return result;
  };
  const read = (object, key) => { try { return object[key]; } catch { serializationFailed = true; return '[unreadable]'; } };
  const copy = (input, depth = 0) => {
    if (budget <= 0 || depth > 4) { truncated = true; return '[truncated]'; }
    if (typeof input === 'string') return text(input);
    if (input === null || typeof input === 'boolean' || typeof input === 'number') return input;
    if (typeof input !== 'object') return text(String(input));
    if (seen.has(input)) { truncated = true; return '[circular]'; } seen.add(input);
    if (input instanceof Error || typeof read(input, 'stack') === 'string') {
      const result = { name: copy(read(input, 'name'), depth + 1), message: copy(read(input, 'message'), depth + 1), stack: copy(read(input, 'stack'), depth + 1) };
      if (read(input, 'cause') !== undefined) result.cause = copy(read(input, 'cause'), depth + 1);
      return result;
    }
    if (Array.isArray(input)) { if (input.length > 16) truncated = true; return input.slice(0, 16).map(value => copy(value, depth + 1)); }
    let keys; try { keys = Object.keys(input); } catch { serializationFailed = true; return '[unreadable]'; }
    if (keys.length > 16) truncated = true;
    const result = {};
    for (const key of keys.slice(0, 16)) {
      if (read(input, key) === undefined) continue;
      if (sensitiveField(key)) { result[text(key).slice(0, 80)] = '[REDACTED]'; redacted = true; }
      else result[text(key).slice(0, 80)] = copy(read(input, key), depth + 1);
    }
    return result;
  };
  try {
    const metadata = copy(context);
    const error = copy(value);
    const result = { ...metadata, error, redacted, truncated, serializationFailed };
    if (bytes(JSON.stringify(result)) > 16384) {
      // Structural/escaping overhead is also bounded, with a visible loss marker.
      return { error: '[truncated: encoded evidence exceeded 16KiB]', redacted, truncated: true, serializationFailed };
    }
    return result;
  }
  catch { return { error: '[serialization failed]', redacted: true, truncated: true, serializationFailed: true }; }
}
export function diagnosticLine(text, record) {
  const summary = failureRecord(text).error;
  const normalized = failureRecord(record ?? failureRecord(text, { event: 'controller-terminal' }));
  const safe = normalized.error && typeof normalized.error === 'object' ? normalized.error : { event: 'controller-terminal', error: '[invalid terminal record]' };
  return TERMINAL_PREFIX + JSON.stringify({ ...safe,
    redacted: normalized.redacted || safe.redacted === true, truncated: normalized.truncated || safe.truncated === true,
    serializationFailed: normalized.serializationFailed || safe.serializationFailed === true,
    summary: typeof summary === 'string' ? summary.slice(0, 256) : 'Controller stopped' });
}

// A phase end describes expected wake; only the controller can issue its nonrenewable lease.
export const OPERATION_BUDGET_MS = 10000;
export const IDLE_BUDGET_MS = Object.freeze({ 'step-rest': 100, rest: 2000, conversation: 20000 });
const finite = value => Number.isFinite(value) && value >= 0;
function validLeaseShape(outcome, e) {
  if (!e || !finite(e.at) || !finite(e.leaseDeadline) || e.leaseDeadline < e.at) return false;
  for (const field of ['operation','phase']) if (e[field] !== undefined && (typeof e[field] !== 'string' || !/^[a-z-]{1,40}$/.test(e[field]))) return false;
  if (outcome === 'pending') return ['map','position','move'].includes(e.operation) && ['startup','pre-step'].includes(e.phase) &&
    Number.isInteger(e.sequence) && e.sequence > 0 && finite(e.startedAt) && e.startedAt <= e.at &&
    e.operationBudgetMs === OPERATION_BUDGET_MS && e.deadline === e.startedAt + OPERATION_BUDGET_MS && e.leaseDeadline === e.deadline;
  if (outcome === 'allowed-idle') return typeof e.reason === 'string' && Object.hasOwn(IDLE_BUDGET_MS, e.reason) && e.idleBudgetMs === IDLE_BUDGET_MS[e.reason] &&
    finite(e.idleStartedAt) && e.idleStartedAt <= e.at && e.deadline === e.idleStartedAt + e.idleBudgetMs && e.leaseDeadline === e.deadline + OPERATION_BUDGET_MS;
  return outcome === 'progress' && e.operationBudgetMs === OPERATION_BUDGET_MS && e.leaseDeadline === e.at + OPERATION_BUDGET_MS;
}
/** Canonical projection retains every field needed to validate saved authority. */
export function controllerObservation(record) {
  if (!record || !['pending','progress','allowed-idle','terminal'].includes(record.state) ||
      (record.state !== 'terminal' && !validLeaseShape(record.state, record))) throw Error('Invalid controller lifecycle lease shape');
  const evidence = {};
  for (const key of ['operation','phase','sequence','steps','at','startedAt','operationBudgetMs','deadline','leaseDeadline','controllerGeneration','reason','idleStartedAt','idleBudgetMs']) {
    if (record[key] !== undefined) evidence[key] = record[key];
  }
  return { outcome: record.state, evidence };
}
/** Controller construction and all host consumers share the same finite state contract. */
export function withControllerLease(record, at) {
  let lease;
  if (record.state === 'pending') lease = { operationBudgetMs: OPERATION_BUDGET_MS, leaseDeadline: record.deadline };
  else if (record.state === 'allowed-idle') {
    const idleStartedAt = record.idleStartedAt ?? at, idleBudgetMs = IDLE_BUDGET_MS[record.reason];
    const deadline = idleStartedAt + idleBudgetMs;
    lease = { idleStartedAt, idleBudgetMs, deadline, leaseDeadline: deadline + OPERATION_BUDGET_MS };
  } else lease = { operationBudgetMs: OPERATION_BUDGET_MS, leaseDeadline: record.state === 'terminal' ? at : at + OPERATION_BUDGET_MS };
  const result = { ...record, ...lease, at }; controllerObservation(result); return result;
}
export function hasLiveControllerLease(observation, now = Date.now()) {
  const e = observation?.evidence;
  return validLeaseShape(observation?.outcome, e) && e.at <= now && now < e.leaseDeadline;
}
