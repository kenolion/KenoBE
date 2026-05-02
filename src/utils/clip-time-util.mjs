const MAX_SEGMENT_SECONDS = 10 * 60;

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseTimestamp(value, name) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    throw httpError(400, `"${name}" query param is required`);
  }
  if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d+)?$/.test(raw)) {
    throw httpError(400, `"${name}" must be SS, MM:SS, or HH:MM:SS`);
  }

  const parts = raw.split(':');
  const partCount = parts.length;
  const seconds = Number(parts.pop());
  const minutes = parts.length ? Number(parts.pop()) : 0;
  const hours = parts.length ? Number(parts.pop()) : 0;

  if (
    !Number.isFinite(seconds) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(hours) ||
    (partCount > 2 && minutes >= 60) ||
    (partCount > 1 && seconds >= 60)
  ) {
    throw httpError(400, `"${name}" is not a valid timestamp`);
  }

  return (hours * 3600) + (minutes * 60) + seconds;
}

export { MAX_SEGMENT_SECONDS, httpError, parseTimestamp };
