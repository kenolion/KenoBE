import assert from "node:assert/strict";
import {
  DEFAULT_BATCH_OFFSET_SECONDS,
  MAX_BATCH_CLIPS,
  batchStatusCode,
  buildBatchClipJobs,
  normalizeBatchClipOffset,
  secondsString,
  validateBatchClipInput
} from "../src/utils/clip-batch-util.mjs";

{
  assert.equal(secondsString(83), "83");
  assert.equal(secondsString(113.5), "113.5");
}

{
  assert.equal(validateBatchClipInput({}), '"clips" must be an array');
  assert.equal(validateBatchClipInput([]), '"clips" must not be empty');
  assert.equal(
    validateBatchClipInput(Array.from({ length: MAX_BATCH_CLIPS + 1 }, () => ({}))),
    `"clips" cannot contain more than ${MAX_BATCH_CLIPS} items`
  );
  assert.equal(validateBatchClipInput([{ timestamp: "00:10", duration: 5 }]), null);
}

{
  assert.equal(DEFAULT_BATCH_OFFSET_SECONDS, 90);
  assert.equal(normalizeBatchClipOffset(undefined), 90);
  assert.equal(normalizeBatchClipOffset("15.5"), 15.5);
  assert.throws(
    () => normalizeBatchClipOffset("nope"),
    /"offset" must be a number/
  );
  assert.throws(
    () => normalizeBatchClipOffset(-1),
    /"offset" must be greater than or equal to 0/
  );
}

{
  const { jobs, errors } = buildBatchClipJobs([
    { timestamp: "01:23", duration: 30 },
    { timestamp: "02:10.5", duration: 45.5 }
  ]);

  assert.equal(errors.length, 0);
  assert.deepEqual(jobs, [
    {
      index: 0,
      timestamp: "01:23",
      duration: 30,
      offset: 90,
      from: "0",
      to: "113"
    },
    {
      index: 1,
      timestamp: "02:10.5",
      duration: 45.5,
      offset: 90,
      from: "40.5",
      to: "176"
    }
  ]);
}

{
  const { jobs, errors } = buildBatchClipJobs([
    { timestamp: "01:23", duration: 30 }
  ], 10);

  assert.equal(errors.length, 0);
  assert.deepEqual(jobs, [
    {
      index: 0,
      timestamp: "01:23",
      duration: 30,
      offset: 10,
      from: "73",
      to: "113"
    }
  ]);
}

{
  const { jobs, errors } = buildBatchClipJobs([
    { timestamp: "05:00", duration: 511 }
  ]);

  assert.equal(jobs.length, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].error, "Segment cannot be longer than 600 seconds");
}

{
  const { jobs, errors } = buildBatchClipJobs([
    { timestamp: "00:10", duration: -1 },
    { timestamp: "bad", duration: 10 },
    null
  ]);

  assert.equal(jobs.length, 0);
  assert.equal(errors.length, 3);
  assert.equal(batchStatusCode([], errors), 400);
}

{
  const { jobs, errors } = buildBatchClipJobs([
    { timestamp: "00:10", duration: 10 },
    { timestamp: "00:20", duration: "nope" }
  ]);

  assert.equal(jobs.length, 1);
  assert.equal(errors.length, 1);
  assert.equal(batchStatusCode([{ filename: "clip.mp4" }], errors), 201);
}

{
  const errors = [{ statusCode: 502, error: "upstream failed" }];
  assert.equal(batchStatusCode([], errors), 207);
}

console.log("clip-batch probe passed");
