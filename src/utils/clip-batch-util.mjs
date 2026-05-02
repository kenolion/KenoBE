import { MAX_SEGMENT_SECONDS, parseTimestamp } from "./clip-time-util.mjs";

const MAX_BATCH_CLIPS = 10;
const DEFAULT_BATCH_OFFSET_SECONDS = 90;

function secondsString(seconds) {
  return Number(seconds).toFixed(3).replace(/\.?0+$/, '');
}

function validationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function errorResponse(index, item, err) {
  return {
    index,
    timestamp: item?.timestamp,
    duration: item?.duration,
    statusCode: err.statusCode || 500,
    error: err.message
  };
}

function normalizeBatchClipOffset(value = DEFAULT_BATCH_OFFSET_SECONDS) {
  const offsetSeconds = Number(value);

  if (!Number.isFinite(offsetSeconds)) {
    throw validationError('"offset" must be a number');
  }
  if (offsetSeconds < 0) {
    throw validationError('"offset" must be greater than or equal to 0');
  }

  return offsetSeconds;
}

function buildBatchClipJobs(clips, offset = DEFAULT_BATCH_OFFSET_SECONDS) {
  const jobs = [];
  const errors = [];
  const offsetSeconds = normalizeBatchClipOffset(offset);

  clips.forEach((item, index) => {
    try {
      if (!item || typeof item !== 'object') {
        throw validationError(`"clips[${index}]" must be an object`);
      }

      const fromSeconds = parseTimestamp(item.timestamp, `clips[${index}].timestamp`);
      const durationSeconds = Number(item.duration);

      if (!Number.isFinite(durationSeconds)) {
        throw validationError(`"clips[${index}].duration" must be a number`);
      }
      if (durationSeconds <= 0) {
        throw validationError(`"clips[${index}].duration" must be greater than 0`);
      }
      if (offsetSeconds + durationSeconds > MAX_SEGMENT_SECONDS) {
        throw validationError(`Segment cannot be longer than ${MAX_SEGMENT_SECONDS} seconds`);
      }

      const toSeconds = fromSeconds + durationSeconds;
      const adjustedFromSeconds = Math.max(0, fromSeconds - offsetSeconds);
      jobs.push({
        index,
        timestamp: item.timestamp,
        duration: item.duration,
        offset: offsetSeconds,
        from: secondsString(adjustedFromSeconds),
        to: secondsString(toSeconds)
      });
    } catch (err) {
      errors.push(errorResponse(index, item, err));
    }
  });

  return { jobs, errors };
}

function validateBatchClipInput(clipsInput) {
  if (!Array.isArray(clipsInput)) {
    return '"clips" must be an array';
  }
  if (clipsInput.length === 0) {
    return '"clips" must not be empty';
  }
  if (clipsInput.length > MAX_BATCH_CLIPS) {
    return `"clips" cannot contain more than ${MAX_BATCH_CLIPS} items`;
  }

  return null;
}

function batchStatusCode(clips, errors) {
  if (clips.length > 0) {
    return 201;
  }

  const hasOnlyValidationErrors =
    errors.length > 0 && errors.every((error) => error.statusCode === 400);

  return hasOnlyValidationErrors ? 400 : 207;
}

export {
  DEFAULT_BATCH_OFFSET_SECONDS,
  MAX_BATCH_CLIPS,
  batchStatusCode,
  buildBatchClipJobs,
  errorResponse,
  normalizeBatchClipOffset,
  secondsString,
  validateBatchClipInput
};
