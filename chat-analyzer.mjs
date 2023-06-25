import { readFileSync } from "fs";
import { OUT_PATH, VID_STATS_NM } from "./app-const.mjs";
import get from "lodash/get.js";

export class ChatAnalyzer {
  constructor(words) {
    this.wordLis = words;
    //this.wordList = wordLis;
    // stores the increase in word frequency from pvsTime and curTime
    this.wordFreqObj = {};
    // stores the
    this.highestOccurenceObj = {};
    this.file = null;
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
        for (let tsKey in this.wordLis) {
          let word = this.wordLis[tsKey];
          let curWordsObj = timeStampMap[curTime].wordsObj;
          let pvsWordsObj = timeStampMap[pvsTime].wordsObj;
          curWordsObj[word] = curWordsObj[word] ?? 0;
          pvsWordsObj[word] = pvsWordsObj[word] ?? 0;

          this.wordFreqObj[curTime][word] =
            curWordsObj[word] - pvsWordsObj[word];
          // change logic to total up the value
          if (this.#isClippable(pvsTime, curTime, word)) {
            //
            console.log(curTime);
            console.log(this.wordFreqObj[curTime][word]);
            timeLis.push(curTime);
          }
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
    //console.log("calRatio:", rt);

    return rt;
  }

  // caculates the percentage of the rate of change of word to the total number of words in the chat
  #calCgePct(curDifTot, prevAmt) {
    //let rt = (curDifTot / pvsDifTot) * 100;
    // 40 - 20 = 20 / 60
    // 40 - 1 = 39/41 * 20
    //1687260840000000 see this, the previous change should also take into account how much ratio it was
    let rt = 0;
    if (prevAmt > 0) {
      rt = (curDifTot / (prevAmt - 10) / 10) * 20;
      //  console.log("cgePct:", rt);
      //rt = max([0, rt]);
    }

    return rt;
  }

  #isClippable(pvsTime, curTime, word) {
    let score = 0;
    let wordsObj = this.timeStampMap[curTime].wordsObj;
    //    console.log("curTime:", curTime);
    score =
      this.#calRatio(this.timeStampMap[curTime].total, wordsObj[word]) * 0.5 +
      this.#calCgePct(
        get(this.wordFreqObj, `${curTime}.${word}`),
        get(this.timeStampMap, `${pvsTime}.wordsObj.${word}`)
      ) *
        0.5;
    //    console.log("Score:", score, "\n");
    return score > 10 ? true : false;
  }
}
