import kuromoji from "kuromoji";

let kuroToken = null;
const wRegex = new RegExp(/^[w][^a-vx-z]+/gi);
// const jRegex = new RegExp(/([:]*?<kanji>[一-龠]+[:]*)[ぁ-ゔ]*/gi);

// accepts a list of messages in the same time frame and returns a heatmap for some words that occured in the given time frame
// input: list of messages, list of words, time frame
// output: heatmap
async function extractWordHeatMap(timestamp, msgLis, wordHeatMap) {
  return new Promise((resolve, reject) => {
    let timestampObj = {};
   // const t1 = performance.now();
    if (timestamp > 0) {
      for (let message of msgLis) {
        // Convert message to lowercase and remove non-alphanumeric characters
        setWordHeatMap(timestampObj, message.message);
      }
      wordHeatMap.set(timestamp, timestampObj);
    }

  //  const t2 = performance.now();
    //console.log("Time taken to extract ", timestamp, t2 - t1, "ms");
    resolve(wordHeatMap);
  });
}

async function setWordHeatMap(timestampObj, message) {
  let words = await tokenizeJapanese(message);

  for (let word of words) {
    // If word is not in heatmap, add it with count 1
      if (!timestampObj[word]) {
        timestampObj[word] = 1;
    } else {
      // Otherwise, increment the count
      timestampObj[word] = timestampObj[word] + 1;
    }
  }
}

function tokenizeJapanese(message) {
  return new Promise((resolve, reject) => {
    const tokens = kuroToken.tokenize(message);
    const words = tokens
      .filter((token) => {
        return /[a-zA-Z一-龠ぁ-ゔァ-ヴー]/.test(token.surface_form);
      })
      .map((token) => {
        let tokenBasicForm = token.basic_form;
        if (tokenBasicForm != "*") {
          return tokenBasicForm;
        } else if (
          token.surface_form.includes("w") &&
          (wRegex.test(token.surface_form) || token.surface_form.length === 1)
        ) {
          return "w";
        } else {
          return token.surface_form;
        }
      });
    resolve(words);
  });
}

function initTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji
      .builder({ dicPath: "node_modules/kuromoji/dict" })
      .build((err, tokenizer) => {
        if (err) {
          reject(err);
        } else {
          kuroToken = tokenizer;
          resolve(tokenizer);
        }
      });
  });
}

// a function that applies regex to a japanese message from parameter
// function regexJapanese(message,regex) {
//   let words = [];

//   while( regex.exec(message) != null){
//     let word = regex.exec(message);
//     if(word.groups){
//       words.push(word.groups.kanji);
//     }
//   }

// return words;
// }

export { extractWordHeatMap, initTokenizer };
