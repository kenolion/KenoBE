import assert from "node:assert/strict";
import { ChatAnalyzer } from "../src/services/chat-analyzer.mjs";

const min = 60 * 1000 * 1000;
const ts = (minute) => String(minute * min);
const tsFromStart = (startMs, seconds) => String((startMs + (seconds * 1000)) * 1000);
const bucket = (wordsObj, total = 100) => ({ wordsObj, total });

function analyze(words, timeStampMap, options, videoStartTimestamp = 0) {
  const analyzer = new ChatAnalyzer(words, null, options);
  analyzer.setVideoStartTimestamp(videoStartTimestamp);
  return analyzer.analyze(null, timeStampMap);
}

{
  const result = analyze(["pog"], {
    [ts(1)]: bucket({ w: 20 }),
    [ts(2)]: bucket({ lol: 20 }),
  });

  assert.equal(result.clips.length, 0);
}

{
  const result = analyze(
    ["pog"],
    {
      [ts(1)]: bucket({ pog: 1 }),
      [ts(2)]: bucket({ pog: 1 }),
      [ts(3)]: bucket({ pog: 1 }),
      [ts(4)]: bucket({ pog: 20 }),
    },
    { baselineWindow: 3, sensitivity: 2, minKeywordHits: 3 }
  );

  assert.equal(result.clips.length, 1);
  assert.equal(result.clips[0].timestamp, "00:04:00");
  assert.equal(result.analysis[ts(4)].timestamp, "00:04:00");
  assert.equal(result.clips[0].keywordHits, 20);
}

{
  const result = analyze(
    ["pog"],
    {
      [ts(1)]: bucket({ pog: 0 }),
      [ts(2)]: bucket({ pog: 2 }, 2),
    },
    { sensitivity: 1, minKeywordHits: 3, minKeywordRatio: 0 }
  );

  assert.equal(result.clips.length, 0);
}

{
  const timeStampMap = {
    [ts(1)]: bucket({ pog: 1 }),
    [ts(2)]: bucket({ pog: 1 }),
    [ts(3)]: bucket({ pog: 6 }),
  };
  const strictResult = analyze(["pog"], timeStampMap, {
    baselineWindow: 2,
    sensitivity: 10,
    minKeywordHits: 3,
  });
  const looseResult = analyze(["pog"], timeStampMap, {
    baselineWindow: 2,
    sensitivity: 1,
    minKeywordHits: 3,
  });

  assert.equal(strictResult.clips.length, 0);
  assert.equal(looseResult.clips.length, 1);
}

{
  const result = analyze(
    ["pog"],
    {
      [ts(1)]: bucket({ pog: 1 }),
      [ts(2)]: bucket({ pog: 1 }),
      [ts(3)]: bucket({ pog: 20 }),
      [ts(4)]: bucket({ pog: 25 }),
    },
    {
      baselineWindow: 2,
      sensitivity: 1,
      minKeywordHits: 3,
      cooldownMinutes: 1,
    }
  );

  assert.equal(result.clips.length, 1);
  assert.equal(result.clips[0].timestamp, "00:03:00");
}

{
  const videoStartTimestamp = 1000;
  const result = analyze(
    ["pog"],
    {
      [tsFromStart(videoStartTimestamp, 60)]: bucket({ pog: 1 }),
      [tsFromStart(videoStartTimestamp, 125)]: bucket({ pog: 1 }),
      [tsFromStart(videoStartTimestamp, 245)]: bucket({ pog: 20 }),
    },
    { baselineWindow: 2, sensitivity: 1, minKeywordHits: 3 },
    videoStartTimestamp
  );

  assert.equal(result.clips.length, 1);
  assert.equal(result.clips[0].timestamp, "00:04:05");
}

console.log("chat-analyzer probe passed");
