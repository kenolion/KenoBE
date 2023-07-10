import { readFileSync } from "fs";
import { OUT_PATH, VID_STATS_NM } from "./app-const.mjs";
import get from "lodash/get.js";
import { fmtMin } from "./utils/math-util.mjs";
/*
  wordFreq = the amount of times the word occur
  wordFreqDiff = the difference in wordFreq from pvsTime and curTime(positive means a greater increase in word frequency)
  totalOcc = the total amount of times the list of words occur in the whole video
  total = total messages in that timestamp
*/
export class ChatAnalyzer {
  constructor(words, videoId) {
    this.wordLis = words;
    // stores the increase in word frequency from pvsTime and curTime
    this.wordFreqObj = {};
    this.file = null;
    // loaded from file {videoid}-stats.json, contains non totaled up data
    this.timeStampMap = null;
    this.videoId = videoId;
    this.timeStampObjTotal = {};
    this.timeLis = [];
  }

  async load(videoId) {
    this.videoId = this.videoId || videoId;
    let fileNm = OUT_PATH + this.videoId + VID_STATS_NM + ".json";
    try {
      this.file = readFileSync(fileNm);
      this.timeStampMap = JSON.parse(this.file);
    } catch (e) {
      console.log(`Failed to load ${fileNm}.json`);
      console.log(e);
    }
  }

  getObj() {
    return this.timeStampMap;
  }

  analyze(regex, timeStampMap) {
    timeStampMap = timeStampMap || this.timeStampMap;

    let pvsTime = "";

    for (let curTime in timeStampMap) {
      if (pvsTime != "") {
        this.wordFreqObj[curTime] = {};
        this.timeStampObjTotal[curTime] = {};
        this.wordFreqObj[curTime].totalOcc = 0;
        for (let tsKey in this.wordLis) {
          let word = this.wordLis[tsKey];
          let curWordsObj = timeStampMap[curTime].wordsObj;
          let pvsWordsObj = timeStampMap[pvsTime].wordsObj;
          curWordsObj[word] = curWordsObj[word] ?? 0;
          pvsWordsObj[word] = pvsWordsObj[word] ?? 0;
          this.wordFreqObj[curTime].totalOcc += curWordsObj[word];
        }
        this.wordFreqObj[curTime].wordFreqDiff =
          this.wordFreqObj[curTime].totalOcc -
          get(this.wordFreqObj, `${pvsTime}.totalOcc`);
        this.#calTimestampObjTotal(curTime, pvsTime);
        if (this.#isClippable(pvsTime, curTime)) {
          this.timeLis.push(curTime);
        }
      }

      pvsTime = curTime;
    }
    console.log(this.timeLis);

    return this.wordFreqObj;
  }

  // calculates the ratio of the word to the total number of words in the chat
  #calRatio(totMsg, wordTot) {
    let rt = wordTot / totMsg;
    console.log("calRatio:", rt);

    return rt;
  }

  // caculates the percentage of the rate of change of word to the total number of words in the chat
  #calCgePct(curTime, pvsTime) {
    let rt = 0;

    rt =
      this.timeStampObjTotal[curTime].ratio +
      get(this.timeStampObjTotal, `${pvsTime}.ratio`) *
        get(this.wordFreqObj, `${curTime}.wordFreqDiff`) +
      1;

    console.log(`(${this.timeStampObjTotal[curTime].ratio} +
        ${get(this.timeStampObjTotal, `${pvsTime}.ratio`)}
        * ${get(this.wordFreqObj, `${curTime}.wordFreqDiff`)}) + 1`);
    console.log("cgePct:", rt);

    return rt;
  }

  #calTimestampObjTotal(curTime, pvsTime) {
    this.timeStampObjTotal[curTime].ratio = this.#calRatio(
      this.timeStampMap[curTime].total,
      this.wordFreqObj[curTime].totalOcc
    );
    this.timeStampObjTotal[curTime].cgePct = this.#calCgePct(curTime, pvsTime);
  }

  // checks if the timestamp is clippable
  #isClippable(curTime) {
    let score = 0;
    console.log("curTime:", curTime);

    score =
      this.timeStampObjTotal[curTime].ratio * 100 * 0.5 +
      this.timeStampObjTotal[curTime].cgePct * 0.5;
    console.log("Score:", score, "\n");
    console.log("---------\n");
    return score > 25;
  }
}
