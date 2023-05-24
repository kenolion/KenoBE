

export class ChatAnalyzer {
  constructor(words) {
    this.wordLis = words;
    //this.wordList = wordLis;
    this.wordFreqObj = {};
    this.highestOccurenceObj = {};
  }
  
  load(filePath){

  }

  analyze(timeStampMap, regex) {
    let pvsKey = "";
    for (let time in timeStampMap) {
      if (timeStampMap.hasOwnProperty(time)) {
        if (pvsKey != "") {
          //let value = timeStampMap[time];
          // for (let tsKey in timeStampMap[time]) {
          //     this.wordFreqObj[time][tsKey]  = timeStampMap[time][tsKey] -  timeStampMap[pvsKey][tsKey];
          //     //this.highestOccurenceObj[time]
          // }
          this.wordFreqObj[time] = {};
          for (let tsKey in this.wordLis) {
            let word = this.wordLis[tsKey];
            timeStampMap[time][word] = timeStampMap[time][word] ?? 0;
            timeStampMap[pvsKey][word] = timeStampMap[pvsKey][word] ?? 0;
            console.log(timeStampMap[time][word]);
           
            this.wordFreqObj[time][word] =
              timeStampMap[time][word] - timeStampMap[pvsKey][word];
          }
        }
        pvsKey = time;
      }
    }
    return this.wordFreqObj;
  }
}
