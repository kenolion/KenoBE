import { readFileSync } from "fs";
import { OUT_PATH, VID_STATS_NM } from "../constants/app-const.mjs";
import { fmtTimestamp } from "../utils/math-util.mjs";

const DEFAULT_OPTIONS = {
  sensitivity: 2,
  baselineWindow: 5,
  minKeywordHits: 3,
  minKeywordRatio: 0.02,
  cooldownMinutes: 1,
  limit: 20,
};

/*
  keywordHits = the amount of target keyword hits in the timestamp bucket
  keywordRatio = keywordHits divided by total messages in the timestamp bucket
  baselineHits = rolling average of keyword hits before the current timestamp
  spikeScore = normalized lift over the rolling baseline
*/
export class ChatAnalyzer {
  constructor(words = [], videoId = null, options = {}) {
    if (videoId && typeof videoId === "object") {
      options = videoId;
      videoId = null;
    }

    this.wordLis = this.#normalizeWords(words);
    this.options = this.#resolveOptions(options);
    this.file = null;
    // loaded from file {videoid}-stats.json, contains non totaled up data
    this.timeStampMap = null;
    this.videoId = videoId;
    this.videoStartTimestamp = null;
    this.analysis = {};
    this.clips = [];
  }

  async load(videoId) {
    this.videoId = this.videoId || videoId;
    const fileNm = OUT_PATH + this.videoId + VID_STATS_NM + ".json";

    try {
      this.file = readFileSync(fileNm);
      this.timeStampMap = JSON.parse(this.file);
      return this.timeStampMap;
    } catch (e) {
      console.log(`Failed to load ${fileNm}`);
      console.log(e);
      throw e;
    }
  }

  getObj() {
    return this.timeStampMap;
  }

  setVideoStartTimestamp(timestamp) {
    const parsedTimestamp = Number(timestamp);
    this.videoStartTimestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
  }

  analyze(regex, timeStampMap, options = {}) {
    timeStampMap = timeStampMap || this.timeStampMap;
    this.options = this.#resolveOptions(options);
    this.analysis = {};
    this.clips = [];

    if (!timeStampMap) {
      return this.#buildResult();
    }

    const entries = Object.entries(timeStampMap).sort(
      ([a], [b]) => Number(a) - Number(b)
    );
    const history = [];

    for (const [timestamp, timestampObj] of entries) {
      const totalMessages = Number(timestampObj.total) || 0;
      const matchedWords = this.#getMatchedWords(timestampObj.wordsObj || {});
      const keywordHits = Object.values(matchedWords).reduce(
        (total, count) => total + count,
        0
      );
      const keywordRatio =
        totalMessages > 0 ? keywordHits / totalMessages : 0;
      const baselineHits = this.#calBaseline(history);
      const spikeScore = this.#calSpikeScore(keywordHits, baselineHits);
      const isClippable = this.#isClippable({
        keywordHits,
        keywordRatio,
        spikeScore,
      });

      const timestampAnalysis = {
        timestamp: this.#formatTimestamp(timestamp),
        keywordHits,
        totalMessages,
        keywordRatio,
        baselineHits,
        spikeScore,
        matchedWords,
        isClippable,
      };
      Object.defineProperty(timestampAnalysis, "rawTimestamp", {
        value: timestamp,
        enumerable: false,
      });

      this.analysis[timestamp] = timestampAnalysis;
      if (isClippable) {
        this.clips.push(timestampAnalysis);
      }

      history.push(keywordHits);
    }

    this.clips = this.#rankAndApplyCooldown(this.clips);
    return this.#buildResult();
  }

  #buildResult() {
    return {
      options: this.options,
      analysis: this.analysis,
      clips: this.clips,
    };
  }

  #normalizeWords(words) {
    if (!Array.isArray(words)) {
      return [];
    }

    return words
      .map((word) => String(word).trim())
      .filter((word) => word.length > 0);
  }

  #resolveOptions(options = {}) {
    const resolved = { ...DEFAULT_OPTIONS, ...this.options, ...options };

    return {
      sensitivity: this.#numberOrDefault(
        resolved.sensitivity,
        DEFAULT_OPTIONS.sensitivity,
        0
      ),
      baselineWindow: Math.floor(
        this.#numberOrDefault(
          resolved.baselineWindow,
          DEFAULT_OPTIONS.baselineWindow,
          1
        )
      ),
      minKeywordHits: Math.floor(
        this.#numberOrDefault(
          resolved.minKeywordHits,
          DEFAULT_OPTIONS.minKeywordHits,
          1
        )
      ),
      minKeywordRatio: this.#numberOrDefault(
        resolved.minKeywordRatio,
        DEFAULT_OPTIONS.minKeywordRatio,
        0
      ),
      cooldownMinutes: Math.floor(
        this.#numberOrDefault(
          resolved.cooldownMinutes,
          DEFAULT_OPTIONS.cooldownMinutes,
          0
        )
      ),
      limit: Math.floor(
        this.#numberOrDefault(resolved.limit, DEFAULT_OPTIONS.limit, 1)
      ),
    };
  }

  #numberOrDefault(value, defaultValue, min) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      return defaultValue;
    }

    return Math.max(num, min);
  }

  #getMatchedWords(wordsObj) {
    const matchedWords = {};

    for (const word of this.wordLis) {
      const count = Number(wordsObj[word]) || 0;
      if (count > 0) {
        matchedWords[word] = count;
      }
    }

    return matchedWords;
  }

  #calBaseline(history) {
    const windowHits = history.slice(-this.options.baselineWindow);
    if (windowHits.length === 0) {
      return 0;
    }

    return (
      windowHits.reduce((total, keywordHits) => total + keywordHits, 0) /
      windowHits.length
    );
  }

  #calSpikeScore(keywordHits, baselineHits) {
    return (keywordHits - baselineHits) / Math.sqrt(baselineHits + 1);
  }

  #isClippable({ keywordHits, keywordRatio, spikeScore }) {
    return (
      keywordHits >= this.options.minKeywordHits &&
      keywordRatio >= this.options.minKeywordRatio &&
      spikeScore >= this.options.sensitivity
    );
  }

  #rankAndApplyCooldown(clips) {
    const selected = [];
    const cooldownMs = this.options.cooldownMinutes * 60 * 1000 * 1000;
    const rankedClips = [...clips].sort((a, b) => b.spikeScore - a.spikeScore);

    for (const clip of rankedClips) {
      const timestamp = Number(clip.rawTimestamp ?? clip.timestamp);
      const isInCooldown = selected.some((selectedClip) => {
        return Math.abs(Number(selectedClip.rawTimestamp ?? selectedClip.timestamp) - timestamp) <= cooldownMs;
      });

      if (!isInCooldown) {
        selected.push(clip);
      }

      if (selected.length >= this.options.limit) {
        break;
      }
    }

    return selected;
  }

  #formatTimestamp(timestamp) {
    return fmtTimestamp(this.videoStartTimestamp ?? 0, timestamp);
  }
}
