// Shared by the browser bundle and host runner. Never collect chat or request bodies.
export const TERMINAL_PREFIX = 'VARCAMP_GUIDE_TERMINAL ';
export function failureRecord(value, context = {}) {
  let redacted = false, truncated = false, serializationFailed = false, budget = 10000;
  const bytes = value => new TextEncoder().encode(value).length;
  const seen = new Set();
  const text = input => {
    let result = input.replace(/https?:\/\/[^\s)<>"']+/g, raw => {
      try { const url = new URL(raw); if (url.username || url.password || url.search || url.hash) { redacted = true; url.username = ''; url.password = ''; url.search = url.search ? '?REDACTED' : ''; url.hash = url.hash ? '#REDACTED' : ''; } return url.href; } catch { return '[invalid URL]'; }
    }).replace(/\b(?:Bearer|Basic)\s+[^\s,;]+/gi, () => { redacted = true; return '[REDACTED authorization]'; })
      .replace(/\b(authorization|cookie|set-cookie|token|api[-_]?key|password)\s*[:=]\s*[^\r\n,;]+/gi, (_, key) => { redacted = true; return `${key}=[REDACTED]`; });
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
    let keys; try { keys = Object.keys(input); } catch { serializationFailed = true; return '[unreadable]'; }
    if (keys.length > 16) truncated = true;
    const result = {};
    for (const key of keys.slice(0, 16)) {
      if (/authorization|cookie|token|password|secret|credential|headers?|chat|participant|body|content/i.test(key)) { result[key.slice(0, 80)] = '[REDACTED]'; redacted = true; }
      else result[text(key).slice(0, 80)] = copy(read(input, key), depth + 1);
    }
    return result;
  };
  try {
    const error = copy(value);
    const result = { ...context, error, redacted, truncated, serializationFailed };
    if (bytes(JSON.stringify(result)) > 16384) {
      // Structural/escaping overhead is also bounded, with a visible loss marker.
      return { ...context, error: '[truncated: encoded evidence exceeded 16KiB]', redacted, truncated: true, serializationFailed };
    }
    return result;
  }
  catch { return { ...context, error: '[serialization failed]', redacted: true, truncated: true, serializationFailed: true }; }
}
export function diagnosticLine(text, record) {
  const summary = failureRecord(text).error;
  return TERMINAL_PREFIX + JSON.stringify({ ...(record ?? failureRecord(text, { event: 'controller-terminal' })),
    summary: typeof summary === 'string' ? summary.slice(0, 256) : 'Controller stopped' });
}
