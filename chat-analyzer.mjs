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
  constructor(words) {
    this.wordLis = words;
    //this.wordList = wordLis;
    // stores the increase in word frequency from pvsTime and curTime
    this.wordFreqObj = {};
    // stores the
    this.highestOccurenceObj = {};
    this.file = null;
    // loaded from file {videoid}-stats.json, contains non totaled up data
    this.timeStampMap = null;
    this.timeStampObjTotal = {};
  }

  async load(videoId) {
    let fileNm = OUT_PATH + videoId + VID_STATS_NM + ".json";
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
    let timeLis = [];

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
        // change logic to total up the value
        if (this.#isClippable(pvsTime, curTime)) {
          //
          // console.log(curTime);
          // console.log(this.wordFreqObj[curTime]);
          timeLis.push(curTime);
        }
      }

      pvsTime = curTime;
    }
    console.log(timeLis);

    return this.wordFreqObj;
  }

  // calculates the ratio of the word to the total number of words in the chat
  #calRatio(totMsg, wordTot) {
    let rt = (wordTot / totMsg) * 100;
    console.log("calRatio:", rt);

    return rt;
  }

  // caculates the percentage of the rate of change of word to the total number of words in the chat
  #calCgePct(curTime,pvsTime) {
    //let rt = (curDifTot / pvsDifTot) * 100;
    // 40 - 20 = 20 / 60
    // 40 - 1 = 39/41 * 20
    //1687260840000000 see this, the previous change should also take into account how much ratio it was
    let rt = 0;
   // if (curDifTot >= 0) {
      rt = ((this.timeStampObjTotal[curTime].ratio /100) +
        (get(this.timeStampObjTotal, `${pvsTime}.ratio`) / 100)
        * get(this.wordFreqObj, `${curTime}.wordFreqDiff`)) + 1;

      // rt = (2 * curDifTot) / (-10 + prevAmt);
      //rt = (curDifTot / (prevAmt - 10) / 10) * 20;
      //console.log(`(${curDifTot} / (${prevAmt} - 10) / 10) * 20`);
      console.log(`(${this.timeStampObjTotal[curTime].ratio} +
        ${get(this.timeStampObjTotal, `${pvsTime}.ratio`)}
        * ${get(this.wordFreqObj, `${curTime}.wordFreqDiff`)}) + 1`);
      console.log("cgePct:", rt);
      //rt = max([0, rt]);
   // }

    return rt;
  }

  #calTimestampObjTotal(curTime, pvsTime) {
    this.timeStampObjTotal[curTime].ratio = this.#calRatio(
      this.timeStampMap[curTime].total,
      this.wordFreqObj[curTime].totalOcc
    );
    this.timeStampObjTotal[curTime].cgePct = this.#calCgePct(
      curTime,pvsTime
    );
  }

  // checks if the timestamp is clippable
  #isClippable(pvsTime, curTime) {
    let score = 0;
    console.log("curTime:", curTime);

    score =
      this.timeStampObjTotal[curTime].ratio * 0.5 +
      this.timeStampObjTotal[curTime].cgePct * 0.5;
    console.log("Score:", score, "\n");
    console.log("---------\n");
    return score > 25;
  }
}
